import { Decimal } from "@prisma/client/runtime/library";
import {
  Category,
  Notifications,
  Parcels,
  Prisma,
  Transaction,
  Users,
} from "lib/prisma.js";
import { ChatCompletionMessageParam } from "openai/resources";
import { panelType } from "services/dashboard.service.js";
import {
  isEssential,
  isLeisure,
  isDreamAndReservation,
  ByCategory,
} from "types/categories.js";
import {
  formatCurrency,
  formatDate,
  formatDateWithHours,
} from "utils/format.js";
import { formatBrasil } from "utils/totimezoneCalc.js";
import { deepAnalysisValidation } from "validatation/transaction.validation.js";
import { ZodError } from "zod";

interface TransactionwithParcels extends Transaction {
  parcels: Parcels[];
  category: Category;
  notifications: {
    purpose: "INFO" | "CONFIRM" | null;
    recurrenceCount: number | null;
  } | null;
}

function newFinance(
  categoryName: string,
  value: Decimal,
  recurrenceCount: number,
  description: string,
  nextReferenceDate: string,
  id: number,
  currency: string
) {
  return `
*Movimiento registrado*
( *${id}* ) ${recurrenceCount > 1 ? `📅 Fecha próxima de cobro: ${nextReferenceDate}` : ""}
📝 Descripción: ${description} ${recurrenceCount > 1 ? `\n🔁 Recurrencia: ${recurrenceCount}` : ""} 
🏷 Categoría: ${categoryName}
💸 Valor:  _*${formatCurrency(value, currency)}*_
    `;
}

function updateEntry(
  categoryName: string,
  value: Decimal,
  recurrenceCount: number,
  description: string,
  nextReferenceDate: Date,
  active: boolean,
  user: Users
) {
  return `
*Movimiento actualizado*
${recurrenceCount > 1 && active ? `📅 Fecha próxima de cobro: ${formatBrasil(nextReferenceDate.toISOString(), user.timeZone || "America/Sao_Paulo")}` : ""}
📝 Descripción: ${description} ${recurrenceCount > 1 ? `\n🔁 Recorrencia: ${recurrenceCount}` : ""} 
🏷 Categoría: ${categoryName}
💸 Valor:  _*${formatCurrency(value, user.currency!)}*_
`;
}

function listAnalyis(
  balance: Decimal,
  receitaTotal: Decimal,
  gastoTotal: Decimal,
  expensesByCategory: ByCategory[],
  incomeByCategory: ByCategory[],
  receiptCount: number,
  expensesCount: number,
  currency: string,
  dataInicial?: Date,
  dataFinal?: Date
) {
  const essencialPercentage = expensesByCategory
    .reduce(
      (total, b) => (isEssential(b.name) ? total.plus(b.percentage) : total),
      new Decimal(0)
    )
    .abs()
    .toNumber();
  const prosperityPercentage = expensesByCategory
    .reduce(
      (total, b) =>
        isDreamAndReservation(b.name) ? total.plus(b.percentage) : total,
      new Decimal(0)
    )
    .abs()
    .toNumber();
  const lifeQualityPercentage = expensesByCategory
    .reduce(
      (total, b) => (isLeisure(b.name) ? total.plus(b.percentage) : total),
      new Decimal(0)
    )
    .abs()
    .toNumber();
  const total = receiptCount + expensesCount;
  return `${dataInicial && dataFinal ? `📊 Análisis del período (${formatDate(dataInicial)} a ${formatDate(dataFinal)})\n` : ""}
Total de gastos 💸 *${formatCurrency(gastoTotal, currency)}* 
Total de ingresos 💰: *${formatCurrency(receitaTotal, currency)}*

Se realizaron *${total}* ${total > 1 ? "transacciones" : "transacción"}
${total === receiptCount ? `Siendo todos los *${receiptCount}* nuevos ingresos💸` : total === expensesCount ? `Siendo todos los *${expensesCount}* nuevos gastos 💰` : `Fueron *${receiptCount}* nuevos ingresos \nY *${expensesCount}* nuevos gastos`}

🧮 Tu saldo final fue: ${formatCurrency(balance, currency)}.`;
}

