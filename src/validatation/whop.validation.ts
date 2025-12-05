import { z } from "zod";

/**
 * Schema para validação de webhook do Whop
 */
export const whopWebhookValidation = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      username: z.string().optional(),
    }).optional(),
    membership: z.object({
      id: z.string(),
      user_id: z.string(),
      product_id: z.string(),
      plan_id: z.string().optional(),
      status: z.string(),
      valid: z.boolean(),
      expires_at: z.number().optional(),
      email: z.string().email().optional(),
    }).optional(),
    payment: z.object({
      id: z.string(),
      amount: z.number(),
      currency: z.string(),
      status: z.string(),
    }).optional(),
  }),
});

/**
 * Schema para checkout (se precisar criar endpoint customizado)
 */
export const whopCheckoutValidation = z.object({
  email: z.string().email(),
  planId: z.string().describe("ID do plano/produto no Whop"),
});

/**
 * Schema para resposta de checkout
 */
export const whopCheckoutResponse = z.object({
  url: z.string().url(),
});

/**
 * Schema para verificar acesso
 */
export const whopCheckAccessValidation = z.object({
  productId: z.string(),
});

/**
 * Schema para resposta de verificação de acesso
 */
export const whopAccessResponse = z.object({
  hasAccess: z.boolean(),
  accessLevel: z.enum(["customer", "admin", "no_access"]),
});

// Types exportados
export type WhopWebhook = z.infer<typeof whopWebhookValidation>;
export type WhopCheckout = z.infer<typeof whopCheckoutValidation>;
export type WhopCheckoutResponse = z.infer<typeof whopCheckoutResponse>;
export type WhopCheckAccess = z.infer<typeof whopCheckAccessValidation>;
export type WhopAccessResponse = z.infer<typeof whopAccessResponse>;
