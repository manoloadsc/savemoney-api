import axios from "axios";
import { UserMonthAnalysis } from "./gpt.service.js";
import { formatCurrency } from "utils/format.js";
import { toText } from "utils/toText.js";

class WhatssapService {
  postUrl: string;

  constructor() {
    this.postUrl = `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`;
  }
  async sendMessage(content: string, to: string) {
    try {
      const response = await axios.post(
        this.postUrl,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "text",

          text: {
            body: content,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.META_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.log(error.response.data);
    }
  }

  async getMediaUrl(mediaId: string) {
    const response = await axios.get(
      `https://graph.facebook.com/v22.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.META_API_KEY}`,
        },
      }
    );
    return response.data.url;
  }

  async downloadMedia(url: string) {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${process.env.META_API_KEY}`,
      },
    });

    return Buffer.from(response.data, "binary");
  }

  async sendNotificationTemplate(
    to: string,
    nome: string,
    descricao: string,
    valor: string
  ) {
    try {
      const response = await axios.post(
        this.postUrl,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: "notificacao_transaction", // nome exato do template
            language: {
              code: "es",
            },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: nome },
                  { type: "text", text: descricao },
                  { type: "text", text: valor },
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.META_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Pegue o ID da mensagem aqui
      const messageId = response.data.messages?.[0]?.id;
      console.log("Enviado com sucesso. ID da mensagem:", messageId);

      return {
        messageId,
        status: "success",
      };
    } catch (error: any) {
      console.error(
        "Erro ao enviar template:",
        error.response?.data || error.message
      );
      return { error: true };
    }
  }

  async activeAccountNumber(to: string, authCode: string) {
    try {
      const response = await axios.post(
        this.postUrl,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: "ativar_conta", // nome exato do template
            language: {
              code: "es",
            },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: authCode }],
              },
              {
                type: "button",
                sub_type: "url", // ou "quick_reply", depende do seu template
                index: 0,
                parameters: [
                  { type: "text", text: authCode }, // ou outro valor para o link
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.META_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const messageId = response.data.messages?.[0]?.id;

      return {
        messageId,
        status: "success",
      };
    } catch (error: any) {
      console.error(
        "Erro ao enviar template:",
        error.response?.data || error.message
      );
      return { error: true };
    }
  }

  async sendUserNotFound(to: string) {
    let message = `¡Hola! 👋 Hemos identificado que aún no tienes un registro activo o tu suscripción no está al día.

  Para continuar utilizando SaveMoney, es necesario registrarte o reactivar tu suscripción.

  👉 Haz clic aquí para registrarte o reactivar: ${process.env.ENVIRONMENT == "DEV" ? "https://dev.economize-ai.com" : "https://www.savemoneyy.com"}

    `;

    return this.sendMessage(message, to);
  }

  async sendTransacionParcelTemplate(
    to: string,
    nome: string,
    descricao: string,
    valor: string
  ) {
    try {
      const response = await axios.post(
        this.postUrl,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: "transacao_nova",
            language: {
              code: "es",
            },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: nome },
                  { type: "text", text: descricao },
                  { type: "text", text: valor },
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.META_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Pegue o ID da mensagem aqui
      const messageId = response.data.messages?.[0]?.id;
      console.log("Enviado com sucesso. ID da mensagem:", messageId);

      return {
        messageId,
        status: "success",
      };
    } catch (error: any) {
      console.error(
        "Erro ao enviar template:",
        error.response?.data || error.message
      );
      return { error: true };
    }
  }

  async sendNotifyUser(to: string, nome: string) {
    const response = await axios.post(
      this.postUrl,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: "use_reminder",
          language: {
            code: "es",
          },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: nome }],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.META_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const messageId = response.data.messages?.[0]?.id;

    return {
      messageId,
      status: "success",
    };
  }

  async noPriceNotification(
    to: string,
    nome: string,
    notificationName: string
  ) {
    const reponse = await axios.post(
      this.postUrl,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: "simple_notification",
          language: {
            code: "es",
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: nome },
                { type: "text", text: notificationName },
              ],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.META_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const messageId = reponse.data.messages?.[0]?.id;

    return {
      messageId,
      status: "success",
    };
  }

  async userMonthAnalysis(
    to: string,
    content: UserMonthAnalysis,
    currency: string
  ) {
    const {
      panel,
      total,
      receitas,
      resume,
      metrics,
      plan,
      next_30days,
      next_90days,
      bye_message,
      actionPlan,
    } = content;
    const {
      essencials,
      investiments,
      isLeisure,
      draeamAndReservation,
      education,
    } = panel;

    const proxs14 = [...(actionPlan ?? []), ...(next_30days ?? [])] // junta as duas listas
      .slice(0, 4) // pega até 4 itens
      .map((s) => toText(s || "opção"));

    const proxs90 = (next_90days ?? [])
      .slice(0, 3)
      .map((s) => toText(s || "opção"));

    const params = [
      {
        type: "text",
        text: `${formatCurrency(essencials.value, currency)} (${essencials.percentage.toFixed(2)}%)`,
      },
      {
        type: "text",
        text: `${formatCurrency(isLeisure.value, currency)} (${isLeisure.percentage.toFixed(2)}%)`,
      },
      {
        type: "text",
        text: `${formatCurrency(education.value, currency)} (${education.percentage.toFixed(2)}%)`,
      },
      {
        type: "text",
        text: `${formatCurrency(investiments.value, currency)} (${investiments.percentage.toFixed(2)}%)`,
      },
      {
        type: "text",
        text: `${formatCurrency(draeamAndReservation.value, currency)} (${draeamAndReservation.percentage.toFixed(2)}%)`,
      },
      { type: "text", text: `${formatCurrency(receitas, currency)}` },
      { type: "text", text: `${resume}` },
      { type: "text", text: `${metrics.essentials}` },
      { type: "text", text: `${metrics.leisure}` },
      { type: "text", text: `${metrics.education}` },
      { type: "text", text: `${metrics.investments}` },
      { type: "text", text: `${metrics.dreams}` },
      { type: "text", text: `${plan}` },
      ...proxs14,
      ...proxs90,
      toText(bye_message),
    ];

    try {
      const response = await axios.post(
        this.postUrl,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: "notificacao_analise",
            language: {
              code: "es",
            },
            components: [
              {
                type: "body",
                parameters: params,
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.META_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const messageId = response.data.messages?.[0]?.id;
      return messageId;
    } catch (error: any) {
      console.log(error.message);
      console.log(error.response);
    }
  }
}

export default new WhatssapService();