function contextExplanation(
  balance: Decimal,
  receitaTotal: Decimal,
  gastoTotal: Decimal,
  entries: TransactionwithParcels[],
  expensesByCategory: ByCategory[],
  incomeByCategory: ByCategory[],
  deep_analysis: panelType,
  totalInAcount: Decimal,
  currency: string
): ChatCompletionMessageParam {
  const text = `'CTX TO DEEP_ANALYSIS'
    El usuario gastó un total de *${formatCurrency(gastoTotal, currency)}* y recibió un total de *${formatCurrency(receitaTotal, currency)}*, teniendo un saldo total de *${formatCurrency(balance, currency)}*.
    Pero al final, tiene en su cuenta un valor total de ${formatCurrency(totalInAcount, currency)} 
Sus movimientos financieros fueron : \n${entries.map((entry) => `(${entry.id}) ${entry.description} - ${entry.value} - (${entry.category.name})`).join("\n")}
Gasto total por categoría : \n${expensesByCategory.map((entry) => `${entry.name} - ${entry.percentage.toFixed(2)}%`).join("\n")}
Ingreso total por categoría : \n${incomeByCategory.map((entry) => `${entry.name} - ${entry.percentage.toFixed(2)}%`).join("\n")}

Panel del Mes:
- Necesidades Esenciales 🧾 -- ${formatCurrency(deep_analysis.essencials.value, currency)} (${deep_analysis.essencials.percentage.toFixed(2)}%)
- Educación 📚🚗 -- ${formatCurrency(deep_analysis.education.value, currency)} (${deep_analysis.education.percentage.toFixed(2)}%)
- Ocio / Calidad de Vida 🎉 -- ${formatCurrency(deep_analysis.isLeisure.value, currency)} (${deep_analysis.isLeisure.percentage.toFixed(2)}%)
- Sueños & Proyectos -- ${formatCurrency(deep_analysis.draeamAndReservation.value, currency)} (${deep_analysis.draeamAndReservation.percentage.toFixed(2)}%)
- Inversiones / Jubilación 💰 -- ${formatCurrency(deep_analysis.investiments.value, currency)} (${deep_analysis.investiments.percentage.toFixed(2)}%)
`;

  return {
    role: "system",
    content: text,
  };
}

function deepAnalysis(
  analise: deepAnalysisValidation,
  gastoTotal: Decimal,
  panel: panelType,
  currency: string
) {
  const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  return `${analise.greetings}


Panel del Mes:
- Necesidades Esenciales 🧾 -- *${formatCurrency(panel.essencials.value, currency)}* (${panel.essencials.percentage.toFixed(2)}%)
- Educación 📚🚗 -- ${formatCurrency(panel.education.value, currency)} (${panel.education.percentage.toFixed(2)}%)
- Ocio / Calidad de Vida 🎉 -- *${formatCurrency(panel.isLeisure.value, currency)} (${panel.isLeisure.percentage.toFixed(2)}%)
- Sueños & Proyectos 🌴 -- *${formatCurrency(panel.draeamAndReservation.value, currency)}* (${panel.draeamAndReservation.percentage.toFixed(2)}%)
- Inversiones 💰 -- *${formatCurrency(panel.investiments.value, currency)}* (${panel.investiments.percentage.toFixed(2)}%)
💸 Ingreso total: *${formatCurrency(gastoTotal, currency)}*

✅ ${analise.prosperity}

Regla del 60-40:
- Esenciales (<= 60%) : ${analise.metrics.essentials}
- Ocio (<= 10%) : ${analise.metrics.leisure} 
- Educación (<= 10%) : ${analise.metrics.education}
- Inversiones (<= 10%) : ${analise.metrics.investments}
- Sueños (<= 10%) : ${analise.metrics.dreams}

Reserva de Emergencia:
- Costo mensual promedio: *${formatCurrency(analise.emergency.monthlyCost, currency)}*
- Reserva mínima (3 meses) *${formatCurrency(analise.emergency.minReserve, currency)}*
- Reserva ideal (6 meses) *${formatCurrency(analise.emergency.idealReserve, currency)}*
- Tienes: *${formatCurrency(analise.emergency.currentReserve, currency)}*
- Brecha mínima para 3 meses: *${formatCurrency(analise.emergency.gapMin, currency)}*

💡 Plan: ${analise.plan}

Plan de Acciones para el Próximo Mes
${[...analise.actionPlan, analise.next_30days].map((entry, i) => `${emojis[i]} ${entry}`).join("\n")}

Plan para los Próximos 90 Días (Visión Macro)
${analise.next_90days.map((entry, i) => `${emojis[i]} ${entry}`).join("\n")}

${analise.bye_message}

Y si tienes dudas específicas y prefieres hablar con Leo, haz clic en el enlace de WhatsApp abajo y habla directamente con él 🤩  
`;
}

function listEntries(entries: TransactionwithParcels[], currency: string) {
  let list = entries
    .map((entry) => {
      let isNotification =
        entry.notifications && entry.notifications.purpose === "CONFIRM";
      let parcelInfo: string = `${entry.parcels.length}/${isNotification ? entry.notifications?.recurrenceCount : entry.recurrenceCount}`;
      return `${entry.type === "GASTO" ? "🔴" : "🟢"} (${entry.id}) ${entry.description}:\n🔁 Cuotas: ${parcelInfo}\n🏷  Categoría: ${entry.category.name}
📅 Fecha y hora: ${formatDateWithHours(entry.referenceDate)}\n💵 Valor: *${formatCurrency(entry.value, currency)}*`;
    })
    .join("\n\n");

  return `📝 *LISTA DE TRANSACCIONES* \n\n${list}`;
}

