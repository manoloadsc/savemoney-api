import OpenAI from "openai";
import { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool, ChatModel } from "openai/resources";
import userService from "./user.service.js";
import { FromMessage } from "lib/prisma.js";
import tools, { analysisOnlyTools, ToolFunctionNames } from "gpt/tools.js";
import { gptCreateTransictionValidation, transactionAnalysisValidation, listTransactionsByDescriptionValidation, updateEntryFieldValidation } from "validatation/financial.validation.js";
import transactionsService from "./transactions.service.js";
import dashboardService from "./dashboard.service.js";
import { TransactionDateFilterType } from "types/transaction.js";
import { Decimal } from "@prisma/client/runtime/library";
import { formatCurrency, formatDate } from "utils/format.js";
import { deepAnalysisValidation, updateParcelValidation } from "validatation/transaction.validation.js";
import { createNotificationValidation, getNotificationsValidation, updateNotificationValidationGpt } from "validatation/notification.validation.js";
import notificationService from "./notification.service.js";
import { z } from "zod";
import botMessages from "gpt/botMessages.js";
import { Readable } from "stream";
import { userDateTime } from "lib/date.js";
import path from "path";
import { readFileSync } from "fs";
import { cosineL2, cosineSimilarity, isChitChat, l2, normalizeText } from "utils/embeggingsUtils.js";
import { format } from "date-fns";
import { listCategoriesWithId } from "types/categories.js";

interface ToolEmbedding {
    name: string;
    vector: number[];
}

const DESTRUCTIVE = new Set<string>([
  "delete_transaction",
  "delete_parcel",
  "delete_notification",
]);

export type UserMonthAnalysis = Awaited< ReturnType<typeof GPTservice.prototype.createUserMonthAnalysis>>

class GPTservice {
    client: OpenAI
    toolEmbeddings: ToolEmbedding[]
    constructor() {
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const embeddingPath = path.resolve(process.cwd(), "data", "toolEmbeddings.json");
        this.toolEmbeddings = JSON.parse(readFileSync(embeddingPath, "utf-8"));
    }

