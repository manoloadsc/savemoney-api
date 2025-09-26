import { FastifyInstance } from "fastify";
import hotmartSevice from "services/hotmart.sevice.js";

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

export interface PurchaseData {
  product: ProductInfo;
  affiliates: AffiliateInfo[];
  buyer: BuyerInfo;
  producer: ProducerInfo;
  commissions: CommissionInfo[];
  purchase: PurchaseInfo;
}

export interface HotmartPurchaseWebhook {
  id: string;
  creation_date: number; // epoch ms
  event: string; // sempre começa com PURCHASE_
  version: string; // ex: '2.0.0'
  data: PurchaseData;
  hottok: string;
}

export default async function hotmartRoutes(app: FastifyInstance) {
  app.post<{ Body: HotmartPurchaseWebhook }>("/webhook", async (req, reply) => {
    const { data, event, hottok } = req.body;

    // 1) valida token do webhook
    if (hotmartSevice.validateHottok(hottok)) {
      // retorna 200 para não ficar reentregando, mas não processa
      return reply.code(200).send("IGNORED");
    }

    // 2) roteia eventos
    switch (event) {
      case "PURCHASE_APPROVED":
        await hotmartSevice.purchasedApproved(data);
        break;
      case "PURCHASE_CANCELED":
      case "PURCHASE_REFUNDED":
      case "PURCHASE_CHARGEBACK":
      case "PURCHASE_EXPIRED":
        await hotmartSevice.purchasedCanceled(data);
        break;
      default:
        break;
    }

    return reply.code(200).send("OK");
  });
}