function updateParcel(value: Decimal, date: Date, user: Users) {
  return `¡Cuota actualizada con éxito!\nNuevo valor: ${formatCurrency(value.toNumber(), user.currency!)} 💰 \n${formatBrasil(date.toISOString(), user.timeZone || "America/Sao_Paulo")} `;
}

function createdNotification(notification: Notifications, user: Users) {
  return `*Notificación creada con éxito. ⏰*
📝 Descripción: ${notification.description} (${notification.id})${notification.active ? `\n📅 Se te avisará ${formatBrasil(notification.nextNotificationDate?.toISOString()!, user.timeZone || "America/Sao_Paulo")}` : ""} 
💸 Valor : *${formatCurrency(notification.value, user.currency!)}*
`;
}

function updateNotifications(notification: Notifications, user: Users) {
  return `*Notificación actualizada con éxito. ⏰*
📝 Descripción: ${notification.description}${notification.active ? `\n📅 Se te avisará ${formatBrasil(notification.nextNotificationDate?.toISOString()!, user.timeZone || "America/Sao_Paulo")}` : ""} 
💸 Valor : *${formatCurrency(notification.value, user.currency!)}*
`;
}
type CaNotification = { category: Category } & Notifications;
function listNotifications(notifications: CaNotification[], user: Users) {
  return `✨ Notificaciones encontradas : 
${notifications
  .map(
    (not) =>
      `(${not.id}) *${not.description}* \n 💸 *${formatCurrency(not.value, user.currency!)}* ${not.notificationTimes !== not.recurrenceCount ? `\n📅 Próximo aviso ${formatBrasil(not.nextNotificationDate?.toISOString()!, user.timeZone || "America/Sao_Paulo")}` : "\n*¡Finalizada!* 😗"} `
  )
  .join("\n\n")}
    `;
}

function listEntriesNotFound() {
  return `No se encontró ningún movimiento para la búsqueda realizada 😢 \n${goToPlataform()}`;
}

function listAnalyisNotFound() {
  return `❌ *No se encontraron transacciones para la búsqueda seleccionada* \n ${goToPlataform()}`;
}

function goToPlataform() {
  return `Para una búsqueda más detallada, haz clic aquí y entra en la plataforma 🔗 ${`${process.env.PUBLIC_URL}/auth/login` || "(aún no hay enlace)"}`;
}

function parcelNotFound() {
  return `😢 No se encontró su cuota. \n${goToPlataform()}`;
}

function listNotificationsNotFound() {
  return `❌ *No se encontraron notificaciones para la búsqueda seleccionada* \n ${goToPlataform()}`;
}

function notificatationNotFound() {
  return `😢 No se encontró ninguna notificación.`;
}

function entryNotFound() {
  return `😢 No se encontró ningún movimiento.`;
}

function entryDeleted(transaction: Transaction) {
  return `🗑 El movimiento *${transaction.description}* (${transaction.id}) fue eliminado con éxito.`;
}

function notificationDeleted(notification: Notifications) {
  return `🗑 Notificación *${notification.description}* (${notification.id}) fue eliminada con éxito.`;
}

function parcelDeleted() {
  return `🗑 Cuota eliminada.`;
}

function toolNotfound() {
  return `Esto es un error interno nuestro, disculpa por lo ocurrido! \n${goToPlataform()}`;
}

function errorMessage(error: any) {
  if (error instanceof ZodError) {
    return `❌ ${error.issues[0].message} \n${goToPlataform()}`;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `❌ ${error.message} \n${goToPlataform()}`;
  }
  return `${goToPlataform()}`;
}
export function talkToSupport() {
  return `Si estás experimentando algún problema o quieres aclarar algo directamente, a continuación está el contacto de Leo.

Escríbele por WhatsApp y él podrá atenderte personalmente y ayudarte con lo que necesites.`;
}

export function notificationDateInPast(
  referenceDate: Date,
  userTimezone = "America/Sao_Paulo"
) {
  return `*Lamentablemente* no pude programar tu notificación 😢 

La fecha u hora de la notificación que creaste (${formatBrasil(referenceDate, userTimezone)}) es anterior a la fecha actual y por eso no fue posible crearla.

Intenta registrarla nuevamente por texto o desde la plataforma web, ¡gracias!`;
}

export default {
  newFinance,
  listAnalyis,
  listEntriesNotFound,
  listAnalyisNotFound,
  entryNotFound,
  updateEntry,
  updateParcel,
  parcelNotFound,
  createdNotification,
  updateNotifications,
  listNotificationsNotFound,
  listNotifications,
  notificatationNotFound,
  entryDeleted,
  parcelDeleted,
  toolNotfound,
  listEntries,
  errorMessage,
  talkToSupport,
  contextExplanation,
  deepAnalysis,
  notificationDeleted,
  notificationDateInPast,
};
