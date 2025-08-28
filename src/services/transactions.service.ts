import { Decimal } from "@prisma/client/runtime/library";
import { badRequestError, notFoundError } from "errors/defaultErrors.js";
import prisma, { FinancialType, Parcels, Prisma, Transaction } from "lib/prisma.js";
import { TransactionDateFilterType } from "types/transaction.js";
import { getDateRangeByType, normalizeRangeToFullDays } from "utils/dateRange.js";
import { createTransactionDTO, updateParcelDTO, updateTransactionDTO } from "validatation/transaction.validation.js";
import scheduleService from "./schedule.service.js";
import notificationService from "./notification.service.js";
import { eachDayOfInterval } from "date-fns";
import { userDateTime } from "lib/date.js";

class TransactionService {
  constructor() { }

  async getTransactions(
    userId: string,
    limit: number,
    page: number,
    searchType: TransactionDateFilterType,
    startDate?: Date,
    endDate?: Date,
    search?: string,
    categoryId?: number[],
    type?: 'GASTO' | 'GANHO'
  ) {
    const dateRange = getDateRangeByType(searchType, startDate, endDate);
    const filter: Prisma.TransactionWhereInput = {
      userId,
      ...(dateRange ? {
        OR: [
          {
            parcels: {
              some: {
                createdAt: {
                  gte: dateRange.gte,
                  lte: dateRange.lte
                }
              }
            },
            deletedAt: null
          },
          {
            referenceDate: {
              gte: new Date()
            },
            deletedAt: null
          }
        ]
      } : {}),
      ...(search ? { description: { contains: search, mode: 'insensitive' }, } : {}),
      ...(categoryId ? { categoryId: { in: categoryId } } : {}),
      ...(type ? { type } : {})
    };

    const [entries, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where: filter,
        include: {
          category: true,
          parcels: {
            where: {
              createdAt: dateRange
            }
          },
          notifications: { select: { purpose: true, recurrenceCount: true } }
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.transaction.count({
        where: filter
      })
    ]);
    let totalCount = await this.allTransacionsByUserCount(userId)

    return {
      entries: entries,
      pageInfo: {
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
        totalTransactions: total
      }
    };
  }

  async allTimeBalance(userId: string) {
    let allTrasactions = await prisma.transaction.findMany({ where: { userId, deletedAt: null }, select: { parcels: true, type: true } })
    let allParcels = allTrasactions.flatMap(transaction => transaction.parcels.map(p => ({ ...p, type: transaction.type })))

    let balance = allParcels.reduce((acc, temp) => temp.type === 'GASTO' ? acc.minus(temp.value) : acc.plus(temp.value), new Decimal(0))
    return balance
  }

