/**
 * Tipos para Webhooks do Whop
 * Baseado na documentação oficial: https://dev.whop.com/api-reference/v5/webhooks/overview
 */

export interface WhopUser {
  id: string;
  email: string;
  username?: string;
  name?: string;
  profile_pic_url?: string;
}

export interface WhopPlan {
  id: string;
  name?: string;
  visibility?: string;
}

export interface WhopCompany {
  id: string;
  name?: string;
}

export interface WhopExperience {
  id: string;
  name?: string;
}

export interface WhopMembership {
  id: string;
  user: WhopUser;
  plan: WhopPlan;
  company?: WhopCompany;
  experience?: WhopExperience;
  status: "active" | "expired" | "cancelled" | "trialing";
  license_key?: string;
  quantity: number;
  created_at: number; // Unix timestamp em segundos
  expires_at?: number; // Unix timestamp em segundos
  renewal_period_start?: number;
  renewal_period_end?: number;
  cancel_at_period_end: boolean;
  access_pass: {
    id: string;
    name?: string;
  };
}

export interface WhopPayment {
  id: string;
  final_amount: number; // valor em centavos
  subtotal: number;
  currency: string; // "usd", "brl", etc
  last4?: string; // últimos 4 dígitos do cartão
  stripe_invoice_id?: string;
  refunded_amount?: number;
  refunded_at?: number;
  status: "succeeded" | "pending" | "failed";
  user: WhopUser;
  created_at: number;
}

export interface WhopInvoice {
  id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  due_date?: number;
  paid_at?: number;
  created_at: number;
}

/**
 * Eventos de Webhook disponíveis no Whop
 */
export type WhopWebhookEvent =
  // Memberships
  | "membership_activated"
  | "membership_deactivated"

  // Payments
  | "payment_succeeded"
  | "payment_failed"
  | "payment_pending"

  // Invoices
  | "invoice_created"
  | "invoice_paid"
  | "invoice_past_due"
  | "invoice_voided"

  // Outros (opcionais)
  | "entry_created"
  | "entry_approved"
  | "entry_denied"
  | "entry_deleted"
  | "setup_intent_requires_action"
  | "setup_intent_succeeded"
  | "setup_intent_canceled"
  | "withdrawal_created"
  | "withdrawal_updated"
  | "course_lesson_interaction_completed"
  | "dispute_created"
  | "dispute_updated"
  | "refund_created"
  | "refund_updated";

/**
 * Estrutura genérica do Webhook do Whop
 */
export interface WhopWebhook<T = any> {
  action: WhopWebhookEvent;
  data: T;
  id: string; // ID do evento
  created_at: number; // timestamp Unix em segundos
}

/**
 * Webhooks específicos
 */
export type WhopMembershipActivatedWebhook = WhopWebhook<WhopMembership>;
export type WhopMembershipDeactivatedWebhook = WhopWebhook<WhopMembership>;
export type WhopPaymentSucceededWebhook = WhopWebhook<WhopPayment>;
export type WhopPaymentFailedWebhook = WhopWebhook<WhopPayment>;
export type WhopInvoicePaidWebhook = WhopWebhook<WhopInvoice>;

/**
 * Helper type para validar payload
 */
export type WhopWebhookPayload =
  | WhopMembershipActivatedWebhook
  | WhopMembershipDeactivatedWebhook
  | WhopPaymentSucceededWebhook
  | WhopPaymentFailedWebhook
  | WhopInvoicePaidWebhook;

export interface WhopPaymentSucceededEvent {
  id: string;
  api_version: string;
  timestamp: string;
  type: "payment.succeeded";
  data: WhopPaymentData;
}

export interface WhopPaymentData {
  id: string; // payment ID (pay_xxx)
  status: string;
  substatus: string | null;
  refundable: boolean;
  retryable: boolean;
  voidable: boolean;

  created_at: string;
  paid_at: string | null;
  last_payment_attempt: string | null;

  dispute_alerted_at?: string | null;
  refunded_at?: string | null;

  plan?: {
    id: string;
  };

  product: {
    id: string;
    title: string;
    route: string;
  };

  user: {
    id: string;
    name: string;
    username: string;
    email: string;
  };

  membership?: {
    id: string;
    status: string;
  };

  member?: {
    id: string;
    phone?: string;
  };

  payment_method?: {
    id: string;
    created_at: string;
    payment_method_type: string;
    card?: WhopCardInfo;
  };

  company: {
    id: string;
    title: string;
    route: string;
  };

  promo_code?: {
    id: string;
    code: string;
    amount_off: number;
    base_currency: string;
    promo_type: string;
    number_of_intervals: number;
  };

  currency: string;
  total: number;
  subtotal: number;
  usd_total: number;

  refunded_amount?: number;
  auto_refunded?: boolean;

  amount_after_fees: number;
  card_brand?: string;
  card_last4?: string;

  billing_address?: WhopBillingAddress;

  payment_method_type: string;
  billing_reason: string;

  failure_message?: string | null;

  metadata?: Record<string, any>;
}

export interface WhopBillingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface WhopCardInfo {
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  fingerprint?: string;
}
