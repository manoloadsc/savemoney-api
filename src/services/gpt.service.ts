import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionFunctionTool,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatModel,
} from "openai/resources";
import userService from "./user.service.js";
import { FromMessage } from "lib/prisma.js";
import tools, { analysisOnlyTools, ToolFunctionNames } from "gpt/tools.js";
import {
  gptCreateTransictionValidation,
  transactionAnalysisValidation,
  listTransactionsByDescriptionValidation,
  updateEntryFieldValidation,
} from "validatation/financial.validation.js";
import transactionsService from "./transactions.service.js";
import dashboardService from "./dashboard.service.js";
import { TransactionDateFilterType } from "types/transaction.js";
import { Decimal } from "@prisma/client/runtime/library";
import { formatCurrency, formatDate } from "utils/format.js";
import {
  deepAnalysisValidation,
  updateParcelValidation,
} from "validatation/transaction.validation.js";
import {
  createNotificationValidation,
  getNotificationsValidation,
  updateNotificationValidationGpt,
} from "validatation/notification.validation.js";
import notificationService from "./notification.service.js";
import { z } from "zod";
import botMessages from "gpt/botMessages.js";
import { Readable } from "stream";
import { userDateTime } from "lib/date.js";
import path from "path";
import { readFileSync } from "fs";
import {
  cosineL2,
  cosineSimilarity,
  isChitChat,
  l2,
  normalizeText,
} from "utils/embeggingsUtils.js";
import { formatInTimeZone } from "date-fns-tz";
import { notFoundError } from "errors/defaultErrors.js";
import { dedupeToolCalls } from "utils/antiDuplicate.js";

interface ToolEmbedding {
  name: string;
  vector: number[];
}

const DESTRUCTIVE = new Set<string>([
  "delete_transaction",
  "delete_parcel",
  "delete_notification",
]);

export type UserMonthAnalysis = Awaited<
  ReturnType<typeof GPTservice.prototype.createUserMonthAnalysis>
>;

