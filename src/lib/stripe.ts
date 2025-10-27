import Stripe from "stripe";
import prismaClient from "./prisma.js";
import userService from "services/user.service.js";
import resendService from "services/resend.service.js";
import { notFoundError } from "errors/defaultErrors.js";
import stripeService from "services/stripeService.js";

export async function handleStripeWebhook(event: Stripe.Event) {
  const data = event.data.object as any;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = data as Stripe.Checkout.Session;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const email = session.customer_details?.email!;
      const name = session.customer_details?.name!;
      const phone = session.customer_details?.phone!;
      console.log(customerId, subscriptionId, session)
      if (!customerId) throw notFoundError("Customer not found");
      if (!subscriptionId) throw notFoundError("Subscription not found");
      if (!session.customer_details!.email) throw notFoundError("Customer email not found");

      const userExist = await userService.findByEmail(email, false);
      console.log('user foi encontrado, conitunuando o processamento')
      if (!userExist) {
        let { user, randomPassowrd } = await userService.createDefaultUser({ name, phone, email })
        await resendService.defaultUserCreated(user.email, randomPassowrd)

      } else {
        console.log('atuaulizando uuser..')
        await userService.updateUserById({ active: true, stripeSubscriptionId: subscriptionId?.toString(), stripeCustomerId: customerId?.toString() }, userExist.id)

        console.log('user atuaçozado.')
        const emailData = await resendService.welcomeEmail(userExist.name, userExist.email)
      }

      const subscription = await stripeService.retriveSubscription(subscriptionId?.toString()!)

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = data as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      const user = await prismaClient.users.findUnique({
        where: { stripeSubscriptionId: customerId! },
      });

      if (!user) throw notFoundError("User not found");

      if (!user.active) {
        await prismaClient.users.update({
          where: { stripeSubscriptionId: customerId! },
          data: { active: true },
        });
      }

      if (!user.stripeSubscriptionId)
        throw notFoundError("User subscription not found");

      await prismaClient.payment.create({
        data: {
          stripePaymentId: invoice.id!,
          userId: user.id,
          subscriptionId: user.stripeSubscriptionId,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: "succeeded",
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = data as Stripe.Subscription;

      const invoice = await stripeService.retriveInvoice(subscription)
      await prismaClient.subscription.updateMany({
        where: { stripeId: subscription.id },
        data: {
          status: subscription.status,
          currentPeriodEnd: new Date(invoice.period_end * 1000).toISOString(),
          currentPeriodStart: new Date(invoice.period_start * 1000).toISOString(),
        },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;

      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

      if (!customerId) throw notFoundError('Stripe customerId not found on invoice.');

      let subscriptionId: string | undefined;
      const parent: any = (invoice as any).parent;
      if (parent?.subscription_details?.subscription) {
        subscriptionId = parent.subscription_details.subscription as string;
      }

      const user = await prismaClient.users.findUnique({
        where: { stripeCustomerId: customerId },
      });
      if (!user) throw notFoundError('User not found');

      await prismaClient.users.update({
        where: { id: user.id },
        data: { active: false }, 
      });

      if (subscriptionId) {
        await prismaClient.subscription.updateMany({
          where: { stripeId: subscriptionId },
          data: {
            status: 'past_due',
            currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
            currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
          },
        });
      }

      await prismaClient.payment.create({
        data: {
          stripePaymentId: invoice.id!,
          userId: user.id,
          subscriptionId: subscriptionId ?? null,
          amount: invoice.amount_due ?? 0,
          currency: invoice.currency,
          status: 'failed',
        },
      });

      // Opcional: e-mail/whatsapp pedindo atualização do cartão usando hosted_invoice_url
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = data as Stripe.Subscription;

      const sub = await prismaClient.subscription.updateMany({
        where: { stripeId: subscription.id },
        data: {
          status: "canceled",
          canceledAt: new Date(
            (subscription.canceled_at ?? Date.now()) * 1000
          ),
        },
      });

      const subscriptionUpdated = await prismaClient.subscription.findFirst({
        where: { stripeId: subscription.id },
        include: {
          user: true
        }
      })


      await prismaClient.users.update({
        data: {
          active: false
        },
        where: {
          id: subscriptionUpdated?.userId!
        }
      })
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return data;
}