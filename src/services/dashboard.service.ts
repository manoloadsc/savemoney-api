import prisma, { Interval, Parcels, Transaction } from "lib/prisma.js";
import transactionsService from "./transactions.service.js";
import { TransactionDateFilterType } from "types/transaction.js";
import { addDays, addMonths, addWeeks, addYears, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, eachYearOfInterval } from "date-fns";
import { groupByCategory, groupByDay, sumParcels } from "utils/transictionsUtils.js";
import { badRequestError } from "errors/defaultErrors.js";
import { getDateRangeByType } from "utils/dateRange.js";
import { isEssential, isEducation, isInvestment, isLeisure, isDreamAndReservation } from "types/categories.js";
import { Decimal } from "@prisma/client/runtime/library";
import userService from "./user.service.js";

export type panelType =  Awaited<ReturnType<typeof DashboardService.prototype.deepAnalysis>> 

class DashboardService {
    constructor() { }

    async buildDashboard(userId: string, perPAge: number, page: number, type: TransactionDateFilterType, startDate?: Date, endDate?: Date, search?: string, categoryId?: number[]) {
        let transactions = await this.transactionsWithMissingParcels(userId, perPAge, page, type, startDate, endDate, search, categoryId);
        let categoriesList = await prisma.category.findMany();
        let categoryMap = Object.fromEntries(categoriesList.map(c => [c.id, c.name]))

        let receitas = sumParcels(transactions.entries, "GANHO")
        let gastos = sumParcels(transactions.entries, "GASTO")
        let balance = receitas.minus(gastos);
        let total = await transactionsService.allTimeBalance(userId)

        const byGroup = groupByCategory(transactions.entries, categoryMap)
        const byDay = groupByDay(transactions.entries)
    

        let lastTransactions = await this.getLastParcelsWithCount(userId, categoryMap)

        let totalTransactionsCount = await prisma.transaction.count({
            where: {
                deletedAt: null,
                userId,
            },
        })

        const user = await userService.getUser(userId);

        return {
            receitas, gastos, balance, total,
            byGroupSumExpenses: byGroup.map(b => ({ name: b.name, value: b.gasto, percentage : b.gasto.dividedBy(gastos).mul(100) })).filter(b => b.value.greaterThan(0)),
            byGroupSumReceipts: byGroup.map(b => ({ name: b.name, value: b.ganho, percentage : b.ganho.dividedBy(receitas).mul(100) })).filter(b => b.value.greaterThan(0)),
            parcelsToSend: lastTransactions,
            totalTransactionsCount,
            byDay,
            currency: user?.currency || "BRL"
        };
    }

    async deepAnalysis(userId: string, perPAge: number, page: number, type: TransactionDateFilterType, startDate?: Date, endDate?: Date, search?: string, categoryId?: number[]) {
        const {byGroupSumExpenses } = await this.buildDashboard(userId, perPAge, page, type, startDate, endDate, search, categoryId);
        const panel = { 
            essencials : {
                percentage : byGroupSumExpenses.filter(b => isEssential(b.name)).reduce((total, b) => total.plus(b.percentage), new Decimal(0)).abs().toNumber(),
                value : byGroupSumExpenses.filter(b => isEssential(b.name)).reduce((total, b) => total.plus(b.value), new Decimal(0)).abs().toNumber(),
            },
            isLeisure : {
                percentage : byGroupSumExpenses.filter(b => isLeisure(b.name)).reduce((total, b) => total.plus(b.percentage), new Decimal(0)).abs().toNumber(),
                value : byGroupSumExpenses.filter(b => isLeisure(b.name)).reduce((total, b) => total.plus(b.value), new Decimal(0)).abs().toNumber(),
            },
            draeamAndReservation : {
                percentage : byGroupSumExpenses.filter(b => isDreamAndReservation(b.name)).reduce((total, b) => total.plus(b.percentage), new Decimal(0)).abs().toNumber(),
                value : byGroupSumExpenses.filter(b => isDreamAndReservation(b.name)).reduce((total, b) => total.plus(b.value), new Decimal(0)).abs().toNumber(),
            },
            investiments : { 
                percentage : byGroupSumExpenses.filter(b => isInvestment(b.name)).reduce((total, b) => total.plus(b.percentage), new Decimal(0)).abs().toNumber(),
                value: byGroupSumExpenses.filter(b => isInvestment(b.name)).reduce((total, b) => total.plus(b.value), new Decimal(0)).abs().toNumber()
            },
            education : {  
                percentage : byGroupSumExpenses.filter(b => isEducation(b.name)).reduce((total, b) => total.plus(b.percentage), new Decimal(0)).abs().toNumber(),
                value: byGroupSumExpenses.filter(b => isEducation(b.name)).reduce((total, b) => total.plus(b.value), new Decimal(0)).abs().toNumber()
            }
        }

        return panel
    }

