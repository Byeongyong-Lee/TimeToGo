/**
 * @format
 *
 * 서울시 버스 API 매핑 테스트.
 *
 * 인증키가 서울시 서비스에 아직 반영되지 않아 실제 응답으로 필드 이름을
 * 확인하지 못했습니다. 여기서 고정해두는 건 "문서에 적힌 모양이 들어왔을 때
 * 앱 모델로 어떻게 바뀌는가" 입니다. 키가 열려 실제 응답 모양이 다르면
 * seoulBusApi.ts 의 Raw* 타입과 이 픽스처를 같이 고쳐야 합니다.
 * (`npm run verify:seoul` 로 대조)
 */

import { seoulBusApi } from '@/api/seoulBusApi';
import { seoulApi } from '@/api/seoulClient';
import { SEOUL_CITY_CODE } from '@/types/bus';

const get = jest.spyOn(seoulApi, 'get');

/** 서울 응답 봉투로 감쌉니다. (msgHeader/msgBody) */
const envelope = (items: unknown[] | null) => ({
  data: {
    msgHeader: { headerCd: '0', headerMsg: '정상적으로 처리되었습니다.' },
    msgBody: { itemList: items },
  },
});

beforeEach(() => {
  get.mockReset();
});

describe('searchStops', () => {
  test('이름으로 검색하면 정류소명 검색을 쓰고 arsId 를 nodeId 로 넣는다', async () => {
    get.mockResolvedValue(
      envelope([
        {
          stId: '1001',
          stNm: '강남역',
          arsId: '22007',
          tmX: '127.02',
          tmY: '37.49',
        },
      ]),
    );

    const stops = await seoulBusApi.searchStops('강남역');

    expect(get).toHaveBeenCalledWith('/stationinfo/getStationByName', {
      params: { stSrch: '강남역' },
    });
    expect(stops).toEqual([
      {
        nodeId: '22007',
        name: '강남역',
        number: '22007',
        cityCode: SEOUL_CITY_CODE,
        lat: 37.49,
        lng: 127.02,
      },
    ]);
  });

  test('도착정보를 조회할 수 없는 가상 정류소(arsId 0)는 제외한다', async () => {
    get.mockResolvedValue(
      envelope([
        { stId: '1001', stNm: '강남역', arsId: '22007' },
        { stId: '1002', stNm: '강남역(중앙차로)', arsId: '0' },
        { stId: '1003', stNm: '강남역앞' },
      ]),
    );

    const stops = await seoulBusApi.searchStops('강남');

    expect(stops.map(stop => stop.nodeId)).toEqual(['22007']);
  });

  test('숫자만 입력하면 정류소 번호로 보고 도착정보 조회를 대신 쓴다', async () => {
    get.mockResolvedValue(
      envelope([
        { stId: '1001', stNm: '강남역', arsId: '22007', rtNm: '146' },
        { stId: '1001', stNm: '강남역', arsId: '22007', rtNm: '360' },
      ]),
    );

    const stops = await seoulBusApi.searchStops('22007');

    expect(get).toHaveBeenCalledWith('/stationinfo/getStationByUid', {
      params: { arsId: '22007' },
    });
    // 노선별로 행이 오지만 정류소는 하나입니다.
    expect(stops).toHaveLength(1);
    expect(stops[0].name).toBe('강남역');
  });

  test('빈 검색어는 요청하지 않는다', async () => {
    expect(await seoulBusApi.searchStops('   ')).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  test('결과가 없으면 빈 배열이다', async () => {
    get.mockResolvedValue(envelope(null));
    expect(await seoulBusApi.searchStops('없는정류장')).toEqual([]);
  });
});

describe('getRoutesAtStop', () => {
  const stop = {
    nodeId: '22007',
    name: '강남역',
    cityCode: SEOUL_CITY_CODE,
  };

  test('축약 노선명을 우선 쓰고 유형 코드를 이름으로 바꾼다', async () => {
    get.mockResolvedValue(
      envelope([
        {
          busRouteId: '100100118',
          busRouteNm: '146',
          busRouteAbrv: '146',
          busRouteType: '3',
        },
        { busRouteId: '100100496', busRouteNm: '강남01', busRouteType: '2' },
      ]),
    );

    const routes = await seoulBusApi.getRoutesAtStop(stop);

    expect(get).toHaveBeenCalledWith('/stationinfo/getRouteByStation', {
      params: { arsId: '22007' },
    });
    expect(routes).toEqual([
      { routeId: '100100118', routeNo: '146', routeType: '간선버스' },
      { routeId: '100100496', routeNo: '강남01', routeType: '마을버스' },
    ]);
  });

  test('유형 코드가 routeType 으로 와도 읽는다', async () => {
    get.mockResolvedValue(
      envelope([{ busRouteId: '1', busRouteAbrv: '9401', routeType: '6' }]),
    );

    const routes = await seoulBusApi.getRoutesAtStop(stop);

    expect(routes[0].routeType).toBe('광역버스');
  });

  test('알 수 없는 유형 코드는 표시하지 않는다', async () => {
    get.mockResolvedValue(
      envelope([{ busRouteId: '1', busRouteAbrv: '146', busRouteType: '99' }]),
    );

    const routes = await seoulBusApi.getRoutesAtStop(stop);

    expect(routes[0].routeType).toBeUndefined();
  });
});

describe('getArrivals', () => {
  test('도착 문구에서 남은 정류장 수를 꺼내고 빠른 순으로 정렬한다', async () => {
    get.mockResolvedValue(
      envelope([
        {
          busRouteId: '2',
          rtNm: '360',
          traTime1: '420',
          arrmsg1: '7분0초후[5번째 전]',
        },
        {
          busRouteId: '1',
          rtNm: '146',
          traTime1: '234',
          arrmsg1: '3분54초후[2번째 전]',
        },
      ]),
    );

    const arrivals = await seoulBusApi.getArrivals(SEOUL_CITY_CODE, '22007');

    expect(get).toHaveBeenCalledWith('/stationinfo/getStationByUid', {
      params: { arsId: '22007' },
    });
    expect(arrivals).toEqual([
      { routeId: '1', routeNo: '146', secondsLeft: 234, stopsLeft: 2 },
      { routeId: '2', routeNo: '360', secondsLeft: 420, stopsLeft: 5 },
    ]);
  });

  test('"곧 도착" 은 남은 정류장 수 없이 그대로 쓴다', async () => {
    get.mockResolvedValue(
      envelope([
        { busRouteId: '1', rtNm: '146', traTime1: '25', arrmsg1: '곧 도착' },
      ]),
    );

    const arrivals = await seoulBusApi.getArrivals(SEOUL_CITY_CODE, '22007');

    expect(arrivals).toEqual([
      { routeId: '1', routeNo: '146', secondsLeft: 25, stopsLeft: undefined },
    ]);
  });

  /**
   * 이게 이 매핑에서 제일 중요한 부분입니다. 서울은 운행하지 않는 노선도
   * 목록에 그대로 넣어주는데 traTime 이 0 이라, 거르지 않으면 "곧 도착" 으로
   * 보여서 알림이 잘못 울립니다.
   */
  test('운행하지 않는 노선은 도착정보에서 뺀다', async () => {
    get.mockResolvedValue(
      envelope([
        { busRouteId: '1', rtNm: '146', traTime1: '0', arrmsg1: '운행종료' },
        { busRouteId: '2', rtNm: '360', traTime1: '0', arrmsg1: '출발대기' },
        {
          busRouteId: '3',
          rtNm: '740',
          traTime1: '180',
          arrmsg1: '3분0초후[2번째 전]',
        },
      ]),
    );

    const arrivals = await seoulBusApi.getArrivals(SEOUL_CITY_CODE, '22007');

    expect(arrivals.map(arrival => arrival.routeNo)).toEqual(['740']);
  });

  test('도착 문구가 아예 없는 행도 뺀다', async () => {
    get.mockResolvedValue(
      envelope([{ busRouteId: '1', rtNm: '146', traTime1: '120' }]),
    );

    expect(await seoulBusApi.getArrivals(SEOUL_CITY_CODE, '22007')).toEqual([]);
  });
});
