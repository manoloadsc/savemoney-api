import { badRequestError } from "errors/defaultErrors.js";
import prisma from "lib/prisma.js";
import Stripe from "stripe";
import userService from "./user.service.js";

type plan = 'anual' | 'trimestral'
class StripeService {

    stripe: Stripe
    wb_secret: string

    constructor() {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-05-28.basil" });
        this.wb_secret = process.env.STRIPE_WEBHOOK_SECRET!;
    }


    async createCheckout(email: string, plan: plan, phone: string, logged : boolean) {
        const existCustomer = await this.stripe.customers.list({
            email: email,
            limit: 1,
        });
        const customer =
            existCustomer.data[0] ||
            (await this.stripe.customers.create({ email: email, phone: phone }));
        const session = await this.stripe.checkout.sessions.create({
            customer: customer.id,
            line_items: [
                {
                    price: this.definePlanId(plan),
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/${logged ? "user/profile" : "auth/login"}`,
            cancel_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/auth/sorry`,
        });

        return session
    }

    definePlanId(plan: plan) {
        if (plan === 'anual') {
            return process.env.STRIPE_PRICE_ID_12!
        }

        if (plan === 'trimestral') {
            return process.env.STRIPE_PRICE_ID_3!
        }

        throw badRequestError('plano não existe')
    }

    async createUserPayment(session: Stripe.Checkout.Session, userId: string) {
        const paymentIntentId = session.payment_intent as string;
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

        const paymentData = {
            userId,
            stripePaymentId: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount_received,
            currency: paymentIntent.currency,
            method: paymentIntent.payment_method_types?.[0] ?? null,
            subscriptionId: session.subscription?.toString() ?? null,
        };

        let payment = await prisma.payment.create({ data: paymentData })
        return payment
    }

    async activeUserAcount(subscription: Stripe.Subscription, userId: string) {
        let invoice = await this.retriveInvoice(subscription)

        await userService.updateUserPlan(subscription, invoice, userId)
    }

    async retriveInvoice(subscription: Stripe.Subscription) {
        const invoice = await this.stripe.invoices.retrieve(
            subscription.latest_invoice as string
        );

        return invoice
    }

    async getCustomerByEmail(email: string) {
        const customer = await this.stripe.customers.list({
            email: email,
            limit: 1,
        });
        
        let customerToSend = customer.data[0]
        if(!customerToSend) throw badRequestError('customer not found')

        return customerToSend
    }

    async getCustomerSubscription(customerId: string) {
        const subscription = await this.stripe.subscriptions.list({
            customer: customerId,
            limit: 1,
        });

        const subscriptionToSend = subscription.data[0]
        if(!subscriptionToSend) throw badRequestError('subscription not found') 

        return subscriptionToSend
    }

    async retriveSubscription(subscriptionId: string) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
        if (subscription) {
            return subscription
        }
    }

    async constructEvent(sig: string, raw: any) {
        const event = await this.stripe.webhooks.constructEvent(
            raw,
            sig,
            this.wb_secret
        );

        return event
    }
}

export default new StripeService()