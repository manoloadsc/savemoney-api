import fp from 'fastify-plugin'
import { handleStripeWebhook } from '../lib/stripe.js';
import { FastifyInstance } from 'fastify';
import stripeService from 'services/stripeService.js';

export default fp(async function stripeWebhookPlugin(server: FastifyInstance) {
  // Registrando escopo isolado para o webhook
  server.register(async function (stripeScope) {
    // 👇 Esse parser só afeta as rotas DENTRO desse escopo
    stripeScope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      function (req, body, done) {
        done(null, { raw: body });
      }
    );

    stripeScope.post("/stripe/webhook", { schema : { hide : true } } ,
      async (req, res) => {
      const sig = req.headers["stripe-signature"] as string;
      console.log((req.body as any).raw)

      try {
        const event = await stripeService.constructEvent(sig, (req.body as any).raw)

        console.log("✅ Stripe webhook recebido:", event.type);

        res.status(200).send("success");
        await handleStripeWebhook(event);
      } catch (error: any) {
        console.error("❌ Erro Stripe webhook:", error.message);
        return res.status(400).send(`Webhook error: ${error.message}`);
      }
    });
  });
});