import { FastifyInstance } from "fastify";
import whopService from "../services/whop.service.js";
import { WhopPaymentdEvent, WhopWebhookPayload } from "../types/whop.js";
import { makeWebhookValidator } from "@whop/api";

export default async function WhopRoutes(app: FastifyInstance) {
  app.post<{ Body: WhopPaymentdEvent }>("/webhook", async (req, res) => {
    try {
      const data = req.body;

      switch (data.type) {
        case "payment.succeeded":
          whopService.membershipActivated(data);
        case "refund_created":
          whopService.membershipDeactivated(data);
      }

      return res.status(200).send({ ok: true });
    } catch (erro) {
      console.error("[Whop] Erro ao validar webhook:", erro);
      return res.status(400).send({ error: "Invalid signature or payload" });
    }
  });

  app.get("/test", async (req, res) => {
    return res.send({
      message: "Whop integration active",
      timestamp: new Date().toISOString(),
    });
  });
}
