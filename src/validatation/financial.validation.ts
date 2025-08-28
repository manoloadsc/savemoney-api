import { z } from "zod";
import { FinancialType } from "lib/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import { coerceToDate, coerceToDateWithTz } from "utils/coerceToDate.js";

export const gptCreateTransictionValidation = z.object({
    value: z.number().transform(value => Decimal(value)).refine(value => !value.equals(0), { message: "O valor deve ser maior que zero" }),
    type: z.enum([FinancialType.GASTO, FinancialType.GANHO]),
    recurringType: z.enum(["DIARY", "WEECKLY", "MONTHLY", "YEARLY"]),
    description: z.string().min(5, { message: "A descrição deve ter pelo menos 5 caracteres" }),
    recurring: z.number().min(1).default(1),
    categoryId: z.number(),
})

export const transactionAnalysisValidation = (timeZone : string) => {
    return z.object({
        dataInicial: coerceToDateWithTz(timeZone).optional(),
        dataFinal: coerceToDateWithTz(timeZone).optional(),
        categoryId: z.array(z.number()).optional(),
        type: z.enum([FinancialType.GASTO, FinancialType.GANHO]).optional(),
        description: z
            .string()
            .optional(),
    });
};


export const listTransactionsByDescriptionValidation = z.object({
    descriptionKeys: z.string(),
})

export const updateEntryFieldValidation = z.object({
    id: z.number(),
    new_description: z.string().optional(),
    new_value: z.number().optional(),
    startDate: z.string().transform(value => new Date(value)).optional(),
    categoryId: z.number().optional()
})
