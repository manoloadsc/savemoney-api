import cron from "node-cron";
import prisma, { Interval } from "../lib/prisma.js";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import transactionsService from "./transactions.service.js";
import notificationService from "./notification.service.js";
import whatssapService from "./whatssap.service.js";
import { formatCurrency } from "utils/format.js";
import userService from "./user.service.js";
import gptService from "./gpt.service.js";
import hotmartService from "./hotmart.service.js";

class scheduleService {
  constructor() {}

  async start() {
    cron.schedule("* * * * *", async () => {
      console.log("🔔 Eviando notificação");
      const usersToNotify = await userService.getUsersToNotify(3);
      const messages = usersToNotify.map(async (user) => {
        console.log(
          `🔔 Notificação para usuário: ${user.chat_id} ${user.name}`
        );
        whatssapService.sendNotifyUser(user.chat_id!, user.name);
        userService.lastNotifiedAt(user.id);
      });
      try {
        await Promise.all(messages);
      } catch (error: any) {
        console.log(error.message);
      }
    });

    cron.schedule("0 3 * * *", async () => {
      try {
        console.log("[cron] plan-expiry START");
        await hotmartService.runPlanExpiryJob();
        console.log("[cron] plan-expiry DONE");
      } catch (err) {
        console.error("[cron] plan-expiry ERROR", err);
      }
    });

    cron.schedule("* * * * *", async () => {
      const today = new Date();
      let nextDay = addDays(today, 1);
      let actualHour = today.getHours();
      if (nextDay.getDate() === 1 && actualHour > 12) {
        const users = await userService.findUsersToSendAnalyis();
        const promises = users.map(async (user) => {
          const analysis = await gptService.createUserMonthAnalysis(
            user.id,
            user.timeZone || "America/Sao_Paulo",
            user.currency!
          );
          try {
            const messageId = await whatssapService.userMonthAnalysis(
              user.chat_id!,
              analysis
            );
            console.log(messageId);
          } catch (error: any) {
            console.log(
              `Erro ao enviar notificação para o usuário: ${user.chat_id} ${user.name} ${error.message}`
            );
            console.log(error);
          }
        });

        Promise.all(promises);
      }
    });

    // ✅ CRON A CADA MINUTO → processa notificações CONFIRM
    cron.schedule("* * * * *", async () => {
      console.log(new Date());
      const confirms = await notificationService.getGoalsNotificationsToSend();
      for (const notification of confirms) {
        // 🔔 Aqui você pode disparar um alerta real ("Você comprou?")
        console.log(
          `🔔 Notificação ${notification.purpose} para usuário: ${notification.id} ${notification.user.chat_id} ${notification.user.name}`
        );
        let notificationId;

        try {
          if (notification.purpose === "CONFIRM") {
            if (notification.value.equals(0)) {
              const { messageId } = await whatssapService.noPriceNotification(
                notification.user.chat_id!,
                notification.user.name,
                notification.description
              );
              notificationId = messageId;
            } else {
              const { messageId } =
                await whatssapService.sendNotificationTemplate(
                  notification.user.chat_id!,
                  notification.user.name,
                  notification.description,
                  formatCurrency(notification.value!, notification.user.currency!)
                );
              notificationId = messageId;
            }
          }

          if (notification.purpose === "INFO") {
            const { messageId } =
              await whatssapService.sendTransacionParcelTemplate(
                notification.user.chat_id!,
                notification.user.name,
                notification.description,
                formatCurrency(notification.value, notification.user.currency!)
              );
          }
        } catch (error: any) {
          console.log(
            `Erro ao enviar notificação para o usuário: ${notification.id} ${notification.user.chat_id} ${notification.user.name} ${error}`
          );
          console.log(error);
        }

        // Atualiza próxima execução
        const next = this.calculateNext(
          notification.nextNotificationDate!,
          notification.recurrenceIntervalDays
        );

        try {
          await prisma.notifications.update({
            where: { id: notification.id },
            data: {
              nextNotificationDate: next,
              notificationTimes: { increment: 1 },
              active: !(
                notification.notificationTimes + 1 ===
                notification.recurrenceCount
              ),
            },
          });

          await notificationService.createNotificationMessage(
            notification.id,
            notificationId
          );
        } catch (error) {
          console.log(error);
        }
      }

      const transactionsIds =
        await transactionsService.getTransactionNeedNextParcelIds();
      for (const tx of transactionsIds) {
        // Cria a próxima parcela
        await transactionsService.createNextParcel(tx.id, tx.userId);
      }
    });

    cron.schedule("0 * * * *", async () => {
      await userService.deleteUsersMessagesOldMessages();
    });
  }

  calculateNext(current: Date, interval: Interval): Date {
    switch (interval) {
      case "DIARY":
        return addDays(current, 1);
      case "WEECKLY":
        return addWeeks(current, 1);
      case "MONTHLY":
        return addMonths(current, 1);
      case "YEARLY":
        return addYears(current, 1);
      default:
        return current;
    }
  }
}

export default new scheduleService();
