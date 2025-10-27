import { userDateTime } from "lib/date.js";
import { z } from "zod";

export const coerceToDate = z.preprocess((val) => {
  if (val === null || val === "") return undefined;
  if (typeof val === "string" || val instanceof Date) {
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
}, z.date());

export const coerceToDateWithTz = (timezone: string) => {
  return z.preprocess((val) => {
    if (val === null || val === "") return undefined;

    if (typeof val === "string") {
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) return undefined;

      const { databaseDate } = userDateTime(val, timezone);
      const utcDate = new Date(databaseDate);
      return isNaN(utcDate.getTime()) ? undefined : utcDate;
    }
    return undefined;
  }, z.date());
};