import { Decimal } from "@prisma/client/runtime/library";
import { Category, Notifications, Parcels, Prisma, Transaction } from "lib/prisma.js";
import { ChatCompletionMessageParam } from "openai/resources";
import { panelType } from "services/dashboard.service.js";
import { isEssential, isLeisure, isDreamAndReservation, ByCategory } from "types/categories.js";
import { formatCurrency, formatDate, formatDateWithHours } from "utils/format.js";
import { formatedBrasil } from "utils/totimezoneCalc.js";
import { deepAnalysisValidation } from "validatation/transaction.validation.js";
import { ZodError } from "zod";

interface TransactionwithParcels extends Transaction { 
    parcels : Parcels[]
    category : Category,
    notifications : { purpose : "INFO" | "CONFIRM" | null, recurrenceCount : number | null } | null
}

function newFinance(categoryName: string, value: Decimal, recurrenceCount: number, description: string, nextReferenceDate:string, id : number) {
    return `
*Movimentação registrada*
( *${id}* ) ${recurrenceCount > 1 ? `📅 Data próxima cobrança: ${nextReferenceDate}` : ""}
📝 Descrição: ${description} ${recurrenceCount > 1 ? `\n🔁 Recorrência: ${recurrenceCount}` : ''} 
🏷 Categoria: ${categoryName}
💸 Valor:  _*${formatCurrency(value)}*_
    `
}

function updateEntry(categoryName: string, value: Decimal, recurrenceCount: number, description: string, nextReferenceDate: Date,active : boolean) {
    return `
*Movimentação atualizada*
${(recurrenceCount > 1 && active) ? `📅 Data próxima cobrança: ${formatedBrasil(nextReferenceDate.toISOString())}` : ""}
📝 Descrição: ${description} ${recurrenceCount > 1 ? `\n🔁 Recorrência: ${recurrenceCount}` : ''} 
🏷 Categoria: ${categoryName}
💸 Valor:  _*${formatCurrency(value)}*_
`
}

function listAnalyis(balance: Decimal, receitaTotal: Decimal, gastoTotal: Decimal,  expensesByCategory: ByCategory[], incomeByCategory: ByCategory[],receiptCount: number, expensesCount: number,dataInicial?: Date, dataFinal?: Date) {

    const essencialPercentage = expensesByCategory.reduce( (total, b) =>  isEssential(b.name) ? total.plus(b.percentage) : total, new Decimal(0) ).abs().toNumber()
    const prosperityPercentage = expensesByCategory.reduce( (total, b) =>  isDreamAndReservation(b.name) ? total.plus(b.percentage) : total, new Decimal(0) ).abs().toNumber()
    const lifeQualityPercentage = expensesByCategory.reduce( (total, b) =>  isLeisure(b.name) ? total.plus(b.percentage) : total, new Decimal(0) ).abs().toNumber()
    const total = receiptCount + expensesCount
    return `${dataInicial && dataFinal ? `📊 Análise do período (${formatDate(dataInicial)} à ${formatDate(dataFinal)})\n` : ""}
Total de gastos 💸 *${formatCurrency(gastoTotal)}* 
Total de receitas 💰: *${formatCurrency(receitaTotal)}*

Foram feitas *${total}* ${total > 1 ? "transações" : "transação"}
${total === receiptCount ? `Sendo todas as *${receiptCount}* novos ganhos💸` : total === expensesCount ? `Sendo todas as *${expensesCount}* novos gastos 💰` : `Foram *${receiptCount}* novos ganhos \nE *${expensesCount}* novos gastos`}

🧮 Seu saldo final foi de: ${formatCurrency(balance)}.`;
}

