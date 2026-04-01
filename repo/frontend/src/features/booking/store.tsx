import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import type { QuoteLineItem } from '@/features/booking/api/bookingApi';

type BookingState = {
  compareIds: string[];
  toggleCompare: (id: string) => void;
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

  const value = useMemo<BookingState>(() => ({
    compareIds,
    toggleCompare: (id) => setCompareIdsState((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 5 ? current : [...current, id]),
    setCompareIds: setCompareIdsState,
    quoteDraft,
    setQuoteDraft,
  }), [compareIds, quoteDraft]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const value = useContext(BookingContext);
  if (!value) throw new Error('useBooking must be used within BookingProvider');
  return value;
}
