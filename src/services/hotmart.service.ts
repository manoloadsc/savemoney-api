import { PurchaseData } from "types/hotmart.js";
import prisma, { Prisma, Users } from "../lib/prisma.js";
import userService from "./user.service.js";
import resendService from "./resend.service.js";
import { addDays } from "date-fns";
import { plans } from "scripts/plans.js";

class HotmartService {
  async purchasedApproved(data: PurchaseData) {
    const transactionCode = data.purchase.transaction;
    const offerId = data.subscription.plan.name;
    const email = data.buyer.email;
    const buyerPhone = data.buyer.checkout_phone;

    if (!offerId || !email) return { ok: true };

    const plan = await prisma.plan.findFirst({
      where: {
        name: offerId,
      },
    });

    return await prisma.$transaction(async (db) => {
      let user = await userService.findByEmail(email, false);
      if (!user) {
        const phone = `+${buyerPhone}`;
        const created = await userService.createDefaultUser({
          email,
          name: data.buyer.name,
          phone,
        });

        user = created.user as Users;

        await resendService.defaultUserCreated(
          created.user.email,
          created.randomPassowrd
        );
      }

      const existingPlan = await db.userPlan.findUnique({
        where: {
          hotmartPurchaseCode: transactionCode,
        },
      });

      const orderDate = new Date(data.purchase.order_date);

      if (existingPlan) {
        const baseDate =
          existingPlan.endDate && existingPlan.endDate > new Date()
            ? existingPlan.endDate
            : new Date();

        return await this.activatePlan(
          db,
          user?.id!,
          existingPlan.id,
          addDays(baseDate, plan?.durationDays!)
        );
      }
      // 3) empilhar prazo se o usuário já tem um plano ativo
      const active = await db.userPlan.findFirst({
        where: { userId: user?.id, status: true, endDate: { gt: new Date() } },
        orderBy: { endDate: "desc" },
      });

      const base =
        active?.endDate && active.endDate > orderDate
          ? active.endDate
          : orderDate;
      const endDate = addDays(base, plan!.durationDays);

      // 4) se só pode 1 plano ativo por usuário, desativa os demais
      await db.userPlan.updateMany({
        where: { userId: user?.id, status: true },
        data: { status: false },
      });

      // 5) cria o userPlan com a transação da Hotmart
      const userPlan = await db.userPlan.create({
        data: {
          userId: user?.id!,
          planId: plan!.id,
          startDate: orderDate,
          endDate,
          status: true,
          hotmartPurchaseCode: transactionCode,
        },
      });

      // 6) reavalia Users.active (derivado)
      await this.recomputeUserActive(db, user?.id!);
      console.log('colocou o user como active')
      return { ok: true, userPlanId: userPlan.id };
    });
  }

  async purchasedCancelled(data: PurchaseData) {
    const transactionCode = data.purchase.transaction;

    if (!transactionCode) return;

    return await prisma.$transaction(async (db) => {
      const updatePlan = await db.userPlan.findUnique({
        where: {
          hotmartPurchaseCode: transactionCode,
        },
      });

      if (!updatePlan) return;

      await db.userPlan.update({
        where: {
          id: updatePlan.id,
        },
        data: {
          status: false,
          endDate: new Date(),
        },
      });

      await this.recomputeUserActive(db, updatePlan.userId);

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

    console.log(`[plan-expiry] done at ${new Date().toISOString()}`);
  }

  async createDefaultPlan() {
    for (const p of plans) {
      await prisma.plan.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          durationDays: p.durationDays,
          description: p.description,
        },
        create: {
          id: p.id,
          name: p.name,
          durationDays: p.durationDays,
          description: p.description,
        },
      });
    }
  }
}

export default new HotmartService();
