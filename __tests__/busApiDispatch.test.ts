/**
 * @format
 *
 * 도시코드에 따라 어느 제공자로 가는지 확인합니다.
 * 서울(11)만 서울시 API 로 가고 나머지는 전부 TAGO 입니다.
 */

import { busApi } from '@/api/busApi';
import { seoulBusApi } from '@/api/seoulBusApi';
import { tagoBusApi } from '@/api/tagoBusApi';
import { useSettingsStore } from '@/store/settingsStore';
import { SEOUL_CITY_CODE, type BusStop } from '@/types/bus';

jest.mock('@/api/seoulBusApi', () => ({
  seoulBusApi: {
    searchStops: jest.fn().mockResolvedValue([]),
    getRoutesAtStop: jest.fn().mockResolvedValue([]),
    getArrivals: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/api/tagoBusApi', () => ({
  tagoBusApi: {
    searchStops: jest.fn().mockResolvedValue([]),
    getRoutesAtStop: jest.fn().mockResolvedValue([]),
    getArrivals: jest.fn().mockResolvedValue([]),
  },
}));

const DAEJEON = 25;

const stop = (cityCode: number): BusStop => ({
  nodeId: '22007',
  name: '강남역',
  cityCode,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('searchStops', () => {
  test('설정된 지역이 서울이면 서울시 API 로 간다', async () => {
    useSettingsStore.setState({
      cityCode: SEOUL_CITY_CODE,
      cityName: '서울특별시',
    });

    await busApi.searchStops('강남');

    expect(seoulBusApi.searchStops).toHaveBeenCalledWith('강남');
    expect(tagoBusApi.searchStops).not.toHaveBeenCalled();
  });

  test('다른 지역이면 TAGO 로 간다', async () => {
    useSettingsStore.setState({ cityCode: DAEJEON, cityName: '대전광역시' });

    await busApi.searchStops('시청');

    expect(tagoBusApi.searchStops).toHaveBeenCalledWith('시청');
    expect(seoulBusApi.searchStops).not.toHaveBeenCalled();
  });
});

describe('정류장 단위 조회', () => {
  /**
   * 즐겨찾기는 각자 cityCode 를 들고 있습니다. 지금 보고 있는 지역이 대전이어도
   * 서울 즐겨찾기의 도착정보는 서울시 API 로 가야 합니다.
   */
  test('설정 지역과 무관하게 정류장의 도시코드를 따른다', async () => {
    useSettingsStore.setState({ cityCode: DAEJEON, cityName: '대전광역시' });

    await busApi.getRoutesAtStop(stop(SEOUL_CITY_CODE));
    await busApi.getArrivals(SEOUL_CITY_CODE, '22007');

    expect(seoulBusApi.getRoutesAtStop).toHaveBeenCalledTimes(1);
    expect(seoulBusApi.getArrivals).toHaveBeenCalledWith(
      SEOUL_CITY_CODE,
      '22007',
    );
    expect(tagoBusApi.getRoutesAtStop).not.toHaveBeenCalled();
    expect(tagoBusApi.getArrivals).not.toHaveBeenCalled();
  });

  test('서울이 아닌 정류장은 TAGO 로 간다', async () => {
    useSettingsStore.setState({
      cityCode: SEOUL_CITY_CODE,
      cityName: '서울특별시',
    });

    await busApi.getArrivals(DAEJEON, 'DJB8001793');

    expect(tagoBusApi.getArrivals).toHaveBeenCalledWith(DAEJEON, 'DJB8001793');
    expect(seoulBusApi.getArrivals).not.toHaveBeenCalled();
  });
});
