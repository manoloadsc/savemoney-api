import { z } from "zod";

export const dashboardResumeValidation = z.object({
  page: z.number().default(1),
  perPage: z.number().default(10),
  search: z.string().optional(),
  startDate: z.string().datetime().optional().transform(str => str ? new Date(str) : undefined),
  endDate: z.string().datetime().optional().transform(str => str ? new Date(str) : undefined),
  searchType: z.enum(["7days", "today", "month", "year", "all", "custom"]).default("all"),
})

export const dayGroupSchema = z.object({
  date: z.string().min(10), // formato 'YYYY-MM-DD'
  ganho: z.number(),
  gasto: z.number(),
  countGanho: z.number().int().nonnegative(),
  countGasto: z.number().int().nonnegative(),
  balance: z.number(),
});

export type dayGroupSchema = z.infer<typeof dayGroupSchema>

export type DashboardResumeDTO = z.infer<typeof dashboardResumeValidation>

const groupSumSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const groupSubSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const parcelSchema = z.object({
  date: z.string().datetime(),
  description: z.string().optional(),
  valor: z.string(),
  parcelInfo: z.string(),
  category: z.string(),
  type: z.enum(["GASTO", "GANHO"]),
});

export const dashboardSchema = z.object({
  receitas: z.string(),
  gastos: z.string(),
  balance: z.string(),
  total: z.string(),
  byGroupSumExpenses: z.array(groupSumSchema),
  byGroupSumReceipts: z.array(groupSubSchema),
  parcelsToSend: z.array(parcelSchema),
  totalTransactionsCount : z.number(),
  byDay : z.array(dayGroupSchema),
});

export type dashboardSchema = z.infer<typeof dashboardSchema>