class GPTservice {
  client: OpenAI;
  toolEmbeddings: ToolEmbedding[];
  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingPath = path.resolve(
      process.cwd(),
      "data",
      "toolEmbeddings.json"
    );
    this.toolEmbeddings = JSON.parse(readFileSync(embeddingPath, "utf-8"));
  }

  async selectRelevantTool(input: string) {
    if (!this.toolEmbeddings.length) {
      console.log("Nenhum embedding de tool carregado.");
      return { tools: [], isChitChat: false };
    }

    const embedResponse = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: `query: ${normalizeText(input)}`,
    });

    const userVector = l2(embedResponse.data[0].embedding as number[]);
    if (!Array.isArray(userVector) || userVector.length === 0) {
      return { tools: [], isChitChat: false };
    }

    const sims = this.toolEmbeddings
      .map((te) => {
        const score = cosineL2(userVector, l2(te.vector));
        return { name: te.name, score };
      })
      .sort((a, b) => b.score - a.score);

    const threshold = 0.26; // ajustado para 0.5 para maior sensibilidade

    const topNames = sims
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => s.name);

    let chitChat = isChitChat(input);
    console.log(chitChat, "isChitChat");
    return {
      tools: tools.filter((t) => topNames.includes(t.function.name)),
      isChitChat: chitChat,
    };
  }

  private async getUserContext(
    userId: string
  ): Promise<ChatCompletionMessageParam[]> {
    let messages = await userService.listUserMessages(userId);
    return messages.map((msg, index) => {
      return {
        role: msg.from === FromMessage.USER ? "user" : "assistant",
        content: `${msg.content}`,
      };
    });
  }

  private async buildUserContext(
    userId: string,
    directRules?: ChatCompletionMessageParam
  ): Promise<{
    messages: ChatCompletionMessageParam[];
    tools: ChatCompletionFunctionTool[];
  }> {
    let messages: ChatCompletionMessageParam[];
    let messageContext = await userService.listUserMessages(userId, 3, "USER");
    let msgCtxLast = messageContext[messageContext.length - 1];

    const contextTools = await this.selectRelevantTool(
      messageContext.map((msg) => msg.content).join(" ")
    );
    const lastMessageContext = await this.selectRelevantTool(
      msgCtxLast.content
    );

    const contextToolsToSend = (
      !lastMessageContext.isChitChat
        ? lastMessageContext.tools
        : lastMessageContext.tools.length === 0
          ? contextTools.tools
          : lastMessageContext.tools
    ) as ChatCompletionFunctionTool[];
    console.log(
      "tools : ",
      contextToolsToSend.map((c) => c.function.name).join(", ")
    );
    let userContext = await this.getUserContext(userId);
    const user = await userService.getUser(userId);
    messages = userContext;
    if (directRules) {
      messages.push(directRules);
    } else {
      let userRules = this.buildUserRelevantToolContext(
        userId,
        user?.timeZone || "America/Sao_Paulo",
        contextToolsToSend
      );
      messages.push(userRules);
    }
    return { messages, tools: contextToolsToSend };
  }

  private buildUserRelevantToolContext(
    userId: string,
    userTimezone: string,
    tools: ChatCompletionFunctionTool[]
  ): ChatCompletionMessageParam {
    const keys = tools.map((t) => t.function.name) as ToolFunctionNames[];
    const have = new Set<ToolFunctionNames>(keys);

    const today = formatInTimeZone(
      new Date(),
      userTimezone,
      "yyyy-MM-dd HH:mm"
    );
    console.log("userTimezone", userTimezone, today);
    const context: string[] = [];

    context.push(
      `Financial assistant for user ${userId} (${today}). Always respond in Spanish`
    );
    context.push(`
When using the following tools: add_finance, update_transaction, create_notification, update_notification
→ NEVER call them with a date earlier than ${today}.
All past dates (earlier than ${today}) are invalid and must be rejected.
`);
    context.push(
      `You have access to financial tools. Use them automatically when relevant.`
    );
    context.push(`Do not echo context or meta-messages.`);
    context.push(
      `All input dates must follow this format: YYYY-MM-DDTHH:mm:ss.sss (never include Z).`
    );
    context.push(
      `When parsing times like "3 o'clock", default to 15:00 (PM) unless AM is explicitly stated.`
    );
    context.push(
      `Category mapping: 1 = donations, 2 = Courses, 3 = Travel, 4 = Entertainment, 5 = Salary, 6 = Rent, 7 = Aid, 8 = Revenue, 9 = Food, 10 = Transport, 11 = Housing, 12 = Leisure, 13 = Education, 14 = Clothing, 15 = Accessories, 16 = Gifts, 17 = Pets, 18 = Beauty, 19 = Other.`
    );
    context.push(
      `never, call functions inside the message to the user, something like this: { tool_uses : "funcion_name" }, are completely wrong, and should not be done under any circumstances, only use functions with their native functionality, not as text in text message.`
    );
    context.push(`Just call for tools when you need them.`);
    context.push(
      `Act **only** based on the user's **last** message.
Never create transactions from older messages in the history that have already been responded to by the assistant.`
    );

    // Regras por ferramenta (ordem determinística)
    if (have.has("add_finance")) {
      context.push(
        `Rules for add_finance:`,
        `If the user mentions multiple purchases, create one function call per item.`,
        `Never merge multiple purchases into one transaction.`,
        `Be careful to not duplicate transactions with the same description.`,
        `Infer the categoryId from the description. Never ask the user.`,
        `If the user reports spending on the stock market, categorize it as an investment expense, and stay alert for similar cases.`,
        `Avoid using 'others' category. Try to categorize as much as possible.`,
        // ATENÇÃO: mantenha exatamente os literais que seu backend espera.
        // Se seu sistema usa 'DIARY' e 'WEECKLY', não mude para 'DAILY'/'WEEKLY'.
        `recurringType is DIARY WEECKLY MONTHLY YEARLY.`
      );
    }

    if (have.has("list_entries")) {
      context.push(
        `### Rules for 'list_entries':`,
        `- Only use if the user explicitly requests a list or wants to review entries.`
      );
    }

    if (have.has("get_month_information")) {
      context.push(
        `Always use to have the context to execute the deep_analysis tool, to confirm you have context already, find on your context messages the 'CTX TO DEEP_ANALYSIS' key phrase on the text.`
      );
    }

    if (have.has("list_analysis")) {
      context.push(
        `### Rules for 'list_analysis':`,
        `- Only call when the user asks for insights, summaries, or analysis over time.`
      );
    }

    if (have.has("deep_analysis")) {
      context.push(
        `### Rules for 'deep_analysis':`,
        `Financial Coaching Methodology:
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
Use emojis on the answers to make it more human-like.

USE THIS TOOL if in your context have: 'CTX TO DEEP_ANALYSIS'.
To complete the metrics and emergency objects, follow the provided rules and generate a feedback message; the same applies to prosperity.

exemplo:
metrics: {
  essentials: 'Voce gastou mais do que deveria com o essencial',
  leisure: 'Ganhou o suficiente dinheiro para passar no lazer',
  education: 'Voce gastou mais do que deveria com a Educação',
  investments: 'Voce gastou mais do que deveria com os Investimentos',
  dreams: 'Voce gastou mais do que deveria com os Sonhos'
}
follow the same pattern to generate prosperity object.`
      );
    }

    if (have.has("update_transaction")) {
      context.push(
        `### Rules for 'update_transaction':`,
        `- Only update 'valor', 'description' or 'categoryId'.`,
        `- Trigger only when user provides corrections like "na verdade era X reais".`
      );
    }

    if (have.has("escalate_to_human_support")) {
      context.push(
        `### when user ask how can talk with human support, or ask for help about something or do a request.`
      );
    }

    if (have.has("delete_parcel")) {
      context.push(
        `### Rules for 'delete_parcel':`,
        `- Use when the user says something like "delete the June installment" or similar.`
      );
    }

    if (have.has("create_notification")) {
      context.push(
        `### Rules for 'create_notification':`,
        `- Use when the user asks to be reminded to pay or record something periodically, never repeat the same create_notification creation.`,
        // Observação da sua regra original:
        `NEVER SEND DAILY in period, use DIARY instead.`,
        `period is DIARY WEECKLY MONTHLY YEARLY.`
      );
    }

    if (have.has("update_notification")) {
      context.push(
        `### Rules for 'update_notification':`,
        `- Update fields like date, value, type or category of an existing reminder.`
      );
    }

    if (have.has("list_notifications")) {
      context.push(
        `### Rules for 'list_notifications':`,
        `- Use when the user asks to see scheduled or past reminders.`
      );
    }

    if (have.has("delete_notification")) {
      context.push(
        `### Rules for 'delete_notification':`,
        `- Use when user says things like "remove that reminder", etc.`
      );
    }

    // ✅ Retorno garantido
    return {
      role: "system",
      content: context.join("\n\n"),
    };
  }

  async sendMessage(userId: string): Promise<ChatCompletion> {
    let { messages, tools } = await this.buildUserContext(userId);
    return this.client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      tools, // já filtradas
      tool_choice: "auto", // ou "required" se quiser forçar tool-call
      max_completion_tokens: 1500, // use max_tokens no Chat Completions
    });
  }

  async sendCustomMessage(
    tools: ChatCompletionTool[],
    messages: ChatCompletionMessageParam[],
    model: ChatModel,
    userId: string
  ) {
    return await this.client.chat.completions.create({
      model,
      messages,
      tools: tools,
      tool_choice: "auto",
    });
  }

  async createUserMonthAnalysis(
    userId: string,
    userTimezone: string,
    currency: string
  ) {
    let userContext = this.buildUserRelevantToolContext(
      userId,
      userTimezone,
      analysisOnlyTools
    );
    const {
      gastos,
      receitas,
      balance,
      byGroupSumExpenses,
      byGroupSumReceipts,
      total,
    } = await dashboardService.buildDashboard(userId, 10000, 1, "month");
    const panel = await dashboardService.deepAnalysis(
      userId,
      10000,
      1,
      "month"
    );
    const transaction = await dashboardService.transactionsWithMissingParcels(
      userId,
      10000,
      1,
      "month"
    );
    let adicionalInfo = botMessages.contextExplanation(
      balance,
      receitas,
      gastos,
      transaction.entries,
      byGroupSumExpenses,
      byGroupSumReceipts,
      panel,
      total,
      currency
    );
    let gptMessage = await this.sendCustomMessage(
      analysisOnlyTools,
      [userContext, adicionalInfo],
      "gpt-4.1-mini",
      userId
    );
    const toolCalled = gptMessage.choices?.[0]?.message?.tool_calls as
      | ChatCompletionMessageFunctionToolCall[]
      | undefined;

    if (toolCalled?.length === 0) throw new Error("No tool called");

    const tool = JSON.parse(toolCalled![0].function.arguments);
    const parsedTool = deepAnalysisValidation.parse(tool);

    return {
      ...parsedTool,
      panel,
      total,
      gastos,
      receitas,
    };
  }

  async executeAction(
    func: { name: string; arguments: string },
    userId: string
  ) {
    let messageToSend: string;
    let summary: string;

    const name = func.name as ToolFunctionNames;
    const args = JSON.parse(func.arguments);
    let user = await userService.getUser(userId);

    if (!user) {
      throw notFoundError("User not found");
    }

    const timeZone = user.timeZone || "America/Sao_Paulo";
    switch (name) {
      case "add_finance": {
        let valid = gptCreateTransictionValidation.parse(args);

        if (
          valid.categoryId === 19 &&
          (valid.description.toLowerCase().includes("investimento") ||
            valid.description.toLowerCase().includes("investi"))
        ) {
        }

        const { transaction } = await transactionsService.createTransaction(
          valid,
          userId
        );
        const { databaseDate, userDate } = userDateTime(
          transaction.nextReferenceDate.toISOString(),
          user.timeZone || "America/Sao_Paulo"
        );
        messageToSend = botMessages.newFinance(
          transaction.category.name,
          transaction.value,
          transaction.recurrenceCount,
          transaction.description,
          userDate,
          transaction.id,
          user.currency!
        );
        userService.updateLastUsedAt(userId);
        summary = `( não gere novamente ) Usuário criou uma transação: '${transaction.description}' no valor de R$ ${transaction.value.toNumber()} ${userDate} id dela : ${transaction.id}`;
        break;
      }

      case "list_analysis": {
        const { dataInicial, dataFinal, categoryId, description } =
          transactionAnalysisValidation(timeZone).parse(args);
        const rangeType: TransactionDateFilterType =
          dataFinal && dataInicial ? "custom" : "all";
        const transactions =
          await dashboardService.transactionsWithMissingParcels(
            userId,
            10000,
            1,
            rangeType,
            dataInicial,
            dataFinal,
            description,
            categoryId
          );
        const analysis = await dashboardService.buildDashboard(
          userId,
          10000,
          1,
          rangeType,
          dataInicial,
          dataFinal,
          description,
          categoryId
        );

        if (!transactions.entries.length) {
          messageToSend = botMessages.listAnalyisNotFound();
          summary = `Usuário tentou analisar finanças (${rangeType}), mas não havia dados.`;
          break;
        }
        let receiptCount = analysis.byDay.reduce(
          (acc, b) => acc + b.countGanho,
          0
        );
        let expenseCount = analysis.byDay.reduce(
          (acc, b) => acc + b.countGasto,
          0
        );
        messageToSend = botMessages.listAnalyis(
          analysis.balance,
          analysis.receitas,
          analysis.gastos,
          analysis.byGroupSumExpenses,
          analysis.byGroupSumReceipts,
          receiptCount,
          expenseCount,
          user.currency!,
          dataInicial,
          dataFinal
        );
        summary = `Usuário analisou as finanças (${rangeType}) ${dataInicial && dataFinal ? `(de ${dataInicial} à ${dataFinal})` : ""}`;
        break;
      }

      case "list_entries": {
        const { categoryId, dataFinal, dataInicial, description } =
          transactionAnalysisValidation(timeZone).parse(args);
        const type: TransactionDateFilterType =
          dataFinal || dataInicial ? "custom" : "all";
        const transactions =
          await dashboardService.transactionsWithMissingParcels(
            userId,
            1000,
            1,
            type,
            dataInicial,
            dataFinal,
            description,
            categoryId
          );

        if (!transactions.entries.length) {
          messageToSend = botMessages.listEntriesNotFound();
          summary = `Usuário tentou listar transações com filtro de categoria/descrição/período, mas nada foi encontrado.`;
          break;
        }

        messageToSend = botMessages.listEntries(transactions.entries, user.currency!);
        summary = `Usuário listou transações com filtros aplicados.`;
        break;
      }

      case "update_transaction": {
        const { new_value, new_description, categoryId, startDate, id } =
          updateEntryFieldValidation.parse(args);
        const entry = await transactionsService.getTransaction(id, userId);

        if (!entry) {
          messageToSend = botMessages.entryNotFound();
          summary = `Usuário tentou atualizar uma transação inexistente (id: ${id})`;
          break;
        }

        const updateData: any = {};
        if (new_description !== undefined)
          updateData.description = new_description;
        if (new_value !== undefined) updateData.value = Decimal(new_value);
        if (categoryId !== undefined) updateData.categoryId = categoryId;
        if (startDate !== undefined) updateData.referenceDate = startDate;
        const updated = await transactionsService.updateTransaction(
          updateData,
          userId,
          entry.id
        );
        messageToSend = botMessages.updateEntry(
          updated.category.name,
          updated.value,
          updated.recurrenceCount,
          updated.description,
          updated.nextReferenceDate,
          updated.active,
          user
        );
        userService.updateLastUsedAt(userId);
        summary = `O usuário atualizou os campos ${Object.keys(updateData).join(" ")} na entry ${id}`;
        break;
      }

      case "update_transicion_parcel": {
        const data = updateParcelValidation.parse(args);
        try {
          const update = await transactionsService.updateParcel(data, userId);
          messageToSend = botMessages.updateParcel(
            update.value,
            update.createdAt,
            user
          );
          summary = `Usuário atualizou parcela da transação para ${formatCurrency(update.value.toNumber(), user.currency!)} (${update.id}).`;
        } catch (error) {
          messageToSend = botMessages.parcelNotFound();
          summary = `Usuário queria atualizar a parcela da transação. para ${data.value ? formatCurrency(data.value, user.currency!) : ""} ${data.date ? formatDate(data.date) : ""} (${data.id}).`;
        }
        break;
      }

      case "create_notification": {
        const data = createNotificationValidation(
          user.timeZone || "America/Sao_Paulo"
        ).parse(args);

        if (data.referenceDate < new Date()) {
          messageToSend = botMessages.notificationDateInPast(
            data.referenceDate,
            user.timeZone || "America/Sao_Paulo"
          );
          summary = `Usuário tentou criar a notificação : (${data.description}) (${formatCurrency(data.value?.toNumber() || 0, user.currency!)}), tenho que verificar se foi um erro meu ou do usuário o fato da data informada na notificação ser do passado. `;
          break;
        }

        const created = await notificationService.createFutureGoalNotification(
          data,
          userId
        );
        messageToSend = botMessages.createdNotification(created, user);
        summary = `Usuário criou notificação (${created.id}): ${created.description}, R$ ${created.value}`;
        break;
      }

      case "update_notification": {
        const data = updateNotificationValidationGpt(
          user.timeZone || "America/Sao_Paulo"
        ).parse(args);
        let find = await notificationService.getNotification(userId, data.id);
        if (!find) {
          messageToSend = botMessages.notificatationNotFound();
          summary = `Usuário tentou atualizar a notificação (${data.id}) mas ela não foi encontrada.`;
          break;
        }
        const update = await notificationService.updateNotification(
          userId,
          data,
          data.id
        );
        messageToSend = botMessages.updateNotifications(update, user);
        summary = `Usuário atualizou notificação (${update.id}).`;

        break;
      }

      case "list_notifications": {
        const data = getNotificationsValidation.parse(args);
        const { notifications, pageInfo } =
          await notificationService.getNotifications(userId, data);

        if (!notifications.length) {
          messageToSend = botMessages.listNotificationsNotFound();
          summary = `Usuário tentou listar notificações, mas nenhuma foi encontrada.`;
          break;
        }

        messageToSend = botMessages.listNotifications(notifications, user);
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
        messageToSend = botMessages.notificationDeleted(find);
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
    const toolCalls = message.choices?.[0]?.message?.tool_calls as
      | ChatCompletionMessageFunctionToolCall[]
      | undefined;
    const results: { messageToSend: string; summary: string }[] = [];
    if (!toolCalls || toolCalls.length === 0) {
      const content =
        message.choices?.[0]?.message?.content ||
        "❌ Nenhuma mensagem processável encontrada.";

      if (content.includes("{") || content.includes("}")) {
        return {
          messageToSend: `Ocorreu um erro em : "${message}", não consegui identificar corretamente o que eu devetirar fazer, pode me falar novamente ?`,
          summary: `a inteligencia aritificial não chamou a função relevante e mandou um json como texto. e se desculpou como o usuário.`,
        };
      }

      return {
        messageToSend: content,
        summary: `Conversou com o usuário: ${content}`,
      };
    }

    const dedupedCalls = dedupeToolCalls(toolCalls);

    for (const toolCall of dedupedCalls) {
      if (toolCall.function) {
        try {
          const result = await this.executeAction(toolCall.function, userId);
          results.push(result);
        } catch (error) {
          const errorAsError = error as Error;
          console.log(errorAsError);
          results.push({
            messageToSend: botMessages.errorMessage(error),
            summary: botMessages.errorMessage(errorAsError.message),
          });
        }
      }
    }

    return {
      messageToSend: results.map((r) => r.messageToSend).join("\n\n"),
      summary: results.map((r) => r.summary).join("\n"),
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
      language: "pt",
    });

    console.log("🗣️ Transcrição:", transcription);

    return transcription;
  }
}

export default new GPTservice();
