import { z } from "zod";

export const stripeNewCheckout = z.object({
    plan : z.enum(['anual', 'trimestral'])
})

export const stripeResponse = z.object({
    url : z.string()
})

export type stripeNewCheckout = z.infer<typeof stripeNewCheckout>;
export type newCheckoutResponse = z.infer<typeof stripeResponse>;