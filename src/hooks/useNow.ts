import { useEffect, useState } from 'react';

/**
 * 일정 간격으로 갱신되는 현재 시각(ms).
 *
 * 도착까지 남은 시간을 초 단위로 깎아 보여주기 위해 씁니다.
 * 조회 시점(fetchedAt)과의 차이만큼 secondsLeft 에서 빼는 식입니다.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
