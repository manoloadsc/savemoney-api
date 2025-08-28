import { notFoundError } from "errors/defaultErrors.js";
import { FastifyInstance } from "fastify";
import prisma from "lib/prisma.js";
import authService from "services/auth.service.js";
import stripeService from "services/stripeService.js";
import userService from "services/user.service.js";
import whatssapService from "services/whatssap.service.js";
import Stripe from "stripe";
import { authValidationNumberCode } from "validatation/auth.validation.js";
import { userResponseSchema, userUpdateSchema } from "validatation/user.validation.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export default async function privateUserRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get("/me", {
    schema: {
      tags: ['User - Private'],
      response: {
        200: zodToJsonSchema(userResponseSchema)
      },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, res) => {
    const userId = req.user.id;
    if (!userId) throw notFoundError("USER_ID not found");
    let user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw notFoundError("User not found");

    let plan: 'anual' | 'trimestral' | undefined

    if (user.active) {
      if (user.stripeSubscriptionId) {
        let customer = await stripeService.getCustomerByEmail(user.email)
        let subscription = await stripeService.getCustomerSubscription(customer.id)
        let priceId = subscription.items.data[0].price.id
        plan = priceId === process.env.STRIPE_PRICE_ID_12 ? 'anual' : 'trimestral'
      } else {
        let customer = await stripeService.getCustomerByEmail(user.email)
        let stripeSubscription = await stripeService.getCustomerSubscription(customer.id)
        let update = await userService.updateUserPlan(stripeSubscription, stripeSubscription.latest_invoice as Stripe.Invoice, user.id)
        let priceId = stripeSubscription.items.data[0].price.id
        plan = priceId === process.env.STRIPE_PRICE_ID_12 ? 'anual' : 'trimestral'
      }
    }

    let data = { name: user.name, email: user.email, chat_id: user.chat_id, active: user.active, numberVerified: user.numberVerified_at!!, 
      lang: user.lang, currency: user.currency,emailVerified: user.emailVerified_at!!, plan, completeInformation: user.completeInformation }

    return data;
  });


  app.post("/validateNumber", {
    schema: {
      query: zodToJsonSchema(authValidationNumberCode),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() }))
      },
      tags: ['User - Private'],
      security: [{ bearerAuth: [] }]
    }
  }, async (req, res) => {
    const userId = req.user.id;
    let { code } = req.query as authValidationNumberCode
    let validate = await userService.userValidateNumber(code, userId)

    return { message: "user activated" }
  })

  app.put("", {
    schema: {
      tags: ['User - Private'],
      body: zodToJsonSchema(userUpdateSchema),
      security: [{ bearerAuth: [] }]
    }
  }, async (req, res) => {
    const userId = req.user.id
    let body = req.body as userUpdateSchema

    console.log(body)

    let update = await userService.updateUserById(body, userId)

    return update
  })

  app.post("/numberCode", {
    schema: {
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() }))
      },
      tags: ['User - Private'],
      security: [{ bearerAuth: [] }]
    }
  }, async (req, res) => {
    const userId = req.user.id;

    const user = await userService.getUser(userId)
    if (!user) throw notFoundError("User not found");
    if (user.numberVerified_at) throw notFoundError("User already verified")
    
    let code = await authService.generateNumberAuthCode(userId)

    let { messageId } = await whatssapService.activeAccountNumber(user.chat_id!, code.authCode)

    return { message: "message sended" }
  })

}