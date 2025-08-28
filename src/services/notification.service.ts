import { addDays, endOfMinute, startOfMinute, startOfMonth } from "date-fns";
import prisma, { Interval, NotificationResponseStatus, Prisma, RemindPeriod, Transaction } from "lib/prisma.js";
import transactionsService from "./transactions.service.js";
import scheduleService from "./schedule.service.js";
import { CreateNotificationDTO, GetNotificationsDTO, updatedNotificationGptDTO, updatedNotificationValidation } from "validatation/notification.validation.js";
import { badRequestError, notFoundError } from "errors/defaultErrors.js";
import { userDateTime } from "lib/date.js";
class NotificationService {
    constructor() { }

    async markNotificationAsSent(id: number) {
        await prisma.notifications.update({
            where: { id },
            data: { nextNotificationDate: new Date() }
        });
    }

    // ✅ Processa notificações do tipo CONFIRM que devem ser disparadas agora
    async processDueNotifications(date: Date) {
        const BATCH_SIZE = 100;
        let offset = 0;
        let hasMore = true;

        const from = startOfMinute(date);
        const to = endOfMinute(date);

        while (hasMore) {
            const dueNotifications = await prisma.notifications.findMany({
                take: BATCH_SIZE,
                skip: offset,
                where: {
                    purpose: "CONFIRM",
                    isFutureGoal: true,
                    nextNotificationDate: {
                        gte: from,
                        lte: to
                    },
                    recurrenceCount: {
                        gt: 0
                    },
                    deletedAt: null
                }
            });

            for (const notif of dueNotifications) {
                // 🔔 Dispara pergunta: "Você comprou?"
                // Atualiza próximo agendamento
                await prisma.notifications.update({
                    where: { id: notif.id },
                    data: {
                        nextNotificationDate: scheduleService.calculateNext(notif.nextNotificationDate!, notif.recurrenceIntervalDays),
                        recurrenceCount: { decrement: 1 }
                    }
                });
            }

            offset += BATCH_SIZE;
            hasMore = dueNotifications.length === BATCH_SIZE;
        }
    }

    // ✅ Cria notificação tipo CONFIRM (meta futura)
    async createFutureGoalNotification(
        createNotificationDTO: CreateNotificationDTO,
        userId: string
    ) {

        let interval = createNotificationDTO.period as RemindPeriod;

        const notification = await prisma.notifications.create({
            data: {
                description: createNotificationDTO.description,
                nextNotificationDate: createNotificationDTO.referenceDate,
                referenceDate: createNotificationDTO.referenceDate,
                recurrenceCount: createNotificationDTO.count,
                categoryId: createNotificationDTO.categoryId,
                recurrenceIntervalDays: interval,
                isFutureGoal: false,
                purpose: 'CONFIRM',
                type : createNotificationDTO.type,
                value: createNotificationDTO.value,
                userId: userId
            }
        });

        return notification

    }

    async createTransactionNotification(userId: string, createNotificationDTO: CreateNotificationDTO) {
        let interval = createNotificationDTO.period as RemindPeriod;

        if (!createNotificationDTO.transactionId) badRequestError("transactionId is required")

        const notification = await prisma.notifications.create({
            data: {
                description: createNotificationDTO.description,
                nextNotificationDate: createNotificationDTO.referenceDate,
                referenceDate: createNotificationDTO.referenceDate,
                recurrenceCount: createNotificationDTO.count,
                recurrenceIntervalDays: interval,
                categoryId: createNotificationDTO.categoryId,
                type: createNotificationDTO.type,
                isFutureGoal: true,
                purpose: 'INFO',
                value: createNotificationDTO.value,
                transactionId: createNotificationDTO.transactionId,
                userId: userId
            }
        });

        return notification
    }

    async createNotificationMessage(notificationId: number, whaId?: string) {
        let notification = await prisma.notifications.findUnique({
            where: { id: notificationId }
        });
        if (!notification) throw notFoundError("Notification not found");
        if (notification.deletedAt) throw notFoundError("Notification not found")
        let now = new Date();
        const status = notification.purpose === 'CONFIRM' ? "PENDING" : "ACCEPTED"
        let notificationMessage = await prisma.notificationMessage.create({
            data: {
                month: now,
                notificationId: notificationId,
                whaId,
                status,
                userId: notification.userId
            }
        })

        return notificationMessage
    }

    async createNextFutureGoalNotification(
        notificationId: number
    ) {
        let notification = await prisma.notifications.findUnique({
            where: { id: notificationId }
        });

        if (!notification) {
            throw notFoundError("Notification not found");
        }

        let interval = notification.recurrenceIntervalDays;
        let nextDate = scheduleService.calculateNext(notification.nextNotificationDate!, interval);

        await prisma.notifications.update({
            where: { id: notificationId },
            data: { nextNotificationDate: nextDate }
        });
    }

    async getGoalsNotificationsToSend() {
        const now = new Date();
        const confirms = await prisma.notifications.findMany({
            where: {
                nextNotificationDate: {
                    lte: now
                },
                deletedAt : null,
                active: true
            },
            include: {
                user: true,
            }
        })
        return confirms
    }

