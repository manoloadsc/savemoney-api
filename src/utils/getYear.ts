function getYearMonthRangeFrom(
  startYear: number,
  startMonth: number, // de 1 a 12
  totalMonths: number
): { min: string; max: string } {
  const startDate = new Date(startYear, startMonth - 1); // mês começa do 0
  const endDate = new Date(startYear, startMonth - 1 + (totalMonths - 1));

  const format = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  return {
    min: format(startDate),
    max: format(endDate),
  };
}

export default getYearMonthRangeFrom;