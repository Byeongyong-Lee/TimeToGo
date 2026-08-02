/**
 * @format
 */

import {
  alarmStartsWithin,
  DEFAULT_ALARM,
  formatAlarmDays,
  formatMinutesOfDay,
  isAlarmActiveAt,
  type FavoriteAlarm,
} from '@/types/alarm';

// 2026-01-05 는 월요일입니다.
const monday = (hour: number, minute: number) =>
  new Date(2026, 0, 5, hour, minute);
const sunday = (hour: number, minute: number) =>
  new Date(2026, 0, 4, hour, minute);

const alarm = (patch: Partial<FavoriteAlarm> = {}): FavoriteAlarm => ({
  ...DEFAULT_ALARM,
  days: [1], // 월요일
  startMinutes: 7 * 60,
  endMinutes: 7 * 60 + 20,
  ...patch,
});

describe('isAlarmActiveAt', () => {
  test('꺼져 있으면 시간대와 무관하게 비활성이다', () => {
    expect(isAlarmActiveAt(alarm({ enabled: false }), monday(7, 10))).toBe(false);
  });

  test('요일과 시간대가 맞으면 활성이다', () => {
    expect(isAlarmActiveAt(alarm(), monday(7, 10))).toBe(true);
  });

  test('시작·종료 경계는 포함이다', () => {
    expect(isAlarmActiveAt(alarm(), monday(7, 0))).toBe(true);
    expect(isAlarmActiveAt(alarm(), monday(7, 20))).toBe(true);
    expect(isAlarmActiveAt(alarm(), monday(6, 59))).toBe(false);
    expect(isAlarmActiveAt(alarm(), monday(7, 21))).toBe(false);
  });

  test('선택하지 않은 요일에는 비활성이다', () => {
    expect(isAlarmActiveAt(alarm(), sunday(7, 10))).toBe(false);
  });

  test('요일이 비어 있으면 항상 비활성이다', () => {
    expect(isAlarmActiveAt(alarm({ days: [] }), monday(7, 10))).toBe(false);
  });

  test('자정을 넘는 시간대를 지원한다 (23:00~01:00)', () => {
    const overnight = alarm({
      days: [0, 1, 2, 3, 4, 5, 6],
      startMinutes: 23 * 60,
      endMinutes: 60,
    });
    expect(isAlarmActiveAt(overnight, monday(23, 30))).toBe(true);
    expect(isAlarmActiveAt(overnight, monday(0, 30))).toBe(true);
    expect(isAlarmActiveAt(overnight, monday(12, 0))).toBe(false);
  });
});

describe('alarmStartsWithin', () => {
  test('리드 타임 안에 시작하면 true 다', () => {
    expect(alarmStartsWithin(alarm(), monday(6, 30), 60)).toBe(true);
    expect(alarmStartsWithin(alarm(), monday(6, 59), 60)).toBe(true);
  });

  test('이미 시작했거나 너무 이르면 false 다', () => {
    expect(alarmStartsWithin(alarm(), monday(7, 0), 60)).toBe(false);
    expect(alarmStartsWithin(alarm(), monday(5, 59), 60)).toBe(false);
  });

  test('꺼져 있거나 요일이 다르면 false 다', () => {
    expect(alarmStartsWithin(alarm({ enabled: false }), monday(6, 30), 60)).toBe(
      false,
    );
    expect(alarmStartsWithin(alarm(), sunday(6, 30), 60)).toBe(false);
  });
});

describe('formatMinutesOfDay', () => {
  test('분을 HH:mm 으로 표시한다', () => {
    expect(formatMinutesOfDay(0)).toBe('00:00');
    expect(formatMinutesOfDay(7 * 60 + 5)).toBe('07:05');
    expect(formatMinutesOfDay(23 * 60 + 55)).toBe('23:55');
  });
});

describe('formatAlarmDays', () => {
  test('평일/주말/매일을 축약한다', () => {
    expect(formatAlarmDays([1, 2, 3, 4, 5])).toBe('평일');
    expect(formatAlarmDays([0, 6])).toBe('주말');
    expect(formatAlarmDays([0, 1, 2, 3, 4, 5, 6])).toBe('매일');
  });

  test('그 외에는 월요일부터 나열한다', () => {
    expect(formatAlarmDays([0, 3, 1])).toBe('월·수·일');
    expect(formatAlarmDays([])).toBe('요일 없음');
  });
});
