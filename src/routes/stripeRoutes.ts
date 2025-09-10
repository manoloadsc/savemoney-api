import { notFoundError } from "errors/defaultErrors.js";
import { FastifyInstance } from "fastify";
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.mjs";
import stripeService from "services/stripeService.js";
import userService from "services/user.service.js";
import { stripeNewCheckout, stripeResponse } from "validatation/stripe.validation.js";
export default async function stripeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post("/checkout", 
    { 
      schema : {
        body : zodToJsonSchema(stripeNewCheckout),
        response : {
          200 : zodToJsonSchema(stripeResponse),
        },
        tags : ['Stripe'],
        security : [{ bearerAuth : [] }],
        summary : 'O checkout do usuário logado pela plataforma.'
      }
    } ,async (req, res) => {
      console.log(req.body)
    try {

      const email = req.user.email
      const body = req.body as stripeNewCheckout

      const user = await userService.findByEmail(email)
      if(!user || !user!.chat_id) throw notFoundError("User not found");

      const { chat_id } = user
      
      let session = await stripeService.createCheckout(email, body.plan, chat_id, true);
      
      res.status(200).send({
        url: session.url
      });
    } catch (error) {
      console.log(error);
      res.status(500).send({ error });
    }
  });
}
