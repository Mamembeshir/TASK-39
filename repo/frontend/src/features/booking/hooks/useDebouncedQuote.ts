import { useEffect, useRef, useState } from 'react';
import type { QuoteRequest, QuoteResponse } from '@/features/booking/api/bookingApi';
import { quote } from '@/features/booking/api/bookingApi';

export function useDebouncedQuote(input: QuoteRequest | null) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!input) return;
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setError(null);
      try {
        const result = await quote({ ...input, signal: controller.signal });
        setData(result);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError((cause as { message?: string })?.message ?? 'Quote failed');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [
    input?.bookingRequestedAt,
    input?.jurisdictionId,
    input?.milesFromDepot,
    input?.slotStart,
    input?.sameDayPriority,
    input?.taxEnabled,
    JSON.stringify(input?.lineItems),
  ]);

  return { data, isLoading, error };
}
