export interface MonetaryValue {
  value: number;
  currency_value: string; // ex: 'BRL', 'USD'
}

export interface Country {
  name: string; // 'Brasil'
  iso: string; // 'BR'
}

export interface Address {
  city: string;
  country: string; // 'Brasil'
  country_iso: string; // 'BR'
  zipcode: string;
  address: string;
  complement: string;
}

export interface ProductInfo {
  id: number;
  ucode: string;
  name: string;
  has_co_production: boolean;
  is_physical_product: boolean;
}

export interface AffiliateInfo {
  affiliate_code: string;
  name: string;
}

export interface BuyerInfo {
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  checkout_phone_code: string; // '43'
  checkout_phone: string; // '43999033233'
  address: Address;
  document: string;
  document_type: string;
}

export interface ProducerInfo {
  name: string;
  document: string; // CPF/CNPJ como string
  legal_nature: string; // 'Pessoa Jurídica' | 'Pessoa Física' | ...
}

export interface CommissionInfo {
  value: number;
  source: string; // 'MARKETPLACE' | 'PRODUCER' | ...
  currency_value: string; // 'BRL' | ...
}

export interface PaymentInfo {
  installments_number: number;
  refusal_reason?: string;
  type: string; // 'CREDIT_CARD' | 'PIX' | 'BILLET' ...
}

export interface OfferInfo {
  code: string;
}

export interface PurchaseInfo {
  full_price: MonetaryValue;
  price: MonetaryValue;
  checkout_country: Country;
  order_bump: { is_order_bump: boolean };
  original_offer_price?: MonetaryValue;
  order_date: number; // epoch ms
  status: string; // 'APPROVED' | 'CANCELED' | ...
  transaction: string;
  payment: PaymentInfo;
  offer?: OfferInfo;
  invoice_by?: string; // 'HOTMART' | ...
  subscription_anticipation_purchase?: boolean;
  is_funnel?: boolean;
  business_model?: string;
}

export interface PlanInfo {
  id: number;
  name: string;
}

export interface SubscriptionInfo { 
  plan : PlanInfo,
  status : string
}

export interface PurchaseData {
  product: ProductInfo;
  affiliates: AffiliateInfo[];
  buyer: BuyerInfo;
  producer: ProducerInfo;
  commissions: CommissionInfo[];
  purchase: PurchaseInfo;
  subscription : SubscriptionInfo
}

export interface HotmartPurchaseWebhook {
  id: string;
  creation_date: number; // epoch ms
  event: string; // sempre começa com PURCHASE_
  version: string; // ex: '2.0.0'
  data: PurchaseData;
  hottok: string;
}