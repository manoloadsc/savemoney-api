// services/hotmart.service.ts
import prisma, { Prisma, Users } from "../lib/prisma.js";
import userService from "./user.service.js";
import resendService from "./resend.service.js";
import { plans } from "types/plans.js";
import { PurchaseData } from "routes/hotmartRoutes.js";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

class HotmartService {
  validateHottok(hottok?: string) {
    const expected = process.env.HOTMART_HOTTOK;
    return !!expected && hottok === expected;
  }

  async purchasedApproved(data: PurchaseData) {
    const txCode = data.purchase.transaction;
    const offerId = data.purchase.offer?.code;
    const buyerEmail = data.buyer.email;

    if (!offerId || !buyerEmail) return { ok: true };

    const plan = await prisma.plan.findUnique({ where: { id: offerId } });
    if (!plan) return { ok: true };

    return await prisma.$transaction(async (db) => {
      let user = await userService.findByEmail(buyerEmail, false);
      if (!user) {
        const phone = `+55${data.buyer.checkout_phone}`;
        const created = await userService.createDefaultUser({
          email: buyerEmail,
          name: data.buyer.name ?? buyerEmail,
          phone,
        });
        user = created.user as Users;

        await resendService.defaultUserCreated(
          user?.email!,
          created.randomPassowrd
        );
      }

      // 2) idempotência: já existe plano com essa transação?
      const existing = await db.userPlan.findUnique({
        where: { hotmartPurchaseCode: txCode },
      });
      const orderDate = new Date(data.purchase.order_date);

      if (existing) {
        // se já existe, garante status ativo e empilha prazo
        const base =
          existing.endDate && existing.endDate > new Date()
            ? existing.endDate
            : new Date();
        return await this._activatePlan(
          db,
          user?.id!,
          existing.id,
          addDays(base, plan.durationDays)
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
      const endDate = addDays(base, plan.durationDays);

      // 4) se só pode 1 plano ativo por usuário, desativa os demais
      await db.userPlan.updateMany({
        where: { userId: user?.id, status: true },
        data: { status: false },
      });

      // 5) cria o userPlan com a transação da Hotmart
      const userPlan = await db.userPlan.create({
        data: {
          userId: user?.id!,
          planId: plan.id,
          startDate: orderDate,
          endDate,
          status: true,
          hotmartPurchaseCode: txCode,
        },
      });

      // 6) reavalia Users.active (derivado)
      await this._recomputeUserActive(db, user?.id!);

      return { ok: true, userPlanId: userPlan.id };
    });
  }

  async purchasedCanceled(data: PurchaseData) {
    const txCode = data.purchase.transaction;
    if (!txCode) return { ok: true };

    return await prisma.$transaction(async (db) => {
      const up = await db.userPlan.findUnique({
        where: { hotmartPurchaseCode: txCode },
      });

      if (!up) return { ok: true };

      await db.userPlan.update({
        where: { id: up.id },
        data: { status: false, endDate: new Date() },
      });

      await this._recomputeUserActive(db, up.userId);

      return { ok: true };
    });
  }

  private async _activatePlan(
    db: Prisma.TransactionClient,
    userId: string,
    userPlanId: string,
    endDate: Date
  ) {
    await db.userPlan.update({
      where: { id: userPlanId },
      data: { status: true, endDate },
    });
    await this._recomputeUserActive(db, userId);
    return { ok: true };
  }

  private async _recomputeUserActive(
    db: Prisma.TransactionClient,
    userId: string
  ) {
    const stillActive = await db.userPlan.findFirst({
      where: { userId, status: true, endDate: { gt: new Date() } },
    });
    await db.users.update({
      where: { id: userId },
      data: { active: !!stillActive },
    });
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

  async runPlanExpiryJob(opts: { now?: Date; batchSize?: number } = {}) {
    const now = opts.now ?? new Date();
    const batchSize = opts.batchSize ?? 1000;

    for (;;) {
      // pega planos ativos que já venceram
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
        // 1) desativa os planos vencidos
        await tx.userPlan.updateMany({
          where: { id: { in: planIds } },
          data: { status: false, updatedAt: now },
        });

        // 2) recalcula Users.active apenas para os tocados
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

      // se o lote veio menor, acabou o que tinha para agora
      if (expired.length < batchSize) break;
    }

    console.log(`[plan-expiry] done at ${new Date().toISOString()}`);
  }
}

export default new HotmartService();
