// hooks/useClaudeAI.ts
// Shared hook for all Claude AI features.
// Calls POST /ai/claude with { feature, payload } and manages loading/error state.
//
// Usage:
//   const { ask, loading, result, error, reset } = useClaudeAI<SchedulingResult>();
//   const data = await ask('smart_scheduling', payload);
import axios from 'axios';
import { useCallback, useState } from 'react';

export type AIFeature =
  | 'smart_scheduling'
  | 'demand_prediction'
  | 'dynamic_pricing';

export type UseClaudeAI<T> = {
  loading: boolean;
  result:  T | null;
  error:   string | null;
  ask:     (feature: AIFeature, payload: object) => Promise<T | null>;
  reset:   () => void;
};

export function useClaudeAI<T = unknown>(): UseClaudeAI<T> {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<T | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const ask = useCallback(async (
    feature: AIFeature,
    payload: object
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await axios.post<{ result: T }>(
        '/ai/claude',
        { feature, payload }
      );
      setResult(data.result);
      return data.result;
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'AI request failed. Please try again.';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, ask, reset };
}