function contextExplanation(balance: Decimal, receitaTotal: Decimal, gastoTotal: Decimal,  entries: TransactionwithParcels[]  ,expensesByCategory: ByCategory[], incomeByCategory: ByCategory[], deep_analysis: panelType, totalInAcount : Decimal) : ChatCompletionMessageParam {
    const text = `'CTX TO DEEP_ANALYSIS'
    O Usuário gastou um total de *${formatCurrency(gastoTotal)}* e recebeu um total de *${formatCurrency(receitaTotal)}*. tendo um saldo total de *${formatCurrency(balance)}*.
    Mas por fim, tem em sua conta um valor total de ${formatCurrency(totalInAcount)} 
As suas movimentações financeiras foram : \n${entries.map(entry => `(${entry.id}) ${entry.description} - ${entry.value} - (${entry.category.name})`).join("\n")}
Gasto total por categoria : \n${expensesByCategory.map(entry => `${entry.name} - ${entry.percentage.toFixed(2)}%`).join("\n")}
Receita total por categoria : \n${incomeByCategory.map(entry => `${entry.name} - ${entry.percentage.toFixed(2)}%`).join("\n")}

Painel do Mês:
- Necessidades Essenciais 🧾 -- ${formatCurrency(deep_analysis.essencials.value)} (${deep_analysis.essencials.percentage.toFixed(2)}%)
- Educação 📚🚗 -- ${formatCurrency(deep_analysis.education.value)} (${deep_analysis.education.percentage.toFixed(2)}%)
- Lazer / Qualidade de Vida 🎉 -- ${formatCurrency(deep_analysis.isLeisure.value)} (${deep_analysis.isLeisure.percentage.toFixed(2)}%)
- Sonhos & Projetos -- ${formatCurrency(deep_analysis.draeamAndReservation.value)} (${deep_analysis.draeamAndReservation.percentage.toFixed(2)}%)
- Investimentos / Aposentadoria 💰 -- ${formatCurrency(deep_analysis.investiments.value)} (${deep_analysis.investiments.percentage.toFixed(2)}%)
`

return {
    role : "system",
    content : text
}
}

function deepAnalysis(analise : deepAnalysisValidation, gastoTotal: Decimal,  panel : panelType) {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return `${analise.greetings}


Painel do Mês:
- Necessidades Essenciais 🧾 -- *${formatCurrency(panel.essencials.value)}* (${panel.essencials.percentage.toFixed(2)}%)
- Educação 📚🚗 -- ${formatCurrency(panel.education.value)} (${panel.education.percentage.toFixed(2)}%)
- Lazer / Qualidade de Vida 🎉 -- *${formatCurrency(panel.isLeisure.value)} (${panel.isLeisure.percentage.toFixed(2)}%)
- Sonhos & Projetos 🌴 -- *${formatCurrency(panel.draeamAndReservation.value)}* (${panel.draeamAndReservation.percentage.toFixed(2)}%)
- Investimentos 💰 -- *${formatCurrency(panel.investiments.value)}* (${panel.investiments.percentage.toFixed(2)}%)
💸 Receita total: *${formatCurrency(gastoTotal)}*

✅ ${analise.prosperity}

Regra do 60-40:
- Essenciais (<= 60%) : ${analise.metrics.essentials}
- Lazer (<= 10%) : ${analise.metrics.leisure} 
- Educação (<= 10%) : ${analise.metrics.education}
- Investimentos (<= 10%) : ${analise.metrics.investments}
- Sonhos (<= 10%) : ${analise.metrics.dreams}

Reserva de Emergência:
- Custo mensal médio: *${formatCurrency(analise.emergency.monthlyCost)}*
- Reserva mínima (3 meses) *${formatCurrency(analise.emergency.minReserve)}*
- Reserva ideal (6 meses) *${formatCurrency(analise.emergency.idealReserve)}*
- Você tem: *${formatCurrency(analise.emergency.currentReserve)}*
- Gap minimo para 3 meses: *${formatCurrency(analise.emergency.gapMin)}*

💡 Plano: ${analise.plan}

Plano de Ações para o Próximo Mês
${[...analise.actionPlan, analise.next_30days].map((entry, i) => `${emojis[i]} ${entry}`).join("\n")}

Plano para os Próximos 90 Dias (Visão Macro)
${analise.next_90days.map((entry, i) => `${emojis[i]} ${entry}`).join("\n")}

${analise.bye_message}

E se tiver dúvidas específicas e preferir falar com o Arthur Terada, clica no link do whatspp dele abaixo e fale direto com ele 🤩
Inicie uma conversa conosco no WhatsApp clicando aqui: https://wa.me/554399033233  
`

}


function listEntries(entries : TransactionwithParcels[]) {
    let list = entries.map(entry => {
        let isNotification = entry.notifications && entry.notifications.purpose === "CONFIRM"
        let parcelInfo : string = `${entry.parcels.length}/${isNotification ? entry.notifications?.recurrenceCount : entry.recurrenceCount}`
        return `${entry.type === "GASTO" ? "🔴" : "🟢" } (${entry.id}) ${entry.description}:\n🔁 Parcelas: ${parcelInfo}\n🏷  Categoria: ${entry.category.name}
📅 Data e hora: ${formatDateWithHours(entry.referenceDate)}\n💵 Valor: *${formatCurrency(entry.value)}*`;
    }).join("\n\n");

    return `📝 *LISTA DE TRANSAÇÕES* \n\n${list}`
}

