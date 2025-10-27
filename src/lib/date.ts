import { toZonedTime, format, getTimezoneOffset, toDate, fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale/pt-BR';

export function userDateTime(stringDate: string, timezone: string) {
    let zonedDate= toDate(stringDate, { timeZone : timezone })
    let timeZoneDate = toZonedTime(zonedDate, timezone)
    let dateToSendToUser = format(timeZoneDate, "'no dia' dd 'de' MMMM 'às' HH:mm", { locale : ptBR, timeZone : timezone });
    return { databaseDate : zonedDate.toISOString(), userDate : dateToSendToUser }
}

const HAS_TZ = /[zZ]$|[+-]\d{2}:\d{2}$/;

/**
 * Interpreta stringDate:
 * - Se tiver offset/Z: respeita o offset (UTC direto)
 * - Se não tiver: interpreta como hora LOCAL do usuário (timezone) e converte para UTC
 * Retorna:
 *  - databaseDate: ISO em UTC (para salvar no banco)
 *  - userDate: string formatada no fuso do usuário (para exibir)
 */
export function userDateTime2(stringDate: string, timezone: string) {
  if (!stringDate) throw new Error("Data vazia");

  // 1) Se já vier com offset/Z, usa direto; senão, interpreta no TZ do usuário → UTC
  const utcDate = HAS_TZ.test(stringDate)
    ? new Date(stringDate)
    : fromZonedTime(stringDate, timezone);

  // 2) Para exibir no fuso do usuário
  const dateInUserTz = toZonedTime(utcDate, timezone);
  const userDate = format(
    dateInUserTz,
    "'no dia' dd 'de' MMMM 'às' HH:mm",
    { locale: ptBR, timeZone: timezone }
  );

  return { databaseDate: utcDate.toISOString(), userDate };
}

export function toISOString(dateString: string, timezone = "UTC") {
  const utcDate = HAS_TZ.test(dateString)
    ? new Date(dateString)
    : fromZonedTime(dateString, timezone);
  return utcDate.toISOString();
}