    async getNotifications(userId: string, getNotifications?: GetNotificationsDTO) {
        const search = getNotifications?.search;
        const active = getNotifications?.type
        const page = getNotifications?.page ?? 1;
        const perPage = getNotifications?.perPage ?? 10;
        const order = getNotifications?.order ?? "desc";
        const filter : Prisma.NotificationsWhereInput = {
                    userId: userId,
                    ...(search ? { description: { contains: search, mode: 'insensitive' } } : {}),
                    ...(active !== undefined ? { active : active === "active" ? true : false } : {}),
                    deletedAt: null,
        }
        const [notifications, total] = await prisma.$transaction([
            prisma.notifications.findMany({
                where: filter,
                take: perPage,
                skip: (page - 1) * perPage,
                orderBy: {
                    nextNotificationDate: order
                },
                include: {
                    category: true
                }
            }),
            prisma.notifications.count({
                where: filter
            }),
        ])

        const pageInfo = { 
            totalPages : Math.ceil(total/perPage),
            hasNextPage : page * perPage < total,
            hasPreviousPage : page > 1,
            totalNotifications : total
        }

        return { notifications, pageInfo };
    }

    async GetNotificationMessages(userId: string) {
        let notificationMessages = await prisma.notificationMessage.findMany({
            where: {
                userId,
                notification: {
                    active: true,
                    deletedAt: null
                }
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 15,
            select: {
                id: true,
                status: true,
                createdAt: true,
                notification: {
                    select: {
                        purpose: true,
                        id: true,
                        description: true
                    }
                }
            }
        })

        return notificationMessages
    }

    async changeNotificationActivation(notificationId: number) {

        let notification = await prisma.notifications.findUnique({
            where: {
                id: notificationId,
            }
        })

        if (!notification) throw notFoundError("Notification not found")


        if (notification.notificationTimes === notification.recurrenceCount) throw badRequestError("Essa notificações não pode ser ativada, pois ela foi concluida")

        await prisma.notifications.update({
            where: {
                id: notificationId
            },
            data: {
                active: !notification.active
            }
        })
    }

    async updateNotificationMessageStatus(notificationMessageId: number, status: NotificationResponseStatus) {
        let notificationMessage = await prisma.notificationMessage.findUnique({
            where: {
                id: notificationMessageId,
                notification: {
                    deletedAt: null
                }
            },
            include: {
                notification: true,
            }
        })

        if (!notificationMessage) throw notFoundError("Notification message not found")

        if (notificationMessage.status !== "PENDING") throw badRequestError("Essa notificação message nao pode ser atualizada / não esta pendente")

        await prisma.notificationMessage.update({
            where: {
                id: notificationMessageId
            },
            data: {
                status
            }
        })

        if (status === "ACCEPTED") {
            await transactionsService.createNotificationParcel(notificationMessage.notification.id)
        }
    }

    async deleteNotification(notificationId: number, userId: string) {
        let notification = await prisma.notifications.findUnique({
            where: {
                id: notificationId,
                userId
            }
        })

        if (!notification) throw notFoundError("Notification not found")

        await prisma.notifications.update({
            where: {
                id: notificationId
            },
            data: {
                deletedAt: new Date()
            }
        })
    }

    async updateNotification(userId: string, updateNotificationDTO: updatedNotificationValidation, notificationId : number) {

        let notification = await prisma.notifications.findUnique({
            where: {
                id: notificationId,
                userId,
                deletedAt : null
            },
            include: {
                transaction: {
                    include: {
                        parcels: true
                    }
                },
                user : true,
            }
        })
        if (!notification) throw notFoundError("Notification not found")
        if (notification.transaction && updateNotificationDTO.notificationTimes && notification.transaction.parcels.length > updateNotificationDTO.notificationTimes) throw badRequestError("Essa notificação nao pode ser atualizada, pois ela ja possui mais parcelas do que a nova contagem de parcelas")
        let dateToSend : string | undefined

        if(updateNotificationDTO.referenceDate) {
           dateToSend  = userDateTime(updateNotificationDTO.referenceDate, notification.user.timeZone || 'America/Sao_Paulo').databaseDate
        }

        let not = await prisma.notifications.update({
            where: {
                id: notificationId
            },
            data: {
                value: updateNotificationDTO.value,
                description: updateNotificationDTO.description, 
                type: updateNotificationDTO.type,
                categoryId: updateNotificationDTO.categoryId,
                notificationTimes: updateNotificationDTO.notificationTimes,
                ...(notification.notificationTimes > 0 && { referenceDate: dateToSend, }),
                nextNotificationDate : dateToSend,
                recurrenceCount : updateNotificationDTO.count,
            },
            include : { 
                transaction : true
            }
        })

        if(notification.transaction && updateNotificationDTO.type &&  notification.type !== updateNotificationDTO.type) { 
            await prisma.transaction.update({
                where : {
                    id : notification.transaction.id
                },
                data : {
                    type : updateNotificationDTO.type
                }
            })
        }

        return not

    }

    async getNotification(userId: string, id: number) {
        let notificatation = await prisma.notifications.findUnique({
            where: {
                userId,
                id
            }
        })

        return notificatation
    }
}

export default new NotificationService();