import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { QuoteLineItem } from '@/features/booking/api/bookingApi';
import { getCompareIds, setCompare } from '@/features/booking/api/bookingApi';

type BookingState = {
  compareIds: string[];
  toggleCompare: (id: string) => Promise<void>;
  setCompareIds: (ids: string[]) => void;
  quoteDraft: QuoteDraft;
  setQuoteDraft: (draft: QuoteDraft) => void;
};

export type QuoteSpec = {
  durationMinutes: number;
  headcount: number;
  toolsMode: 'provider' | 'customer';
  addOnIds: string[];
  serviceId?: string;
};

export type QuoteDraft = {
  spec: QuoteSpec | null;
  lineItems?: QuoteLineItem[];
  bookingRequestedAt: string | null;
  slotId: string | null;
  slotStart: string | null;
  quoteSignature: string | null;
  jurisdictionId: string | null;
  milesFromDepot: number | null;
  sameDayPriority?: boolean;
  taxEnabled?: boolean;
};

const BookingContext = createContext<BookingState | null>(null);

function nextCompareIds(current: string[], id: string) {
  if (current.includes(id)) {
    return current.filter((item) => item !== id);
  }
  if (current.length >= 5) {
    return current;
  }
  return [...current, id];
}

export function BookingProvider({ children }: PropsWithChildren) {
  const [compareIds, setCompareIdsState] = useState<string[]>([]);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>({
    spec: null,
    lineItems: undefined,
    bookingRequestedAt: null,
    slotId: null,
    slotStart: null,
    quoteSignature: null,
    jurisdictionId: null,
    milesFromDepot: null,
    sameDayPriority: false,
    taxEnabled: true,
  });

  useEffect(() => {
    let cancelled = false;
    getCompareIds()
      .then((ids) => {
        if (!cancelled) {
          setCompareIdsState(ids);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompareIdsState([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCompare = useCallback(async (id: string) => {
    const desired = nextCompareIds(compareIds, id);
    if (desired.length === compareIds.length && desired.every((item, index) => item === compareIds[index])) {
      return;
    }
    const persistedIds = await setCompare(desired);
    setCompareIdsState(persistedIds);
  }, [compareIds]);

  const value = useMemo<BookingState>(() => ({
    compareIds,
    toggleCompare,
    setCompareIds: setCompareIdsState,
    quoteDraft,
    setQuoteDraft,
  }), [compareIds, quoteDraft, toggleCompare]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const value = useContext(BookingContext);
  if (!value) throw new Error('useBooking must be used within BookingProvider');
  return value;
}