    async selectRelevantTool(input: string) {
        if (!this.toolEmbeddings.length) {
            console.log('Nenhum embedding de tool carregado.');
            return { tools : [], isChitChat: false };
        }

        const embedResponse = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input:  `query: ${normalizeText(input)}`
        });

        const userVector = l2(embedResponse.data[0].embedding as number[]);
        if (!Array.isArray(userVector) || userVector.length === 0) {
            return { tools : [], isChitChat: false };
        }

        const sims = this.toolEmbeddings.map(te => {
          const score = cosineL2(userVector, l2(te.vector));
          return { name: te.name, score };
        }).sort((a,b) => b.score - a.score);

        const threshold = 0.40;  // ajustado para 0.5 para maior sensibilidade

        const topNames = sims.filter(s => s.score >= threshold).sort((a, b) => b.score - a.score).slice(0, 4).map(s => s.name);

        return { tools : tools.filter((t): t is ChatCompletionTool => topNames.includes(t.function.name)), isChitChat : isChitChat(input) };

    }

    private getMainRules(username: string): ChatCompletionMessageParam {
        const date = new Date();
        const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        const rules = [
            `Financial assistant for ${username} (${today}). Always respond in Brazilian Portuguese.`,
            "These instructions match tools available in this assistant. Use tool_choice 'auto' accordingly.",
            "Never send talked with user : message, this is only a summary of your context",
            "when parsing time input from the user, assume that ambiguous early-hour times (like '3 o'clock') without AM/PM context should default to the afternoon (15:00) instead of early morning (03:00), unless the user explicitly specifies otherwise. This helps avoid scheduling at inconvenient hours. The user can always override the default if needed.",
            "If user say to you want to update something, and just provide the hours like that : 'at 3 o clock' always update do theere pm,",
            `For any number of purchases mentioned, call add_finance once per item. Always create one function call per transaction, even if they are in the same or different sentences.`,
            `All input date need to have this format : YYYY-MM-DDTHH:mm:ss.sss, never include Z in the date.`,
            `Never duplicate 2 function calls for the same transaction if they have the same description.`,
            `### CATEGORY INFERENCE RULES:
- Never ask the user to provide a category manually.
- Always infer the correct categoryId based on the description and context of the message.
- Categories by ID:
${listCategoriesWithId()}
- Examples:
   - "Bought a flight to Rio" → categoryId = 3 (Travel)
   - "Salary from my company" → categoryId = 5 (Salary)
   - "Paid electricity bill" → categoryId = 11 (Housing)
   - "Donated to NGO" → categoryId = 1 (Donations)
   - "Bought dog food" → categoryId = 17 (Pets)`
        ].join("\n\n");

        return {
            role: "system",
            content: rules
        };
    }

    private async getUserContext(userId: string): Promise<ChatCompletionMessageParam[]> {
        let messages = await userService.listUserMessages(userId)
        return messages.map((msg, index) => {
            return { role: msg.from === FromMessage.USER ? "user" : "assistant", content: `${msg.content}` }
        })
    }

    private async buildUserContext(userId: string, directRules?: ChatCompletionMessageParam): Promise<{ messages: ChatCompletionMessageParam[], tools: ChatCompletionTool[] }> {
        let messages: ChatCompletionMessageParam[];
        let messageContext = await userService.listUserMessages(userId, 3, "USER")
        let msgCtxLast = await userService.listUserMessages(userId, 1, "USER")
        
        const contextTools = await this.selectRelevantTool(messageContext.map(msg => msg.content).join(" "))
        const lastMessageContext = await this.selectRelevantTool(msgCtxLast[0].content)

        const contextToolsToSend = !lastMessageContext.isChitChat ? lastMessageContext.tools
        : lastMessageContext.tools.length === 0 ? contextTools.tools : lastMessageContext.tools
        console.log("tools : ",contextToolsToSend.map( c => c.function.name).join(', '))
        let userContext = await this.getUserContext(userId)
        messages = userContext
        if (directRules) {
            messages.push(directRules)
        } else {
            let userRules = this.buildUserRelevantToolContext(userId, contextToolsToSend)
            messages.push(userRules)
        }
        return { messages, tools: contextToolsToSend }
    }

    private buildUserRelevantToolContext(userId: string, tools: ChatCompletionTool[]): ChatCompletionMessageParam {
        let keys = tools.map(tool => tool.function.name) as ToolFunctionNames[];

        const date = new Date();
        const today = format(date, "yyyy-MM-dd");

        const context: string[] = [];

        context.push(`Financial assistant for user ${userId} (${today}). Always respond in Brazilian Portuguese.`);
        context.push(`You have access to financial tools. Use them automatically when relevant.`);
        context.push(`Do not echo context or meta-messages.`);
        context.push(`All input dates must follow this format: YYYY-MM-DDTHH:mm:ss.sss (never include Z).`);
        context.push(`When parsing times like "3 o'clock", default to 15:00 (PM) unless AM is explicitly stated.`);
        context.push(`Category mapping: 1 = donations, 2 = Courses, 3 = Trave, 4 = Entertainment, 5 = Salary, 6 = Rent, 7 = Aid, 8 = Revenue, 9 = Food, 10 = Transport, 11 = Housing, 12 = Leisure, 13 = Education, 14 = Clothing, 15 = Accessories, 16 = Gifts, 17 = Pets, 18 = Beauty, 19 = Other.`);
        context.push(`Just call for tools when you need them.`);

        for (const key of keys) {
            if (key === "add_finance") {
                context.push("Rules for add_finance:");
                context.push(`If the user mentions multiple purchases, create one function call per item.`);
                context.push(`Never merge multiple purchases into one transaction.`);
                context.push(`Infer the categoryId from the description. Never ask the user.`);
                continue;
            }

            if (key === "list_entries") {
                context.push(`### Rules for 'list_entries':\n- Only use if the user explicitly requests a list or wants to review entries.`);
                continue;
            }

            if (key === "get_month_information") {
                context.push("Always use to have the context to execute the deep_analysis tool, to confirm you have context already, find on your context messages the 'CTX TO DEEP_ANALYSIS' key phrase on the text.");
            }

            if (key === "list_analysis") {
                context.push(`### Rules for 'list_analysis':\n- Only call when the user asks for insights, summaries, or analysis over time.`);
                continue;
            }

            if (key === "deep_analysis") {
                context.push(`### Rules for 'delete_transaction': 
Financial Coaching Methodology:
1. Mindset & Motivation: teach financial autonomy and use small wins to reinforce habits.
2. Quick Diagnosis: list income/expenses and debts; choose avalanche or snowball method.
3. 60-40 Rule: allocate 60% to essentials and split the remaining 40% (10% leisure, 10% education, 10% investments, 10% dreams).
4. Simplified Planning: maintain clear data for better decisions.
5. Emergency Fund: build 3–12 months of living costs in daily-liquidity investments.
6. Goals & Purpose: set short/mid/long-term goals tied to personal values.
7. Extra Income: encourage multiple income streams after basics are covered.
8. Beginner Investments: start with fixed income, diversify, and automate contributions.
9. Continuous Tracking: regular reviews, visual alerts, and guilt-free adjustments.
10. Emotional Intelligence: impulse control (30-day rule), breathing techniques, and deliberate rewards.
Use this context to guide all financial operations and analyses.
Use emojis on the awnsers to meke it more human-like.

USE THIS TOOL

if in your context have : 'CTX TO DEEP_ANALYSIS'.
you can execute this function.
To complete the metrics and emergency objects, follow the provided rules and generate a feedback message; the same applies to prosperity. 
exemplo : 
metrics: {
    essentials: 'Voce gastou mais do que deveria com o essencial',
    leisure: 'Ganhou o suficiente dinheiro para passar no lazer',
    education: 'Voce gastou mais do que deveria com a Educação',
    investments: 'Voce gastou mais do que deveria com os Investimentos',
    dreams: 'Voce gastou mais do que deveria com os Sonhos'
} follow the same patter to generate prosperity object.
`);
                continue;
            }

            if (key === "update_transaction") {
                context.push(`### Rules for 'update_transaction':\n- Only update 'valor', 'description' or 'categoryId'.\n- Trigger only when user provides corrections like "na verdade era X reais".`);
                continue;
            }

            if (key === "escalate_to_human_support") {
                context.push(`### when user ask how can talk with human support, or ask for help about something or do a request.`);
            }
            // if (key === "update_transicion_parcel") {
            //     context.push(`### Rules for 'update_transicion_parcel':\n- Update a single installment’s value or date.\n- Only use if the user specifies a correction on a specific parcel.`);
            // }

            if (key === "delete_parcel") {
                context.push(`### Rules for 'delete_parcel':\n- Use when the user says something like "delete the June installment" or similar.`);
                continue;
            }

            if (key === "create_notification") {
                context.push(`### Rules for 'create_notification':\n- Use when the user asks to be reminded to pay or record something periodically, never repeat the same create_notification creation.`);
                continue;
            }

            if (key === "update_notification") {
                context.push(`### Rules for 'update_notification':\n- Update fields like date, value, type or category of an existing reminder.`);
                continue;
            }

            if (key === "list_notifications") {
                context.push(`### Rules for 'list_notifications':\n- Use when the user asks to see scheduled or past reminders.`);
                continue;
            }

            if (key === "delete_notification") {
                context.push(`### Rules for 'delete_notification':\n- Use when user says things like "remove that reminder", etc.`);
                continue;
            }
        }
        return {
            content: context.join("\n\n"),
            role: "system"
        }

    }

    async sendMessage(userId: string): Promise<ChatCompletion> {
        let { messages, tools } = await this.buildUserContext(userId)
        return await this.client.chat.completions.create({ model: "gpt-4.1-nano", messages, tools: tools, tool_choice: "auto", max_completion_tokens: 500 })
    }

    async sendCustomMessage(tools: ChatCompletionTool[], messages: ChatCompletionMessageParam[], model: ChatModel, userId: string) {
        return await this.client.chat.completions.create({ model, messages, tools: tools, tool_choice: "auto"})
    }

    async createUserMonthAnalysis(userId: string) {
        let userContext = this.buildUserRelevantToolContext(userId, analysisOnlyTools)
        const { gastos, receitas, balance, byGroupSumExpenses, byGroupSumReceipts, total } = await dashboardService.buildDashboard(userId, 10000, 1, "month")
        const panel = await dashboardService.deepAnalysis(userId, 10000, 1, "month")
        const transaction = await dashboardService.transactionsWithMissingParcels(userId, 10000, 1, "month")
        let adicionalInfo = botMessages.contextExplanation(balance, receitas, gastos, transaction.entries, byGroupSumExpenses, byGroupSumReceipts, panel, total)
        let gptMessage = await this.sendCustomMessage(analysisOnlyTools, [userContext, adicionalInfo], "gpt-4.1-nano", userId)
        const toolCalled = gptMessage.choices?.[0]?.message?.tool_calls;
        
        if(toolCalled?.length === 0) throw new Error("No tool called")

        const tool = JSON.parse(toolCalled![0].function.arguments)
        const parsedTool = deepAnalysisValidation.parse(tool)

        return {
            ...parsedTool,
            panel,
            total,
            gastos,
            receitas
        }
    }

    async executeAction(func: { name: string; arguments: string }, userId: string) {
        let messageToSend: string;
        let summary: string;

        const name = func.name as ToolFunctionNames;
        const args = JSON.parse(func.arguments);
        let user = await userService.getUser(userId);
        const timeZone = user?.timeZone || "America/Sao_Paulo";
        switch (name) {
            case "add_finance": {
                const valid = gptCreateTransictionValidation.parse(args);
                const { transaction } = await transactionsService.createTransaction(valid, userId);
                const { databaseDate, userDate } = userDateTime(transaction.nextReferenceDate.toISOString(), user?.timeZone || "America/Sao_Paulo");
                messageToSend = botMessages.newFinance(transaction.category.name, transaction.value, transaction.recurrenceCount, transaction.description, userDate, transaction.id);
                summary = `Usuário criou uma transação: '${transaction.description}' no valor de R$ ${transaction.value.toNumber()} ${userDate} id dela : ${transaction.id}`;
                break;
            }

            case "list_analysis": {
                const { dataInicial, dataFinal, categoryId, description } = transactionAnalysisValidation(timeZone).parse(args);
                const rangeType: TransactionDateFilterType = (dataFinal && dataInicial) ? "custom" : "all";
                const transactions = await dashboardService.transactionsWithMissingParcels(userId, 10000, 1, rangeType, dataInicial, dataFinal, description, categoryId);
                const analysis = await dashboardService.buildDashboard(userId, 10000, 1, rangeType, dataInicial, dataFinal, description, categoryId);

                if (!transactions.entries.length) {
                    messageToSend = botMessages.listAnalyisNotFound();
                    summary = `Usuário tentou analisar finanças (${rangeType}), mas não havia dados.`;
                    break;
                }
                let receiptCount = analysis.byDay.reduce((acc, b) => acc + b.countGanho , 0)
                let expenseCount = analysis.byDay.reduce((acc, b) => acc + b.countGasto , 0)
                messageToSend = botMessages.listAnalyis(analysis.balance, analysis.receitas, analysis.gastos, analysis.byGroupSumExpenses, analysis.byGroupSumReceipts, receiptCount, expenseCount,dataInicial, dataFinal);
                summary = `Usuário analisou as finanças (${rangeType}) ${dataInicial && dataFinal ? `(de ${dataInicial} à ${dataFinal})` : ""}`;
                break;
            }

            case "list_entries": {
                const { categoryId, dataFinal, dataInicial, description } = transactionAnalysisValidation(timeZone).parse(args);
                const type: TransactionDateFilterType = (dataFinal || dataInicial) ? "custom" : "all";
                const transactions = await dashboardService.transactionsWithMissingParcels(userId, 1000, 1, type, dataInicial, dataFinal, description, categoryId);

                if (!transactions.entries.length) {
                    messageToSend = botMessages.listEntriesNotFound();
                    summary = `Usuário tentou listar transações com filtro de categoria/descrição/período, mas nada foi encontrado.`;
                    break;
                }

                messageToSend = botMessages.listEntries(transactions.entries);
                summary = `Usuário listou transações com filtros aplicados.`;
                break;
            }

            case "update_transaction": {
                const { new_value, new_description, categoryId, startDate, id } = updateEntryFieldValidation.parse(args);
                const entry = await transactionsService.getTransaction(id, userId);

                if (!entry) {
                    messageToSend = botMessages.entryNotFound();
                    summary = `Usuário tentou atualizar uma transação inexistente (id: ${id})`;
                    break;
                }

                const updateData: any = {};
                if (new_description !== undefined) updateData.description = new_description;
                if (new_value !== undefined) updateData.value = Decimal(new_value);
                if (categoryId !== undefined) updateData.categoryId = categoryId;
                if (startDate !== undefined) updateData.referenceDate = startDate;
                const updated = await transactionsService.updateTransaction(updateData, userId, entry.id);
                messageToSend = botMessages.updateEntry(updated.category.name, updated.value, updated.recurrenceCount, updated.description, updated.nextReferenceDate, updated.active);
                summary = `O usuário atualizou os campos ${Object.keys(updateData).join(" ")} na entry ${id}`;
                break;
            }

            case "update_transicion_parcel": {
                const data = updateParcelValidation.parse(args);
                try {
                    const update = await transactionsService.updateParcel(data, userId);
                    messageToSend = botMessages.updateParcel(update.value, update.createdAt);
                    summary = `Usuário atualizou parcela da transação para ${formatCurrency(update.value.toNumber())} (${update.id}).`;
                } catch (error) {
                    messageToSend = botMessages.parcelNotFound();
                    summary = `Usuário queria atualizar a parcela da transação. para ${data.value ? formatCurrency(data.value) : ""} ${data.date ? formatDate(data.date) : ""} (${data.id}).`;
                }
                break;
            }

            case "create_notification": {
                const data = createNotificationValidation.parse(args);
                const created = await notificationService.createFutureGoalNotification(data, userId);
                messageToSend = botMessages.createdNotification(created);
                summary = `Usuário criou notificação (${created.id}): ${created.description}, R$ ${created.value}`;
                break;
            }

            case "update_notification": {
                const data = updateNotificationValidationGpt.parse(args);
                let find = await notificationService.getNotification(userId, data.id);
                if (!find) {
                    messageToSend = botMessages.notificatationNotFound();
                    summary = `Usuário tentou atualizar a notificação (${data.id}) mas ela não foi encontrada.`;
                    break;
                }
                const update = await notificationService.updateNotification(userId, data, data.id);
                messageToSend = botMessages.updateNotifications(update);
                summary = `Usuário atualizou notificação (${update.id}).`;
                break;
            }

            case "list_notifications": {
                const data = getNotificationsValidation.parse(args);
                const { notifications, pageInfo } = await notificationService.getNotifications(userId, data);

                if (!notifications.length) {
                    messageToSend = botMessages.listNotificationsNotFound();
                    summary = `Usuário tentou listar notificações, mas nenhuma foi encontrada.`;
                    break;
                }

                messageToSend = botMessages.listNotifications(notifications);
                summary = `Usuário listou notificações.`;
                break;
            }

            case "delete_notification": {
                const { id } = z.object({ id: z.number() }).parse(args);
                const find = await notificationService.getNotification(userId, id);

                if (!find) {
                    messageToSend = botMessages.notificatationNotFound();
                    summary = `Usuário tentou deletar notificação inexistente (id: ${id}).`;
                    break;
                }

                await notificationService.deleteNotification(find.id, userId);
                messageToSend =botMessages.notificationDeleted(find);
                summary = `Usuário deletou notificação (${find.id}).`;
                break;
            }

            case "delete_transaction": {
                const { id } = z.object({ id: z.number() }).parse(args);
                const find = await transactionsService.getTransaction(id, userId);

                if (!find) {
                    messageToSend = botMessages.entryNotFound();
                    summary = `Usuário tentou deletar transação inexistente (id: ${id}).`;
                    break;
                }

                await transactionsService.deleteTransaction(id, userId);
                messageToSend = botMessages.entryDeleted(find);
                summary = `Usuário deletou transação (${find.id}).`;
                break;
            }

            case "delete_parcel": {
                const { id } = z.object({ id: z.number() }).parse(args);
                const find = await transactionsService.getParcel(id, userId);

                if (!find) {
                    messageToSend = botMessages.parcelNotFound();
                    summary = `Usuário tentou deletar parcela inexistente (id: ${id}).`;
                    break;
                }

                await transactionsService.deleteParcel(id, userId);
                messageToSend = botMessages.parcelDeleted();
                summary = `Usuário deletou parcela (${find.id}).`;
                break;
            }

            case "escalate_to_human_support": {
                messageToSend = botMessages.talkToSupport();
                summary = `Usuário entrou em contato com um suporte.`;
                break;
            }

            default: {
                messageToSend = botMessages.toolNotfound();
                summary = `Usuário usou uma ferramenta desconhecida: "${name}"`;
            }
        }

        return { messageToSend, summary };
    }


    async handleMessage(message: ChatCompletion, userId: string) {
        const toolCalls = message.choices?.[0]?.message?.tool_calls;
        const results: { messageToSend: string; summary: string }[] = [];
        if (!toolCalls || toolCalls.length === 0) {
            const content = message.choices?.[0]?.message?.content || "❌ Nenhuma mensagem processável encontrada.";
            return { messageToSend: content, summary: `Conversou com o usuário: ${content}` };
        }
        console.log(toolCalls)
        for (const toolCall of toolCalls) {
            if (toolCall.function) {
                try {
                    const result = await this.executeAction(toolCall.function, userId);
                    results.push(result);
                } catch (error) {
                    const errorAsError = error as Error;
                    console.log(errorAsError);
                    results.push({ messageToSend: botMessages.errorMessage(error), summary: botMessages.errorMessage(errorAsError.message) });
                }
            }
        }

        return {
            messageToSend: results.map(r => r.messageToSend).join('\n\n'),
            summary: results.map(r => r.summary).join('\n'),
        };
    }

    private bufferToStream(buffer: Buffer, filename = "audio.ogg"): Readable {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // Isso simula um arquivo com nome para a OpenAI SDK
        (stream as any).path = filename;
        (stream as any).name = filename;

        return stream;
    }

    async transcriptReadable(audioBuffer: Buffer) {


        const transcription = await this.client.audio.transcriptions.create({
            file: this.bufferToStream(audioBuffer) as any,
            model: "whisper-1",
            response_format: "json",
            language: "pt"
        })

        console.log("🗣️ Transcrição:", transcription);

        return transcription
    }
}

export default new GPTservice();