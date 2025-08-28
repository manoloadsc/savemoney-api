import { toZonedTime, format, getTimezoneOffset, toDate } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale/pt-BR';

export function userDateTime(stringDate: string, timezone: string) {
    let zonedDate= toDate(stringDate, { timeZone : timezone })
    let timeZoneDate = toZonedTime(zonedDate, timezone)
    let dateToSendToUser = format(timeZoneDate, "'no dia' dd 'de' MMMM 'às' HH:mm", { locale : ptBR, timeZone : timezone });
    return { databaseDate : zonedDate.toISOString(), userDate : dateToSendToUser }
}

export function toISOString( dateString : string) { 
    return toDate(dateString).toISOString()
}
