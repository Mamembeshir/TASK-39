import { client } from '@/api/client';
import { getService, type ServiceDetail, type ServiceSummary } from '@/features/catalog/api/catalogApi';

export type QuoteSpecInput = {
  serviceId: string;
  durationMinutes: number;
};

export type ServiceQuoteSpec = {
  headcount?: number;
  toolsMode?: 'provider' | 'customer';
  addOnIds?: string[];
};

export type QuoteLineItem =
  | {
      type: 'service';
      serviceId: string;
      durationMinutes: number;
      quantity: number;
      spec?: ServiceQuoteSpec;
    }
  | {
      type: 'bundle';
      bundleId: string;
      quantity: number;
      specs: QuoteSpecInput[];
    };

export type QuoteRequest = {
  lineItems: QuoteLineItem[];
  slotStart?: string;
  bookingRequestedAt?: string;
  milesFromDepot?: number;
  jurisdictionId?: string;
  sameDayPriority?: boolean;
  taxEnabled?: boolean;
  signal?: AbortSignal;
};

export type QuoteResponse = {
  total: number;
  quoteSignature?: string;
  subtotal?: number;
  tax?: number;
  travelFee?: number;
  sameDaySurcharge?: number;
  notServiceable?: boolean;
  taxBreakdown?: Array<{ label: string; amount: number }>;
  lineItems?: Array<{ serviceId?: string; bundleId?: string; amount: number }>;
};

type RawQuoteResponse = QuoteResponse & {
  totals?: {
    total?: number;
    subtotalBeforeTax?: number;
    tax?: number;
    travelFee?: number;
    sameDaySurcharge?: number;
    afterHoursSurcharge?: number;
  };
  itemizedLines?: Array<{ serviceId?: string; bundleId?: string; lineTotal?: number }>;
};

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function buildTaxBreakdown(raw: RawQuoteResponse) {
  if (Array.isArray(raw.taxBreakdown)) {
    return raw.taxBreakdown;
  }

  const rows: Array<{ label: string; amount: number }> = [];
  const subtotal = asNumber(raw.subtotal) ?? asNumber(raw.totals?.subtotalBeforeTax);
  const tax = asNumber(raw.tax) ?? asNumber(raw.totals?.tax);
  if (subtotal !== undefined) {
    rows.push({ label: 'Subtotal', amount: subtotal });
  }
  if (tax !== undefined) {
    rows.push({ label: 'Tax', amount: tax });
  }
  return rows.length > 0 ? rows : undefined;
}

function normalizeQuoteResponse(raw: RawQuoteResponse): QuoteResponse {
  const normalizedLineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems
    : Array.isArray(raw.itemizedLines)
      ? raw.itemizedLines.map((item) => ({
          serviceId: item.serviceId,
          bundleId: item.bundleId,
          amount: asNumber(item.lineTotal) ?? 0,
        }))
      : undefined;

  return {
    ...raw,
    total: asNumber(raw.total) ?? asNumber(raw.totals?.total) ?? 0,
    subtotal: asNumber(raw.subtotal) ?? asNumber(raw.totals?.subtotalBeforeTax),
    tax: asNumber(raw.tax) ?? asNumber(raw.totals?.tax),
    travelFee: asNumber(raw.travelFee) ?? asNumber(raw.totals?.travelFee),
    sameDaySurcharge: asNumber(raw.sameDaySurcharge) ?? asNumber(raw.totals?.sameDaySurcharge),
    taxBreakdown: buildTaxBreakdown(raw),
    lineItems: normalizedLineItems,
  };
}

export type CompareItem = ServiceSummary | ServiceDetail;
type CompareService = CompareItem;
type FavoritesResponse = { favorites?: CompareItem[] };
type CompareResponse = { serviceIds?: string[] };

export type QuoteSlot = {
  slotId: string;
  startTime: string;
  remainingCapacity: number;
};

export type QuoteJurisdiction = {
  id: string;
  name: string;
  taxRequired: boolean;
  taxRate: number;
};

export function listFavorites() {
  return client.withAuth().request<FavoritesResponse>({ method: 'GET', path: '/api/favorites' }).then((response) => (Array.isArray(response?.favorites) ? response.favorites : []));
}

export function addFavorite(serviceId: string) {
  return client.withAuth().request<void>({ method: 'POST', path: `/api/favorites/${serviceId}` });
}

export function removeFavorite(serviceId: string) {
  return client.withAuth().request<void>({ method: 'DELETE', path: `/api/favorites/${serviceId}` });
}

export function getCompareIds() {
  return client.withAuth().request<CompareResponse>({ method: 'GET', path: '/api/compare' }).then((response) => {
    const serviceIds = Array.isArray(response?.serviceIds) ? response.serviceIds : [];
    return serviceIds.slice(0, 5);
  });
}

export function getCompare() {
  return getCompareIds().then(async (serviceIds) => {
    if (serviceIds.length === 0) return [];

    const details = await Promise.all(serviceIds.map((serviceId) => getService(serviceId).catch(() => null)));

    return details.filter((item): item is CompareItem => Boolean(item));
  });
}

export function setCompare(serviceIds: string[]) {
  return client.withAuth().request<CompareResponse>({
    method: 'PUT',
    path: '/api/compare',
    body: { serviceIds },
  }).then((response) => {
    const nextIds = Array.isArray(response?.serviceIds) ? response.serviceIds : [];
    return nextIds.slice(0, 5);
  });
}

export function quote(body: QuoteRequest) {
  const { signal, ...json } = body;
  return client.withAuth().request<QuoteResponse>({
    method: 'POST',
    path: '/api/quote',
    body: json,
    signal,
  }).then((response) => normalizeQuoteResponse(response as RawQuoteResponse));
}

export function listQuoteSlots(serviceId: string, startAfter?: string) {
  return client.withAuth().request<{ slots: QuoteSlot[] }>({
    method: 'GET',
    path: '/api/quote/slots',
    query: {
      serviceId,
      startAfter,
      limit: 12,
    },
  }).then((response) => (Array.isArray(response?.slots) ? response.slots : []));
}

export function listQuoteJurisdictions() {
  return client.withAuth().request<{ jurisdictions: QuoteJurisdiction[] }>({
    method: 'GET',
    path: '/api/quote/jurisdictions',
  }).then((response) => (Array.isArray(response?.jurisdictions) ? response.jurisdictions : []));
}

export function listCompare() {
  return getCompare();
}
