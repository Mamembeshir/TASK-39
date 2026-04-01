import { client } from '@/api/client';
import type { QuoteLineItem, QuoteResponse } from '@/features/booking/api/bookingApi';

export type OrderCreateInput = {
  lineItems: QuoteLineItem[];
  slotId: string;
  bookingRequestedAt?: string;
  milesFromDepot?: number;
  jurisdictionId?: string;
  sameDayPriority?: boolean;
  taxEnabled?: boolean;
  quoteSignature: string;
};

export type OrderSummary = {
  id: string;
  status?: string;
  total?: number;
};

export type OrderDetail = OrderSummary & {
  lineItems?: QuoteLineItem[];
  quote?: QuoteResponse;
  alternatives?: unknown[];
};

export type CapacitySlot = {
  id: string;
  serviceId?: string | null;
  startTime: string;
  remainingCapacity: number;
};

type OrderCreateResponse = {
  orderId?: string;
  state?: string;
  expiresAt?: string;
  quoteSignature?: string;
};

type OrderGetResponse = {
  order?: {
    id?: string;
    state?: string;
    pricingSnapshot?: { total?: number };
    lineItems?: QuoteLineItem[];
    quote?: QuoteResponse;
  };
};

export function createOrder(body: OrderCreateInput) {
  return client.withAuth().request<OrderCreateResponse>({ method: 'POST', path: '/api/orders', body }).then((response) => ({
    id: response?.orderId ?? '',
    status: response?.state,
  }));
}

export function listOrders() {
  return client.withAuth().request<OrderSummary[]>({ method: 'GET', path: '/api/orders' }).then((response) => (Array.isArray(response) ? response : []));
}

export function getOrder(id: string) {
  return client.withAuth().request<OrderGetResponse>({ method: 'GET', path: `/api/orders/${id}` }).then((response) => ({
    id: response?.order?.id ?? id,
    status: response?.order?.state,
    total: response?.order?.pricingSnapshot?.total,
    lineItems: response?.order?.lineItems,
    quote: response?.order?.quote,
  }));
}

export function listCapacitySlots() {
  return client.withAuth().request<CapacitySlot[]>({ method: 'GET', path: '/api/staff/orders/slots' }).then((response) => (Array.isArray(response) ? response : []));
}

export function createCapacitySlot(body: { serviceId: string; startTime: string; remainingCapacity: number }) {
  return client.withAuth().request<{ id: string }>({ method: 'POST', path: '/api/staff/orders/slots', body });
}

export function updateCapacitySlot(id: string, body: { startTime: string; remainingCapacity: number }) {
  return client.withAuth().request<{ id: string }>({ method: 'POST', path: `/api/staff/orders/slots/${id}`, body });
}

export function deleteCapacitySlot(id: string) {
  return client.withAuth().request<{ status: string }>({ method: 'DELETE', path: `/api/staff/orders/slots/${id}` });
}

export function completeOrderById(id: string) {
  return client.withAuth().request<{ status: string; state: string }>({ method: 'POST', path: `/api/staff/orders/${id}/complete` });
}
