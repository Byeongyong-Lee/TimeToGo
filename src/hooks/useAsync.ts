import { useCallback, useEffect, useRef, useState } from 'react';

import { toErrorMessage } from '@/api/client';

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * 화면 진입 시 한 번 호출하고, 새로고침할 수 있는 최소한의 비동기 훅.
 *
 * 캐싱/재검증까지 필요해지면 @tanstack/react-query 로 갈아타는 걸 권장합니다.
 * (이 훅과 인터페이스가 비슷해서 교체 비용이 크지 않습니다.)
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // 언마운트 후 setState 를 막습니다.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (mounted.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (error) {
      if (mounted.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: toErrorMessage(error),
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refetch: run };
}
