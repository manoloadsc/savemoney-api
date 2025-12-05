import { FastifyInstance } from "fastify";
import whopService from "../services/whop.service.js";
import { WhopWebhookPayload } from "../types/whop.js";
import { makeWebhookValidator } from "@whop/api";

// Inicializa o validador de webhook do Whop
const validateWhopWebhook = makeWebhookValidator(process.env.WHOP_WEBHOOK_SECRET!);

export default async function WhopRoutes(app: FastifyInstance) {
  /**
   * Endpoint para receber webhooks do Whop
   * URL: POST /whop/webhook
   */
  app.post<{ Body: WhopWebhookPayload }>(
    "/webhook",
    {
      config: {
        // Desabilita parsing automático do body para validar assinatura
        rawBody: true,
      },
    },
    async (req, res) => {
      try {
        // 1) Valida assinatura do webhook
        const signature = req.headers["x-whop-signature"] as string;
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);

        const isValid = validateWhopWebhook(rawBody, signature);

        if (!isValid) {
          console.error("[Whop] Assinatura de webhook inválida");
          return res.status(401).send({ error: "Invalid signature" });
        }

        // 2) Processa o evento
        const { action, data } = req.body;

        console.log(`[Whop] Webhook recebido: ${action}`);

        switch (action) {
          // === MEMBERSHIP EVENTS ===
          case "membership_activated":
            await whopService.membershipActivated(data);
            break;

          case "membership_deactivated":
            await whopService.membershipDeactivated(data);
            break;

          // === PAYMENT EVENTS ===
          case "payment_succeeded":
            await whopService.paymentSucceeded(data);
            break;

          case "payment_failed":
            console.warn(`[Whop] Pagamento falhou: ${data.id}`);
            break;

          case "payment_pending":
            console.log(`[Whop] Pagamento pendente: ${data.id}`);
            break;

          // === INVOICE EVENTS (Opcional) ===
          case "invoice_paid":
            console.log(`[Whop] Fatura paga: ${data.id}`);
            break;

          case "invoice_past_due":
            console.warn(`[Whop] Fatura vencida: ${data.id}`);
            break;

          case "invoice_voided":
            console.log(`[Whop] Fatura cancelada: ${data.id}`);
            break;

          // === OUTROS EVENTOS ===
          default:
            console.log(`[Whop] Evento não tratado: ${action}`);
            break;
        }

        // 3) Retorna 200 OK para o Whop
        return res.status(200).send({ received: true });
      } catch (error) {
        console.error("[Whop] Erro ao processar webhook:", error);
        return res.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * Endpoint de teste (opcional - remover em produção)
   * URL: GET /whop/test
   */
  app.get("/test", async (req, res) => {
    return res.send({
      message: "Whop integration active",
      timestamp: new Date().toISOString(),
    });
  });
}
