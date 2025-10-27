import { format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale/pt-BR'

export function parseBrasilTimeToUTC(dateString: string): Date {
  const zoned = parseISO(dateString); // apenas quebra a string em ano, mês, hora etc.
  return fromZonedTime(zoned, 'America/Sao_Paulo');
}

const HAS_TZ = /[zZ]$|[+-]\d{2}:\d{2}$/;

export function formatBrasil(
  input: string | Date,
  timezone = "America/Sao_Paulo"
) {
  let utcDate: Date;

  if (input instanceof Date) {
    utcDate = input; // já é Date (assuma UTC no seu fluxo)
  } else if (HAS_TZ.test(input)) {
    // string com Z ou ±HH:MM -> já tem TZ/UTC definido
    utcDate = new Date(input);
  } else {
    // string "naive" -> interpretar como hora local do usuário e converter p/ UTC
    utcDate = fromZonedTime(input, timezone);
  }

  // Formatar no fuso do usuário (sem deslocar para o fuso do servidor)
  return formatInTimeZone(
    utcDate,
    timezone,
    "'no dia' dd 'de' MMMM 'às' HH:mm",
    { locale: ptBR }
  );
}