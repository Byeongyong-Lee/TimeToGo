/**
 * 즐겨찾기별 알림 설정.
 *
 * 즐겨찾기는 항상 목록에 보이지만, 여기서 정한 요일·시간대에 들어왔을 때만
 * "활성" 상태가 되어 푸시알림 대상이 됩니다. 그 외 시간에는 조회만 됩니다.
 */
export type FavoriteAlarm = {
  /** 꺼져 있으면 어떤 시간에도 알림을 보내지 않습니다. 목록에는 계속 보입니다. */
  enabled: boolean;
  /** 알림 받을 요일. JS Date#getDay 값 (0=일 ~ 6=토) */
  days: number[];
  /** 활성 시간대 시작. 자정 기준 분 (예: 7시 = 420) */
  startMinutes: number;
  /** 활성 시간대 끝 (포함). 시작보다 이르면 자정을 넘는 시간대로 봅니다. */
  endMinutes: number;
  /** 도착정보 조회·푸시알림 주기 (초) */
  intervalSec: 30 | 60;
  /** 남은 시간이 이 값(분) 이하로 내려오면 푸시알림을 시작합니다. */
  notifyFromMinutes: number;
};

export const DEFAULT_ALARM: FavoriteAlarm = {
  enabled: true,
  // 평일 아침 출근 시간대를 기본값으로 둡니다.
  days: [1, 2, 3, 4, 5],
  startMinutes: 7 * 60,
  endMinutes: 8 * 60,
  intervalSec: 60,
  notifyFromMinutes: 10,
};

/**
 * 지금 이 즐겨찾기가 알림 대상인지 판정합니다.
 *
 * 자정을 넘는 시간대(예: 23:00~01:00)는 시작 이후 또는 끝 이전이면 활성으로
 * 봅니다. 요일은 현재 시각의 요일만 봅니다 (자정 넘김의 요일 경계는 따지지
 * 않는 단순한 규칙입니다).
 */
export function isAlarmActiveAt(alarm: FavoriteAlarm, date: Date): boolean {
  if (!alarm.enabled) {
    return false;
  }
  if (!alarm.days.includes(date.getDay())) {
    return false;
  }
  const t = date.getHours() * 60 + date.getMinutes();
  const { startMinutes: start, endMinutes: end } = alarm;
  return start <= end ? t >= start && t <= end : t >= start || t <= end;
}

/**
 * 지금부터 leadMinutes 안에 활성 구간이 시작되는지 (오늘 요일 기준).
 *
 * 포그라운드 서비스를 "곧 시작될 시간대"에 미리 띄워두기 위해 씁니다.
 * 이미 활성인 경우는 isAlarmActiveAt 이 담당하므로 여기서는 false 입니다.
 */
export function alarmStartsWithin(
  alarm: FavoriteAlarm,
  date: Date,
  leadMinutes: number,
): boolean {
  if (!alarm.enabled || !alarm.days.includes(date.getDay())) {
    return false;
  }
  const t = date.getHours() * 60 + date.getMinutes();
  const diff = alarm.startMinutes - t;
  return diff > 0 && diff <= leadMinutes;
}

/**
 * 여러 알람 중 가장 이른 "다음 활성 구간 시작 시각"을 구합니다.
 *
 * AlarmManager 예약 기동(포그라운드 서비스를 그 시각에 깨우기)에 씁니다.
 * from 이후(미포함)로 7일 안에 시작되는 구간이 없으면 null 입니다.
 */
export function nextAlarmStart(
  alarms: FavoriteAlarm[],
  from: Date,
): Date | null {
  let best: Date | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled || alarm.days.length === 0) {
      continue;
    }
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = new Date(from);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(
        Math.floor(alarm.startMinutes / 60),
        alarm.startMinutes % 60,
        0,
        0,
      );
      if (candidate <= from || !alarm.days.includes(candidate.getDay())) {
        continue;
      }
      if (!best || candidate < best) {
        best = candidate;
      }
      break; // 이 알람의 가장 이른 시작을 찾았으니 다음 알람으로
    }
  }
  return best;
}

/** 자정 기준 분 → "07:00" */
export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 화면에 요일을 표시할 순서 (월요일 시작) */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 요일 배열 → "평일" / "주말" / "매일" / "월·수·금" */
export function formatAlarmDays(days: number[]): string {
  if (days.length === 0) {
    return '요일 없음';
  }
  if (days.length === 7) {
    return '매일';
  }
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') {
    return '평일';
  }
  if (sorted.join(',') === '0,6') {
    return '주말';
  }
  return DAY_ORDER.filter(d => days.includes(d))
    .map(d => DAY_LABELS[d])
    .join('·');
}

export function formatIntervalSec(intervalSec: FavoriteAlarm['intervalSec']): string {
  return intervalSec === 30 ? '30초' : '1분';
}
