import { format, parseISO } from "date-fns";
import { fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale/pt-BR'

export function parseBrasilTimeToUTC(dateString: string): Date {
  const zoned = parseISO(dateString); // apenas quebra a string em ano, mês, hora etc.
  return fromZonedTime(zoned, 'America/Sao_Paulo');
}

export function formatedBrasil(dateString : string) { 
    // let date = parseBrasilTimeToUTC(dateString)
    let date = new Date(dateString)
    return format(date, "'no dia' dd 'de' MMMM 'às' HH:mm", { locale : ptBR });
}