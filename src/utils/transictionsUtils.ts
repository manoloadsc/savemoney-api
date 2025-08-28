import { Decimal } from "@prisma/client/runtime/library";
import { Parcels, Transaction } from "lib/prisma.js";
import { groupBy } from "./groupBy.js";
import { startOfDay } from "date-fns";
import { CategoryName } from "types/categories.js";

type transactionWithParcels = Transaction & { parcels : Parcels[] }

type DayGroup = {
  date: string;
  ganho: Decimal;
  gasto: Decimal;
  countGanho: number;
  countGasto: number;
  balance: Decimal;
};

function sumParcels(entries: transactionWithParcels[], type: "GANHO" | "GASTO") {
  return entries.filter(t => t.type === type)
    .flatMap(t => t.parcels)
    .reduce((acc, x) => acc.plus(x.value), new Decimal(0));
}

function groupByCategory(entries : transactionWithParcels[], categoryMap : Record<number, string>) {
  const grouped = groupBy(entries, "categoryId");
  let groupedTransactions = Object.entries(grouped).map(([k, list]) => {
    const name = categoryMap[Number(k)] as CategoryName;
    const ganho = list.filter(t => t.type === "GANHO").flatMap(list => list.parcels).reduce((acc, t) => acc.plus(t.value) , new Decimal(0) )
    const gasto = list.filter(t => t.type === "GASTO").flatMap(list => list.parcels).reduce((acc, t) => acc.plus(t.value) , new Decimal(0) )
    return { name, ganho, gasto };
  });
  return groupedTransactions
}

function groupByDay(entries : transactionWithParcels[]) { 
   const map = new Map<string, DayGroup>

   for(const entry of entries) {
    for(const parcel of entry.parcels) { 
      const day = startOfDay(parcel.createdAt).toISOString().split('T')[0]

      const current = map.get(day) ?? {
        date: day,
        ganho: new Decimal(0),
        gasto: new Decimal(0),
        countGanho: 0,
        countGasto: 0,
        balance: new Decimal(0),
      }

      if(entry.type === "GANHO") {
        current.ganho = current.ganho.plus(parcel.value)
        current.countGanho++
      }

      if(entry.type === "GASTO") {
        current.gasto = current.gasto.plus(parcel.value)
        current.countGasto++
      }

      current.balance = current.ganho.minus(current.gasto)

      map.set(day, current)
    }
   }

   return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date))
}
export { sumParcels, groupByCategory, groupByDay  }