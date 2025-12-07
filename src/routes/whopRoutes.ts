import { FastifyInstance } from "fastify";
import whopService from "../services/whop.service.js";
import { WhopWebhookPayload } from "../types/whop.js";
import { makeWebhookValidator } from "@whop/api";

export default async function WhopRoutes(app: FastifyInstance) {
  /**
   * Endpoint para receber webhooks do Whop
   * URL: POST /whop/webhook
   */
  app.post<{ Body: WhopWebhookPayload }>("/webhook", async (req, res) => {
    try {
      console.log(req.body);

      return res.status(200).send({ ok: true });
    } catch (erro) {
      console.error("[Whop] Erro ao validar webhook:", erro);
      return res.status(400).send({ error: "Invalid signature or payload" });
    }
  });

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
