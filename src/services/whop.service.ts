import prisma, { Prisma } from "../lib/prisma.js";
import userService from "./user.service.js";
import { addDays } from "date-fns";
import { WhopPaymentdEvent } from "types/whop.js";

class WhopService {
  async membershipActivated(data: WhopPaymentdEvent) {
    const offerId = data.data.product.id;
    const email = data.data.user.email;

    console.log(offerId);

    if (!offerId || !email) return { ok: true };

    const plan = await prisma.plan.findFirst({
      where: {
        id: offerId,
      },
    });

    if (!plan) return { ok: "Plano não existente" };

    return await prisma.$transaction(async (db) => {
      const user = await userService.findByEmail(email, false);

      if (!user) return { ok: "Usuario não ecnotrnado" };

      const orderDate = new Date(data.data.created_at);

      await db.userPlan.updateMany({
        where: { userId: user.id },
        data: { status: false },
      });

      const endDate = addDays(orderDate, plan.durationDays);

      const userPlan = await db.userPlan.create({
        data: {
          userId: user.id,
          planId: plan.id,
          startDate: orderDate,
          endDate,
          status: true,
        },
      });

      await this.recomputeUserActive(db, user.id);

      return { ok: true, userPlanId: userPlan.id };
    });
  }

  async membershipDeactivated(data: WhopPaymentdEvent) {
    const email = data.data.user.email;
    const user = await userService.findByEmail(email, false);

    if (!user) return { ok: "Usuario não ecnotrnado" };

    return await prisma.$transaction(async (db) => {
      const userPlan = await db.userPlan.findFirst({
        where: { userId: user.id, status: true },
      });

      if (!userPlan) {
        console.warn(`[Whop] UserPlan não encontrado`);
        return { ok: false };
      }

      await db.userPlan.update({
        where: { id: userPlan.id },
        data: {
          status: false,
          endDate: new Date(),
        },
      });

      await this.recomputeUserActive(db, userPlan.userId);

      console.log(`[Whop] Membership desativado: ${user.name}`);
      return { ok: true };
    });
  }

  async activatePlan(
    db: Prisma.TransactionClient,
    userId: string,
    userPlanId: string,
    endDate: Date
  ) {
    await db.userPlan.update({
      where: { id: userPlanId },
      data: { status: true, endDate },
    });

    await this.recomputeUserActive(db, userId);

    return { ok: true };
  }

  async recomputeUserActive(db: Prisma.TransactionClient, userId: string) {
    const stillActive = await db.userPlan.findFirst({
      where: { userId, status: true, endDate: { gt: new Date() } },
    });

    await db.users.update({
      where: { id: userId },
      data: { active: !!stillActive },
    });
  }

  async runPlanExpiryJob(opts: { now?: Date; batchSize?: number } = {}) {
    const now = opts.now ?? new Date();
    const batchSize = opts.batchSize ?? 1000;

    for (;;) {
      const expired = await prisma.userPlan.findMany({
        where: { status: true, endDate: { lte: now } },
        select: { id: true, userId: true },
        orderBy: { endDate: "asc" },
        take: batchSize,
      });

      if (expired.length === 0) break;

      const planIds = expired.map((e) => e.id);
      const userIds = [...new Set(expired.map((e) => e.userId))];

      await prisma.$transaction(async (tx) => {
        await tx.userPlan.updateMany({
          where: { id: { in: planIds } },
          data: { status: false, updatedAt: now },
        });

        for (const userId of userIds) {
          const stillActive = await tx.userPlan.findFirst({
            where: { userId, status: true, endDate: { gt: now } },
            select: { id: true },
          });

          await tx.users.update({
            where: { id: userId },
            data: { active: !!stillActive },
          });
        }
      });

      if (expired.length < batchSize) break;
    }

    console.log(
      `[Whop] Plan expiry job concluído em ${new Date().toISOString()}`
    );
  }
}

export default new WhopService();
