import { FastifyInstance } from "fastify"
import hotmartService from "services/hotmart.service.js";
import { HotmartPurchaseWebhook } from "types/hotmart.js"

export default async function HomartRoutes(app: FastifyInstance) {
    app.post<{Body: HotmartPurchaseWebhook}>("/webhook", async(req, res) => {
        const { data, event } = req.body

    switch (event) {
      case "PURCHASE_APPROVED":
        try {
          await hotmartService.purchasedApproved(data);
        } catch (error) {
          console.log(error);
        }
        break;
      case "PURCHASE_CANCELED":
      case "PURCHASE_REFUNDED":
      case "PURCHASE_CHARGEBACK":
      case "PURCHASE_EXPIRED":
        await hotmartService.purchasedCancelled(data);
        break;
      default:
        break;
    }   

    })
}