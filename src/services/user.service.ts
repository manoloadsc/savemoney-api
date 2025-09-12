import { FastifyJWT } from "@fastify/jwt";
import prismaClient, { FromMessage, Prisma } from "../lib/prisma.js";
import { comparePassword, hashParssword } from "../utils/hashPassword.js";
import { generateCode, generateRandomPassowrd } from "utils/generateRandomPassword.js";
import bcrypt from 'bcrypt'
import { badRequestError, conflictError, notFoundError, tooManyRequestsError } from "errors/defaultErrors.js";
import whatssapService from "./whatssap.service.js";
import Stripe from "stripe";
import stripeService from "./stripeService.js";
import { startOfDay, subDays } from "date-fns";

export class UserService {
  constructor() { }

  async getUser(userId: string) {
    let user = await prismaClient.users.findUnique({
      where: { id: userId },
    });

    return user;
  }

  async getuserByChatId(chatId: string) {
    let user = await prismaClient.users.findUnique({
      where: { chat_id: chatId },
    });

    return user;
  }

  async listUserMessages(userId: string, take = 5, from?: FromMessage) {
    let messages = await prismaClient.messages.findMany({
      where: {
        clientId: userId,
        ...from ? { from: from } : {}
      },
      take: take,
      orderBy: { createdAt: "desc" },
    });

    return messages.reverse();
  }

  async updateUserById(data: Prisma.UsersUpdateInput, useId: string) {
    let user = await prismaClient.users.update({ where: { id: useId }, data });

    return user
  }

  async createUser(
    name: string,
    password: string,
    phone_number: string,
    email: string,
    active = false
  ) {
    let passwordHash = await hashParssword(password);

    let userExists = await prismaClient.users.findFirst({
      where: { OR: [{ email: email }, { chat_id: phone_number }] },
    });

    if (userExists?.email === email) throw conflictError("Email already exists");
    if (userExists?.chat_id === phone_number) throw conflictError("Phone number already exists");

    let user = await prismaClient.users.create({
      data: {
        name,
        password: passwordHash,
        email,
        active,
        chat_id: phone_number,
      },
      select: {
        name: true, email: true, chat_id: true, id: true
      }
    });

    return user;
  }

  async findUsersToSendAnalyis(take = 30) {

    let startDate = startOfDay(new Date())

    let users = await prismaClient.users.findMany({
      where: {
        OR: [
          { sendMonthAnalyis: { lte: startDate } },
          { sendMonthAnalyis: null }
        ]
      },
      take
    })

    await prismaClient.users.updateMany({
      where: {
        id: {
          in: users.map(user => user.id)
        }
      },
      data: {
        sendMonthAnalyis: new Date()
      }
    })

    return users
  }

  async userValidateNumber(code: string, userId: string) {

    let user = await prismaClient.users.findUnique({
      where: {
        id: userId,
        numberVerified_at: null
      },
      include: {
        authCodes: {
          where: {
            authCode: code,
            used: false,
            expiredAt: {
              gt: new Date()
            }
          }
        }
      }
    })

    if (!user || user.authCodes.length === 0) throw notFoundError("Auth code not found.")

    await prismaClient.authCode.update({
      where: {
        id: user.authCodes[0].id
      },
      data: {
        used: true
      }
    })

    await prismaClient.users.update({
      where: {
        id: userId
      },
      data: {
        numberVerified_at: new Date()
      }
    })

    return true
  }

  async getUserPlan(userId: string) {
    let user = await prismaClient.users.findUnique({ where: { id: userId } })

    if (!user) throw notFoundError("User not found");

    let customer = await stripeService.getCustomerByEmail(user.email)
    let subscription = await stripeService.getCustomerSubscription(customer.id)

    let priceId = subscription.items.data[0].price.id


    if (subscription) return subscription
  }

  async userLogin(email: string, password: string, timeZone?: string) {
    let user = await prismaClient.users.findUnique({ where: { email: email } });

    if (!user) throw notFoundError("User not found");

    if (!user.timeZone && !timeZone) throw badRequestError("Need provide timezone");

    if (user.timeZone !== timeZone) await prismaClient.users.update({ where: { id: user.id }, data: { timeZone } })

    let compare = await comparePassword(password, user.password);

    if (!compare) throw notFoundError("User not found");

    return user;
  }

  async findByEmail(email: string, throwError = true) {
    let user = await prismaClient.users.findUnique({ where: { email: email } })

    if (!user && throwError) throw notFoundError("User not found");

    return user
  }

  async createDefaultUser({ name, phone, email }: { name: string, phone: string, email: string }) {
    let randomPassowrd = generateRandomPassowrd(15);
    const hashedPassowrd = await bcrypt.hash(randomPassowrd, 10);
    let user = await this.createUser(name, hashedPassowrd, phone, email, true);
    return { user, randomPassowrd }
  }

  async changePasswordByOldPassword(oldPassword: string, newPassword: string, userId: string) {
    let user = await prismaClient.users.findUnique({ where: { id: userId } })

    if (!user) throw notFoundError("User not found");

    let compare = await comparePassword(oldPassword, user.password);

    if (!compare) throw notFoundError("User not found");

    let passwordHash = await hashParssword(newPassword);

    await prismaClient.users.update({
      where: { id: userId },
      data: {
        password: passwordHash
      }
    })
  }

  async updateUserPlan(subscription: Stripe.Subscription, Invoice: Stripe.Invoice, userId: string) {
    let user = await prismaClient.users.update({
      where: {
        id: userId
      },
      data: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer.toString(),
        active: true
      }
    })

    return user
  }

  async updateLastUsedAt(userId: string) {
    await prismaClient.users.update({
      where: {
        id: userId
      },
      data: {
        lastUseDate: new Date(),
      }
    })
  }

  async lastNotifiedAt(userId: string) {
    await prismaClient.users.update({
      where: {
        id: userId
      },
      data: {
        lastNotifiedAt: new Date(),
      }
    })
  }

  async changePassowordByEmailSendedToken(token: FastifyJWT['payload'], password: string) {
    try {
      let user = await prismaClient.users.findUnique({ where: { id: token.id } })

      if (!user) throw notFoundError("User not found");

      let passwordHash = await hashParssword(password);

      await prismaClient.users.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          active: true
        }
      })
    } catch (e) {
      return e
    }
  }
  
  async getUsersToNotify(daysAg: number) {

    const today = new Date()
    const daysAgo = subDays(today, daysAg)
    return await prismaClient.users.findMany({
      where: {
        lastUseDate: {
          lte: daysAgo,
        },
        OR: [
          { lastNotifiedAt: null },
          { lastNotifiedAt: { lte: daysAgo } }
        ]
      },
      take: 50
    })
  }

  async deleteUsersMessagesOldMessages() { 
    await prismaClient.messages.deleteMany({
      where: {
        createdAt: {
          lte: subDays(new Date(), 2)
        }
      }
    })
  }
}

export default new UserService();
