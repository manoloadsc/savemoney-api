import { Decimal } from "@prisma/client/runtime/library";
import { Interval } from "lib/prisma.js";
import { z } from "zod";

export const createNotificationValidation = z.object({
  period: z.enum(Object.values(Interval) as [string, ...string[]]),
  referenceDate: z.string().transform(value => new Date(value).toISOString()),
  description: z.string().min(5, { message: "A descrição deve ter pelo menos 5 caracteres" }),
  count: z.number().min(1),
  transactionId: z.number().optional(),
  categoryId: z.number(),
  type: z.enum(["GASTO", "GANHO"]),
  value: z.number().transform(value => Decimal(value))
})

export type CreateNotificationDTO = z.infer<typeof createNotificationValidation>

export const getNotificationValidation = z.object({
  id: z.number()
})

export const getNotificationsValidation = z.object({
  page: z.number().default(1),
  perPage: z.number().default(10),
  search: z.string().optional(),
  type: z.enum(["active", "inactive"]).optional(),
  order: z.enum(["asc", "desc"]).default("desc")
})


export const notificationSchema = z.object({
  id: z.number(),
  description: z.string(),
  purpose: z.enum(["CONFIRM", "REMINDER", "ALERT"]).optional().default("CONFIRM"), // se for sempre "CONFIRM", pode deixar fixo
  isFutureGoal: z.boolean(),
  recurrenceIntervalDays: z.enum(["DAILY", "WEEKLY", "MONTHLY", "WEECKLY"]), // "WEECKLY" está escrito assim mesmo?
  recurrenceCount: z.number(),
  notificationTimes: z.number(),
  userId: z.string().uuid(),
  active: z.boolean(),
  value: z.string(),
  type: z.enum(["GASTO", "GANHO"]),
  categoryId: z.number(),
  referenceDate: z.string().datetime(),
  nextNotificationDate: z.string().datetime(),
  transactionId: z.number().nullable(),
});

export const updateNotificationValidation = z.object({
  value: z.number().transform(value => Decimal(value)).refine(value => !value.equals(0), { message: "O valor deve ser maior que zero" }).optional(),
  description: z.string().min(5, { message: "A descrição deve ter pelo menos 5 caracteres" }).optional(),
  type: z.enum(["GASTO", "GANHO"]).optional(),
  categoryId: z.number().optional(),
  count : z.number().min(1).optional(),
  notificationTimes: z.number().min(1).optional(),
  referenceDate: z.string().nullish().transform(value => typeof value !== "string" ? undefined : value)
});

export const updateNotificationValidationGpt = z.object({
  id: z.number(),
  value: z.number().transform(value => Decimal(value)).refine(value => !value.equals(0), { message: "O valor deve ser maior que zero" }).optional(),
  description: z.string().min(5, { message: "A descrição deve ter pelo menos 5 caracteres" }).optional(),
  type: z.enum(["GASTO", "GANHO"]).optional(),
  categoryId: z.number().optional(),
  notificationTimes: z.number().min(1).optional(),
  count : z.number().min(1).optional(),
  referenceDate: z.string().transform((value) => new Date(value).toISOString()).optional()
});
export type updatedNotificationValidation = z.infer<typeof updateNotificationValidation>;
export type updatedNotificationGptDTO = z.infer<typeof updateNotificationValidationGpt>;

export type GetNotificationsDTO = z.infer<typeof getNotificationsValidation>;

const notificationSummarySchema = z.object({ 
  id: z.number(),
  purpose: z.enum(["CONFIRM", "REMINDER", "ALERT"]).optional().default("CONFIRM"),
  description: z.string(),
});

const confirmationSchema = z.object({
  id: z.number(),
  status: z.enum(["ACCEPTED", "REJECTED", "PENDING"]), // ajuste se houver mais status possíveis
  createdAt: z.string().datetime(),
  notification: notificationSummarySchema,
});

export const confirmationsResponseSchema = z.array(confirmationSchema);

export const NotificationResponseSchema = z.object({
  id: z.number(),
  description: z.string(),
  purpose: z.enum(["INFO", "CONFIRM", "ALERT"]), // ajuste conforme os valores possíveis
  recurrenceIntervalDays: z.enum(["DIARY", "WEEKLY", "MONTHLY", "YEARLY"]), // ajuste se houver mais
  recurrenceCount: z.number(),
  notificationTimes: z.number(),
  userId: z.string().uuid(),
  active: z.boolean(),
  value: z.union([z.string(), z.number()]).transform(Number),
  type: z.enum(["GASTO", "GANHO"]), // ajuste conforme suas opções
  categoryId: z.number(),
  referenceDate: z.string().datetime(), // ou z.coerce.date() se quiser converter
  nextNotificationDate: z.string().datetime(),
  transactionId: z.number()
});
export const notificationsListResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  pageInfo: z.object({
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalNotifications: z.number()
  })
}) 