    async transactionsWithMissingParcels(userId: string, perPAge: number, page: number, type: TransactionDateFilterType, startDate?: Date, endDate?: Date, search?: string, categoryId?: number[]) {
        let transactions = await transactionsService.getTransactions(userId, perPAge, page, type, startDate, endDate, search, categoryId);

        for (const transaction of transactions.entries) {
            let now = new Date();
            let missingCount = this.calculateMissingCount(transaction, endDate ? endDate : now);
            let fakeParcels: Parcels[] = Array.from({ length: missingCount }).map((_, i) => ({
                createdAt: this.addDaysByIntervalType(transaction.nextReferenceDate, transaction.recurrenceInterval, i),
                notified: false,
                transactionId: transaction.id,
                userId: transaction.userId,
                deletedAt: null,
                updatedAt: null,
                count: missingCount + i + 1,
                id: 0,
                value: transaction.value,
                notificationId: null
            }))

            transaction.parcels = [...transaction.parcels, ...fakeParcels]
        }

        return transactions
    }


    private calculateMissingCount(transiction: Transaction & { parcels: Parcels[] }, endDate: Date) {
        if (transiction.nextReferenceDate > endDate) return 0

        let countInPeriod = this.getIntervalCount(transiction.nextReferenceDate, endDate, transiction.recurrenceInterval);
        if (countInPeriod > transiction.recurrenceCount - transiction.parcels.length) return transiction.recurrenceCount - transiction.parcels.length

        return countInPeriod
    }

    private addDaysByIntervalType(startDate: Date, interval: Interval, count: number) {
        switch (interval) {
            case "DIARY":
                return addDays(startDate, count)
            case "WEECKLY":
                return addWeeks(startDate, count)
            case "MONTHLY":
                return addMonths(startDate, count)
            case "YEARLY":
                return addYears(startDate, count)
            default:
                return startDate
        }
    }
    private getIntervalCount(startDate: Date, endDate: Date, interval: Interval) {
        switch (interval) {
            case "WEECKLY": return eachWeekOfInterval({ start: startDate, end: endDate }).length
            case "MONTHLY": return eachMonthOfInterval({ start: startDate, end: endDate }).length
            case "DIARY": return eachDayOfInterval({ start: startDate, end: endDate }).length
            case "YEARLY": return eachYearOfInterval({ start: startDate, end: endDate }).length
            default: return 0
        }
    }
    async getLastParcelsWithCount(
        userId: string,
        categoryMap: Record<number, string>
    ) {
        const lastParcels = await prisma.parcels.findMany({
            where: { userId, transactionId: { not: null } },
            orderBy: { createdAt: "desc" },
            include: { transaction: { select: { description: true, value: true, categoryId: true, recurrenceCount: true, type: true, _count: { select: { parcels: true } } } } },
            take: 5,
            distinct: ["transactionId"],
        });

        return lastParcels.map(parcel => ({
            date: parcel.createdAt,
            description: parcel.transaction?.description,
            valor: parcel.transaction?.value,
            parcelInfo: `${parcel.transaction?._count.parcels}/${parcel.transaction?.recurrenceCount}`,
            category: categoryMap[parcel.transaction?.categoryId ?? 0],
            type: parcel.transaction?.type,
        }));
    }

    async getHistoricDateRange(type: TransactionDateFilterType, userId: string, startDate?: Date, endDate?: Date) {

        let startDateToSearch: Date
        let endDateToSearch: Date

        const firstUserTransaction = await prisma.transaction.findFirst({
            where: {
                userId,
                deletedAt: null
            },
            orderBy: {
                referenceDate: "asc"
            },
            select: { referenceDate: true }
        })

        const firstReferenceDate = firstUserTransaction?.referenceDate!

        const lastUserTransaction = await prisma.transaction.findFirst({
            where: {
                userId,
                deletedAt: null
            },
            orderBy: {
                referenceDate: "desc"
            },
            select: { referenceDate: true }
        })

        const lastReferenceDate = lastUserTransaction?.referenceDate!

        if (type === "all") {
            if (!firstUserTransaction || !lastUserTransaction) return []
            startDateToSearch = firstReferenceDate 
            endDateToSearch = lastReferenceDate
            return { startDate: startDateToSearch, endDate: endDateToSearch }

        }

        if (type === "custom") {
            if (!startDate || !endDate) throw badRequestError("Tipo custom precisa de startDate e end Date.")
            startDateToSearch = startDate > firstReferenceDate ? firstReferenceDate : startDate
            endDateToSearch = endDate > lastReferenceDate ? lastReferenceDate : endDate
            return { startDate: startDateToSearch, endDate: endDateToSearch }
        }

        let { gte, lte } = getDateRangeByType(type)!

        return { 
            startDate : gte! > firstReferenceDate ? firstReferenceDate : gte,
            endDate : lte! > lastReferenceDate ? lastReferenceDate : lte
        }
    }

}

export default new DashboardService();


