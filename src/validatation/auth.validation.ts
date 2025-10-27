import { z } from "zod";

export const authActivateValidation = z.object({ token: z.string() });

export const createCheckoutWithEmail = z.object({ email : z.string().email(), plan : z.enum(['anual', 'trimestral']), phone : z.string() })

export type createCheckoutWithEmail = z.infer<typeof createCheckoutWithEmail>

export const authValidationNumberCode = z.object({ code : z.string() })

export type authValidationNumberCode = z.infer<typeof authValidationNumberCode>