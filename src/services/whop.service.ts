import prisma, { Prisma, Users } from "../lib/prisma.js";
import userService from "./user.service.js";
import resendService from "./resend.service.js";
import { addDays } from "date-fns";

interface WhopMembershipData {
  id: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
  plan: {
    id: string;
    name?: string;
  };
  status: string;
  created_at: number;
  expires_at?: number;
}

interface WhopPaymentData {
  id: string;
  amount: number;
  status: string;
  user: {
    id: string;
    email: string;
  };
}

class WhopService {
  /**
   * Processa evento membership_activated
   * Equivalente ao PURCHASE_APPROVED do Hotmart
   */
  async membershipActivated(data: WhopMembershipData) {
    const membershipId = data.id;
    const whopUserId = data.user.id;
    const email = data.user.email;
    const planName = data.plan.name || data.plan.id;

    if (!email || !planName) {
      console.error("Email ou planName ausente no webhook Whop");
      return { ok: false };
    }

    // Busca o plano baseado no nome
    const plan = await prisma.plan.findFirst({
      where: { name: planName },
    });

    if (!plan) {
      console.error(`Plano não encontrado: ${planName}`);
      return { ok: false };
    }

    return await prisma.$transaction(async (db) => {
      // 1) Busca ou cria usuário
      let user = await userService.findByEmail(email, false);
      
      if (!user) {
        const created = await userService.createDefaultUser({
          email,
          name: data.user.name || email.split("@")[0],
          phone: "", // Whop não fornece telefone diretamente
        });

        user = created.user as Users;

        // Envia email com credenciais
        await resendService.defaultUserCreated(
          created.user.email,
          created.randomPassowrd
        );
      }

      // Atualiza whopUserId no cadastro do usuário
      if (user.whopUserId !== whopUserId) {
        await db.users.update({
          where: { id: user.id },
          data: { whopUserId },
        });
      }

      // 2) Verifica se já existe um UserPlan com esse membershipId (idempotência)
      const existingPlan = await db.userPlan.findUnique({
        where: { whopMembershipId: membershipId },
      });

      const startDate = new Date(data.created_at * 1000); // Unix timestamp para Date
      
      // Se já existe, apenas reativa/estende
      if (existingPlan) {
        const baseDate =
          existingPlan.endDate && existingPlan.endDate > new Date()
            ? existingPlan.endDate
            : new Date();

        return await this.activatePlan(
          db,
          user.id,
          existingPlan.id,
          addDays(baseDate, plan.durationDays)
        );
      }

      // 3) Empilhar prazo se o usuário já tem um plano ativo
      const activePlan = await db.userPlan.findFirst({
        where: { userId: user.id, status: true, endDate: { gt: new Date() } },
        orderBy: { endDate: "desc" },
      });

      const baseDate =
        activePlan?.endDate && activePlan.endDate > startDate
          ? activePlan.endDate
          : startDate;

      const endDate = data.expires_at 
        ? new Date(data.expires_at * 1000)
        : addDays(baseDate, plan.durationDays);

      // 4) Desativa planos anteriores (apenas 1 plano ativo por usuário)
      await db.userPlan.updateMany({
        where: { userId: user.id, status: true },
        data: { status: false },
      });

      // 5) Cria novo UserPlan
      const userPlan = await db.userPlan.create({
        data: {
          userId: user.id,
          planId: plan.id,
          startDate,
          endDate,
          status: true,
          whopMembershipId: membershipId,
        },
      });

      // 6) Recalcula Users.active
      await this.recomputeUserActive(db, user.id);

      console.log(`[Whop] Membership ativado: ${membershipId} para ${email}`);
      return { ok: true, userPlanId: userPlan.id };
    });
  }

  /**
   * Processa evento membership_deactivated
   * Equivalente ao PURCHASE_CANCELED do Hotmart
   */
  async membershipDeactivated(data: WhopMembershipData) {
    const membershipId = data.id;

    if (!membershipId) return { ok: false };

    return await prisma.$transaction(async (db) => {
      const userPlan = await db.userPlan.findUnique({
        where: { whopMembershipId: membershipId },
      });

      if (!userPlan) {
        console.warn(`[Whop] UserPlan não encontrado: ${membershipId}`);
        return { ok: false };
      }

      // Desativa o plano
      await db.userPlan.update({
        where: { id: userPlan.id },
        data: {
          status: false,
          endDate: new Date(),
        },
      });

      // Recalcula status ativo do usuário
      await this.recomputeUserActive(db, userPlan.userId);

      console.log(`[Whop] Membership desativado: ${membershipId}`);
      return { ok: true };
    });
  }

  /**
   * Processa evento payment_succeeded (opcional - apenas log)
   */
  async paymentSucceeded(data: WhopPaymentData) {
    console.log(`[Whop] Pagamento confirmado: ${data.id} - ${data.amount/100} USD`);
    // Opcional: gravar na tabela Payment se existir
    return { ok: true };
  }

  /**
   * Ativa/estende um plano existente
   */
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

  /**
   * Recalcula se o usuário está ativo baseado nos planos válidos
   */
  async recomputeUserActive(db: Prisma.TransactionClient, userId: string) {
    const stillActive = await db.userPlan.findFirst({
      where: { userId, status: true, endDate: { gt: new Date() } },
    });

    await db.users.update({
      where: { id: userId },
      data: { active: !!stillActive },
    });
  }

  /**
   * Job para expirar planos vencidos (igual ao Hotmart)
   * Executar via cron
   */
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

    console.log(`[Whop] Plan expiry job concluído em ${new Date().toISOString()}`);
  }
}

export default new WhopService();
