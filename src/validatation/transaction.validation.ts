import { Decimal } from "@prisma/client/runtime/library";
import { coerceToDate } from "utils/coerceToDate.js";
import { z } from "zod";

export const createTransactionValidation = z.object({
    type : z.enum(["GASTO", "GANHO"]),
    description : z.string().min(5, { message : "A descrição deve ter pelo menos 5 caracteres" }),
    value : z.number().transform(value => Decimal(value)).refine(value => !value.equals(0), { message : "O valor deve ser maior que zero" }),
    categoryId : z.number(),
    recurring : z.number().min(1).default(1),
    recurringType : z.enum(["DIARY", "WEECKLY", "MONTHLY", "YEARLY"]),
    firstDate: z.string().nullable().optional()
});
  
export type createTransactionDTO = z.infer<typeof createTransactionValidation>

export const updateTransactionValidation = z.object({
    startDate : z.string().optional(),
    value : z.number().transform(value => Decimal(value)).refine(value => !value.equals(0), { message : "O valor deve ser maior que zero" }).optional(),
    description : z.string().min(5, { message : "A descrição deve ter pelo menos 5 caracteres" }).optional(),
    recurring : z.number().min(1).default(1).optional(),
    recurringType : z.enum(["DIARY", "WEECKLY", "MONTHLY", "YEARLY"]).optional(),
    categoryId  : z.number().optional(),
})

export const transactionListValidation = z.object({
  page: z.number().default(1),
  perPage: z.number().default(10),
  search: z.string().optional(),
  startDate: z.string().datetime().optional().transform(str => str ? new Date(str) : undefined),
  endDate: z.string().datetime().optional().transform(str => str ? new Date(str) : undefined),
  searchType: z.enum(["7days", "today", "month", "year", "all", "custom"]).default("all"),
  categoryId: z.array(z.number()).optional(),
  type : z.enum(["GASTO", "GANHO"]).optional()
})

export const getTransactionById = z.object({ id : z.string() })
export type getTransactionById = z.infer<typeof getTransactionById>

export const TransactionByIdResponse = z.object({
  id: z.number(),
  description: z.string(),
  type: z.enum(["GASTO", "GANHO"]), // adapte se houver mais tipos
  value: z.union([z.string(), z.number()]).transform(Number), // aceita string ou número, transforma para número
  recurrenceCount: z.number(),
  recurrenceInterval: z.enum(["DIARY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(), // ajuste conforme seus valores válidos
  userId: z.string().uuid(),
  active: z.boolean(),
  referenceDate: z.string().datetime(), // ou z.coerce.date() se quiser converter
  nextReferenceDate: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  categoryId: z.number(),
  parcels: z.array(z.any()), // substitua por schema real se necessário
  category: z.object({
    id: z.number(),
    name: z.string()
  })
});

export const updateParcelValidation = z.object({
    value : z.number().transform(value => Decimal(value)).refine(value => !value.equals(0), { message : "O valor deve ser maior que zero" }).optional(),
    date  : z.string().transform(value => new Date(value)).optional(),
    id : z.number()
})

export type updateParcelDTO = z.infer<typeof updateParcelValidation>

export type updateTransactionDTO = z.infer<typeof updateTransactionValidation>

// Categoria da transação
const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
});

// Parcela da transação
const parcelSchema = z.object({
  id: z.number(),
  transactionId: z.number(),
  notificationId: z.number().nullable(),
  userId: z.string().uuid(),
  value: z.string(),
  notified: z.boolean(),
  count : z.number(),
  createdAt: z.string().datetime(),
});

// Transação recorrente
const entrySchema = z.object({
  id: z.number(),
  description: z.string(),
  type: z.enum(["GASTO", "GANHO"]),
  value: z.string(),
  recurrenceCount: z.number(),
  recurrenceInterval: z.enum(["DIARY", "MONTHLY", "WEECKLY"]),
  userId: z.string().uuid(),
  active: z.boolean(),
  referenceDate: z.string().datetime(),
  nextReferenceDate: z.string().datetime(),
  categoryId: z.number(),
  category: categorySchema,
  parcelInfo : z.string(),
  parcels: z.array(parcelSchema),
});

// Paginação
const pageInfoSchema = z.object({
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  totalTransactions : z.number()
});

// Schema final de resposta
export const recurringEntriesResponseSchema = z.object({
  entries: z.array(entrySchema),
  pageInfo: pageInfoSchema,
});

export type entriesListDto = z.infer<typeof entrySchema>

const transactionSchema = z.object({
  id: z.number(),
  description: z.string(),
  type: z.enum(["GASTO", "GANHO"]),
  value: z.string(),
  recurrenceCount: z.number(),
  recurrenceInterval: z.enum(["DIARY", "MONTHLY", "WEECKLY"]),
  userId: z.string().uuid(),
  active: z.boolean(),
  referenceDate: z.string().datetime(),
  nextReferenceDate: z.string().datetime(),
  categoryId: z.number(),
});



export const transactionWithParcelResponseSchema = z.object({
  transaction: transactionSchema,
  parcel: parcelSchema.optional(),
});

export const deepAnalysisValidation = z.object({ 
  greetings: z.string().nonempty("greetings is required"),
  metrics: z.object({
    essentials:   z.string().nonempty("metrics.essentials is required"),
    leisure:      z.string().nonempty("metrics.leisure is required"),
    education:    z.string().nonempty("metrics.education is required"),
    investments:  z.string().nonempty("metrics.investments is required"),
    dreams:       z.string().nonempty("metrics.dreams is required"),
  }),
  prosperity: z.string().nonempty("prosperity is required"),
  emergency: z.object({
    monthlyCost:    z.number(),
    minReserve:     z.number(),
    idealReserve:   z.number(),
    currentReserve: z.number(),
    coverageMonths: z.number(),
    gapMin:         z.number(),
  }),
  plan: z.string().nonempty("plan is required"),
  actionPlan: z.array(z.string().nonempty()).nonempty("actionPlan must have at least one item"),
  next_30days: z.array(z.string().nonempty()).nonempty("next_30days must have at least one item"),
  resume : z.string().nonempty("resume is required"),
  next_90days: z.array(z.string().nonempty()).nonempty("next_90days must have at least one item").length(3),
  bye_message: z.string().nonempty("bye_message is required"),
})

export type deepAnalysisValidation = z.infer<typeof deepAnalysisValidation>