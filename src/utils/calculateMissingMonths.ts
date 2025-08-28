export function calculateMissingMonths(start: Date, end: Date): number {
  
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1
  );
}
export function getMonths(initialDate: Date, increaseMonths: number): string {
  let currentDate = new Date(initialDate);
  currentDate.setMonth(currentDate.getMonth() + increaseMonths);

  const month = formatDate(currentDate);

  return month;
}

export function formatDate(date : Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

export function startDate(date_str : string): Date { 
  const date = new Date(date_str);
  date.setDate(1);
  return date
}

export function endDate(date_str : string): Date { 
  const date = new Date(date_str);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return date
}