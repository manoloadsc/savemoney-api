import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { handleStripeWebhook } from '../lib/stripe.js'
import stripeService from 'services/stripeService.js'

export default fp(async function stripeWebhookPlugin(server: FastifyInstance) {
  server.register(async function (stripeScope) {
    // 1) Desativa todos os parsers nesse escopo
    stripeScope.removeAllContentTypeParsers()

    // 2) Recria UM parser que devolve Buffer p/ JSON (com ou sem charset)
    stripeScope.addContentTypeParser(
      /^application\/json($|;)/i,
      { parseAs: 'buffer' },
      (req, body, done) => done(null, body) // body = Buffer cru
    )

    // (Opcional, mas útil): caso venha text/plain por algum motivo
    stripeScope.addContentTypeParser(
      /^text\/plain($|;)/i,
      { parseAs: 'buffer' },
      (req, body, done) => done(null, body)
    )

    stripeScope.post('/stripe/webhook', { schema: { hide: true } }, async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string | undefined
      if (!sig) return reply.code(400).send('Missing stripe-signature')

      const buf = req.body as Buffer
      // logs rápidos de diagnóstico (remova depois)
      console.log('content-type:', req.headers['content-type'])
      console.log('isBuffer?', Buffer.isBuffer(buf), 'len:', Buffer.isBuffer(buf) ? buf.length : -1)

      if (!Buffer.isBuffer(buf)) return reply.code(400).send('Raw body not available')

      try {
        const event = await stripeService.constructEvent(sig, buf)

        // responde rápido para evitar retry
        reply.code(200).send({ received: true })

        // processa em background
        handleStripeWebhook(event).catch(err =>
          console.error('Stripe handler error:', err?.message || err)
        )
        return
      } catch (e: any) {
        return reply.code(400).send(`Webhook Error: ${e.message}`)
      }
    })
  })
})

//   // Registrando escopo isolado para o webhook
//   server.register(async function (stripeScope) {
//     // 👇 Esse parser só afeta as rotas DENTRO desse escopo
//     stripeScope.addContentTypeParser(
//       "application/json",
//       { parseAs: "buffer" },
//       function (req, body, done) {
//         done(null, { raw: body });
//       }
//     );

//     stripeScope.post("/stripe/webhook", { schema : { hide : true } } ,
//       async (req, res) => {
//       const sig = req.headers["stripe-signature"] as string;

//       if (!sig) return res.code(400).send('Missing stripe-signature');
//       if (!(req as any).rawBody || !Buffer.isBuffer((req as any).rawBody)) {
//         return res.code(400).send('Raw body not available');
//       }

//       let event: Stripe.Event;

//       try {
//         console.log(" ✅ Stripe webhook recebido:", (req.body as any).raw, (req.body as any).rawBody );
//         event = await stripeService.constructEvent(sig, (req.body as any).raw)

//         res.status(200).send("success");
//         await handleStripeWebhook(event);
//       } catch (error: any) {
//         console.error("❌ Erro Stripe webhook:", error.message);
//         return res.status(400).send(`Webhook error: ${error.message}`);
//       }
//     });
//   });
// 