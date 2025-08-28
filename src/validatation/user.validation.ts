import { badRequestError } from "errors/defaultErrors.js";
import parsePhoneNumberFromString from "libphonenumber-js";
import { validateTimezone } from "utils/insValidTimezone.js";
import { boolean, z } from "zod";

export const parseLogin = z.object({ email: z.string(), password: z.string(), timezone: z.string().refine((timezone) => validateTimezone(timezone), { message: "Fuso horário inválido" }).optional() });
export type parseLogin = z.infer<typeof parseLogin>;

enum Currency {
  USD = "USD", // Equador e EUA
  EUR = "EUR",
  BRL = "BRL",
  MXN = "MXN", // México
  CLP = "CLP", // Chile
  ARS = "ARS", // Argentina
  PYG = "PYG", // Paraguai
  COP = "COP", // Colômbia
  BOB = "BOB", // Bolívia
  UYU = "UYU", // Uruguai
  PEN = "PEN", // Peru
}

export const phoneSchema = z.string().transform((val) => {
  const cleaned = val.replace(/\s|-/g, "");
  const phoneNumber = parsePhoneNumberFromString(cleaned)
  if (!phoneNumber || !phoneNumber.isValid()) {
    throw badRequestError("Telefone inválido")
  }

  return phoneNumber.number
})

export const userValidation = z.object({
  name: z.string(),
  password: z.string()
    .min(10, { message: "A senha deve ter pelo menos 10 caracteres" })
    .regex(/[a-z]/, "Deve conter pelo menos uma letra minúscula")
    .regex(/[A-Z]/, "Deve conter pelo menos uma letra maiúscula")
    .regex(/\d/, "Deve conter pelo menos um número")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Deve conter pelo menos um caractere especial"),
  phone_number: phoneSchema,
  email: z.string().email("Não é um email válido"),
});

export const forgotEmailValidation = z.object({ email: z.string().email() });

export const changePassowordToken = z.object({ id: z.string(), email: z.string(), type: z.string() });

export const passwordValidation = z.object({ password: z.string() });

export type userValidationType = z.infer<typeof userValidation>;

export const userResponseSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  chat_id: z.string(), // pode vir com "+" e número
  active: z.boolean(),
  emailVerified: z.boolean(),
  numberVerified: z.boolean(),
  plan: z.enum(['anual', 'trimestral']).optional(),
  lang: z.enum(["pt", "en", "es"]),
  currency: z.nativeEnum(Currency),
  completeInformation: z.boolean(),
});

export const userUpdateSchema = z.object({
  name: z.string().optional(),
  lang: z.enum(["pt", "en", "es"]).optional(),
  currency: z.nativeEnum(Currency).optional(),
  completeInformation: boolean().optional(),
})

export type userUpdateSchema = z.infer<typeof userResponseSchema>
