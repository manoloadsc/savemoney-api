import { subDays, startOfToday, endOfToday, startOfYear, endOfYear, startOfMonth, endOfMonth, isValid, eachDayOfInterval } from "date-fns";
import { endOfDay, startOfDay } from "date-fns/fp";
import { TransactionDateFilterType } from "types/transaction.js";

export function getDateRangeByType(
    type: TransactionDateFilterType,
    startDate?: Date,
    endDate?: Date
): { gte?: Date, lte?: Date } | undefined {
    switch (type) {
        case "7days": { return { gte: subDays(new Date(), 7), lte: new Date() } };
        case "today" : { return { gte : startOfToday(), lte : endOfToday() } };
        case "custom" : {
            if(startDate && endDate) return { gte : startOfDay(startDate)!, lte : endOfDay(endDate!) }
            if(startDate) return { gte : startDate! } 
            if(endDate) return { lte : endDate! }
            return undefined
         };
        case "year" : { return { gte : startOfYear(new Date()), lte : endOfYear(new Date()) } }
        case "month" : { return { gte : startOfMonth(new Date()), lte : endOfMonth(new Date()) } }
        case "all" : 

        default :
            return undefined
    }
}

export function normalizeRangeToFullDays(range?: Date): { gte?: Date; lte?: Date } | undefined {
  if (!range) return undefined;

  const result: { gte?: Date; lte?: Date } = {};

  result.gte = startOfDay(range);
  result.lte = endOfDay(range);

  return result;
}