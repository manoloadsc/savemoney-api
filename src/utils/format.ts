import { Decimal } from "@prisma/client/runtime/library";
import { format, isDate, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { badRequestError } from "errors/defaultErrors.js";

export function formatCurrency(value: string | number | Decimal, currency: string) {
    let numericValue: number;

    if (typeof value === "string") {
        numericValue = parseFloat(value);
    } else if (typeof value === "number") {
        numericValue = value;
    } else if (value instanceof Decimal || typeof value === "object") {
        numericValue = parseFloat(value.toString());
    } else {
        throw badRequestError( `Invalid value type in formatCurrency ${typeof value}`, );
    }

    return Intl.NumberFormat("pt-BR",  {
        style : "currency",
        currency
    }).format(numericValue)

}

export function formatDate(value: string | Date): string {
  let dateValue: Date;

  if (typeof value === "string") {
    dateValue = new Date(value);
  } else if (value instanceof Date) {
    dateValue = value;
  } else {
    throw badRequestError(`Invalid value type in formatDate: ${typeof value}`);
  }

  if (isNaN(dateValue.getTime())) {
    throw badRequestError(`Invalid date value in formatDate: ${value}`);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateValue);
}

export function formatDateWithHours(value: string | Date) { 
  let dateValue: Date;

  if (typeof value === "string") {
    dateValue = parseISO(value); // converte string ISO com segurança
  } else if (isDate(value)) {
    dateValue = value;
  } else {
    throw badRequestError(`Invalid value type in formatDate: ${typeof value}`);
  }

  if (isNaN(dateValue.getTime())) {
    throw badRequestError(`Invalid date value in formatDate: ${value}`);
  }

  return format(dateValue, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
}