function updateParcel(value: Decimal, date: Date) {
    return `Parcela atualizada com sucesso!\nNovo valor: ${formatCurrency(value.toNumber())} 💰 \n${formatedBrasil(date.toISOString())} `
}

function createdNotification(notification: Notifications) {
    return `*Notificação criada com sucesso. ⏰*
📝 Descrição: ${notification.description} (${notification.id})${notification.active ? `\n📅 Você será avisado às ${formatedBrasil(notification.nextNotificationDate?.toISOString()!)}` : ""} 
💸 Valor : *${formatCurrency(notification.value)}*
`
}

function updateNotifications(notification: Notifications) {
    return `*Notificação atualizada com sucesso. ⏰*
📝 Descrição: ${notification.description}${notification.active ? `\n📅 Você será avisado às ${formatedBrasil(notification.nextNotificationDate?.toISOString()!)}` : ""} 
💸 Valor : *${formatCurrency(notification.value)}*
`
}
type CaNotification = { category: Category } & Notifications
function listNotifications(notifications: CaNotification[]) {
    return `✨ Notificações encontradas : 
${notifications.map(not => `(${not.id}) *${not.description}* \n 💸 *${formatCurrency(not.value)}* ${not.notificationTimes !== not.recurrenceCount ?  `\n📅 Próximo aviso ${formatedBrasil(not.nextNotificationDate?.toISOString()!)}` : "\n*Finalizada!* 😗"} `)
            .join("\n\n")}
    `
}

function listEntriesNotFound() {
    return `Não foi encontrada nenhuma movimentação para a pesquisa feita 😢 \n${goToPlataform()}`;
}

function listAnalyisNotFound() {
    return `❌ *Não foram encontrados nenhuma transação para a busca selecionada* \n ${goToPlataform()}`
}

function goToPlataform() {
    return `Para uma busca mais aprofundada, clique aqui e entre na plataforma 🔗 ${ `${process.env.PUBLIC_URL}/auth/login` || "(não tem link ainda)"}`
}

function parcelNotFound() {
    return `😢 Sua parcela não foi encontrada. \n${goToPlataform()}`
}

function listNotificationsNotFound() {
    return `❌ *Não foram encontrados nenhuma notificaçõs para a busca selecionada* \n ${goToPlataform()}`
}

function notificatationNotFound() {
    return `😢 Nenhuma notificação foi encontrada.`
}

function entryNotFound() {
    return `😢 Nenhuma movimentaçao foi encontrada.`
}

function entryDeleted(transaction : Transaction) {
    return `🗑 A Movimentação *${transaction.description}* (${transaction.id}) foi deletada com sucesso.`
}

function notificationDeleted(notification : Notifications) {
    return `🗑 Notificação *${notification.description}* (${notification.id}) foi deletada com sucesso.`
}

function parcelDeleted() {
    return `🗑 Parcela deletada.`
}

function toolNotfound() {
    return `Isso é um erro interno nosso, desculpe pelo ecorrido ! \n${goToPlataform()}`
}

function errorMessage(error : any) {

    if(error instanceof ZodError) { 
        return `❌ ${error.issues[0].message} \n${goToPlataform()}`
    }

    if(error instanceof Prisma.PrismaClientKnownRequestError) {
        return `❌ ${error.message} \n${goToPlataform()}`
    }
    return `${goToPlataform()}`
}
export function talkToSupport() {
  return `Olá! 👋  
Se precisar de ajuda ou tiver qualquer dúvida, nossa equipe de suporte está à disposição.  
Inicie uma conversa conosco no WhatsApp clicando aqui: https://wa.me/554399033233  
Será um prazer atendê-lo! 😊`;
}



export default {
    newFinance, listAnalyis, listEntriesNotFound, listAnalyisNotFound, entryNotFound, updateEntry, updateParcel, parcelNotFound, createdNotification,
    updateNotifications, listNotificationsNotFound, listNotifications, notificatationNotFound, entryDeleted, parcelDeleted, toolNotfound, listEntries,
    errorMessage, talkToSupport, contextExplanation,
    deepAnalysis, notificationDeleted
}