  async createTransaction(data: createTransactionDTO, userId: string) {
    const { description, categoryId, type, recurring, value, recurringType, firstDate } = data;

    if (firstDate && new Date(firstDate) < new Date()) {

    }
    if (new Date(firstDate!) < new Date()) {
      throw badRequestError("A data de início tem q ser maior q a data atual.")
    }

    const firstDateToSend = firstDate ? new Date(firstDate) : new Date()
    const nextReferenceDate = firstDate ? firstDate : scheduleService.calculateNext(firstDateToSend, recurringType);
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        description,
        categoryId,
        type,
        value: value,
        recurrenceCount: recurring,
        recurrenceInterval: recurringType,
        referenceDate: firstDateToSend,
        nextReferenceDate: nextReferenceDate
      },
      include: {
        category: true
      }
    });
    let parcel: Parcels | undefined
    if (!firstDate) {
      parcel = await prisma.parcels.create({
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
          value: transaction.value,
          notified: false,
          count: 1
        }
      });
    }

    let notificatation;
    if (data.recurring > 1) {
      notificatation = await notificationService.createTransactionNotification(userId, {
        transactionId: transaction.id, description, value: value, referenceDate: new Date(nextReferenceDate).toISOString(), count: recurring, period: recurringType, categoryId: transaction.categoryId, type: transaction.type
      });
    }


    return { transaction, notificatation, parcel };
  }

  async getTransaction(id: number, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { parcels: true, category: true, notifications: true }
    });
    if (!transaction || transaction.userId !== userId) throw notFoundError("Transaction not found");

    return transaction;
  }

  async createNextParcel(transactionId: number, userId: string) {
    const transaction = await this.getTransaction(transactionId, userId);

    const now = new Date();
    if (transaction.nextReferenceDate > now && (transaction.notifications && transaction.notifications.purpose === "INFO")) {
      return null
    };


    let parcelsExist = await prisma.parcels.count({
      where: {
        transactionId: transactionId
      }
    })

    const parcel = await prisma.parcels.create({
      data: {
        transactionId: transaction.id,
        userId: transaction.userId,
        notificationId: transaction.notifications ? transaction.notifications.id : null,
        value: transaction.value,
        count: parcelsExist + 1,
        notified: false
      }
    });

    const nextDate = scheduleService.calculateNext(transaction.nextReferenceDate, transaction.recurrenceInterval);

    let active = transaction.parcels.length + 1 === transaction.recurrenceCount ? false : true;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { nextReferenceDate: nextDate, active },
    });

    return parcel;
  }

  async getTransactionNeedNextParcelIds() {
    const transactions = await prisma.transaction.findMany({
      where: {
        nextReferenceDate: {
          lte: new Date()
        },
        recurrenceCount: { gt: 1 },
        notifications: {
          purpose: "INFO"
        },
        deletedAt: null
      },
      select: {
        id: true,
        userId: true
      }
    });

    return transactions;
  }

  async updateTransaction(data: updateTransactionDTO, userId: string, transactionId: number) {
    const { description, value, startDate, recurringType, categoryId, recurring } = data;

    // Busca a transação
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId, deletedAt: null },
      include: { parcels: true }
    });

    if (!transaction || transaction.userId !== userId) {
      throw notFoundError("Transaction not found");
    }

    // Busca o fuso horário do usuário
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { timeZone: true }
    });
    const timeZone = user?.timeZone || 'America/Sao_Paulo';

    let parsedDate: Date | undefined;
    if (startDate) {
      const { databaseDate } = userDateTime(startDate, timeZone);
      parsedDate = new Date(databaseDate);

      if (parsedDate < new Date()) {
        throw badRequestError("A data de início não pode ser menor que a data atual");
      }
    }

    // Atualiza a transação
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        description,
        value,
        ...(parsedDate && { nextReferenceDate: parsedDate }),
        recurrenceInterval: recurringType,
        categoryId,
        recurrenceCount: recurring,
      },
      include: {
        category: true
      }
    });
  }


  async createNotificationParcel(notificationId: number) {
    let notification = await prisma.notifications.findUnique({
      where: {
        id: notificationId,
        deletedAt: null
      }
    })
    if (!notification) throw notFoundError("Notification not found")

    let transactionId: number;
    let haveTransaction = await prisma.transaction.findFirst({
      where: {
        notifications: {
          id: notificationId
        },
        userId: notification.userId
      }
    })


    let remaing = notification.recurrenceCount! - notification.recurrenceCount!

    if (!haveTransaction) {
      let transaction = await this.createTransaction({
        description: notification.description,
        categoryId: notification.categoryId,
        type: notification.type,
        recurring: remaing,
        value: notification.value,
        recurringType: notification.recurrenceIntervalDays
      }, notification.userId)

      transactionId = transaction.transaction.id
    } else {
      transactionId = haveTransaction.id
    }

    await prisma.notifications.update({
      where: {
        id: notificationId
      },
      data: {
        transactionId
      }
    })

    await this.createNextParcel(transactionId, notification.userId)

  }

  async deleteTransaction(id: number, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id, deletedAt: null },

    });

    if (!transaction || transaction.userId !== userId) throw notFoundError("Transaction not found");

    let notificatation = await prisma.notifications.findUnique({
      where: {
        transactionId: id
      }
    })
    await prisma.parcels.updateMany({ where: { transactionId: id }, data: { deletedAt: new Date() } });
    if (!notificatation) {
      await prisma.notifications.updateMany({ where: { transactionId: id }, data: { deletedAt: new Date() } });
    }

    await prisma.transaction.delete({ where: { id } });

    return "deleted sucessfully"
  }

  async updateParcel(data: updateParcelDTO, userId: string) {
    const parcel = await prisma.parcels.findUnique({
      where: { id: data.id, userId, deletedAt: null },
    });

    if (!parcel) throw notFoundError("Parcel not found");

    let parcelUpdated = await prisma.parcels.update({
      where: { id: data.id },
      data: {
        ...(data.value && { value: data.value }),
        ...(data.date && { createdAt: data.date })
      }
    });

    return parcelUpdated
  }

  async deleteParcel(id: number, userId: string) {
    const parcel = await prisma.parcels.findUnique({
      where: { id, userId, deletedAt: null },
    });

    if (!parcel) throw notFoundError("Parcel not found");

    let parcelUpdated = await prisma.parcels.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return parcelUpdated
  }

  async listTransictionByKeys(keys: string[], userId: string) {
    let transactions = await prisma.transaction.findMany({
      where: {
        userId,
        description: {
          in: keys
        },
        deletedAt: null
      }
    })

    return transactions
  }

  async getLastByUserId(userId: string) {
    let transaction = await prisma.transaction.findFirst({
      where: {
        userId,
        deletedAt: null
      },
      orderBy: {
        id: "desc"
      }
    })

    return transaction
  }

  async getParcel(id: number, userId: string) {
    let parcel = await prisma.parcels.findUnique({
      where: {
        id,
        userId,
      },
      include: {
        transaction: true
      }
    })

    if (!parcel) throw notFoundError("Parcela não foi encontrada")

    return parcel
  }

  async allTransacionsByUserCount(userId: string) {
    return prisma.transaction.count({ where: { deletedAt: null, userId: userId, } })
  }

  async getTransactionByDateRange(userId: string, searchType: TransactionDateFilterType, startDate: Date, endDate: Date,) {
    const dateRange = getDateRangeByType(searchType, startDate, endDate);
    let daysInRange = eachDayOfInterval({ start: dateRange?.gte!, end: dateRange?.lte! })
    let rangesOfEachDay = daysInRange.map(normalizeRangeToFullDays)
    return rangesOfEachDay
  }
}

export default new TransactionService();
