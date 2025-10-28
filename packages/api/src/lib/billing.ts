// Stub billing utilities
export const BILLING_INTERVALS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export const PLAN_TYPES = {
  ENTERPRISE: 'enterprise',
  FREE: 'free',
  PRO: 'pro',
} as const;

export function getFreePlanPriceId() {
  return 'price_free_stub';
}

export async function createSubscription(_params: Record<string, unknown>) {
  // Stub implementation
  return { id: 'sub_stub', status: 'active' };
}

export async function upsertStripeCustomer(_params: Record<string, unknown>) {
  // Stub implementation
  return { id: 'cus_stub' };
}

export namespace Stripe {
  export interface Customer {
    id: string;
  }
}
