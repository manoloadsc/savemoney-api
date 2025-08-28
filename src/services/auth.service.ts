import { add, differenceInSeconds, sub } from "date-fns";
import { conflictError, notFoundError } from "errors/defaultErrors.js";
import prisma from "lib/prisma.js";
import { generateCode } from "utils/generateRandomPassword.js";

class AuthService {

    constructor() { }

    async saveUserTokenForgotPassword(token: string, email: string) {
        let user = await prisma.users.findUnique({ where: { email: email } });

        if (!user) throw notFoundError("User not found");
        let expiresIn = add(new Date(), { hours: 2 })
        let tokenSaved = await prisma.passwordReset.create({ data: { userId: user.id, jti: token, expiresAt: expiresIn } });

        return tokenSaved
    }
    async verifyTokenForgotPassword(token: string) {
        let tokenSaved = await prisma.passwordReset.findUnique({ where: { jti: token } });

        if (!tokenSaved) throw notFoundError("Token not found");

        if (tokenSaved.used) throw conflictError("Token already used");

        if (tokenSaved.expiresAt < new Date()) throw conflictError("Token expired");

        return tokenSaved
    }

    async generateNumberAuthCode(userId: string) {
        const now = new Date();
        const fiveMinAgo = sub(now, { minutes: 5 });

        const recentCode = await prisma.authCode.findFirst({
            where: {
                userId,
                used: false,
                createdAt: {
                    gt: fiveMinAgo
                }
            }
        });
        if (recentCode) {
            const nextAvailableTime = add(recentCode.createdAt, { minutes: 5 });
            const secondsLeft = Math.max(differenceInSeconds(nextAvailableTime, now), 0);
            
            throw conflictError(`Você poderá gerar um novo código em ${secondsLeft} segundos.`);
        }

        const generatedCode = generateCode(9);
        const expiresAt = add(now, { minutes: 20 });

        await prisma.authCode.updateMany({
            where: {
                userId,
                used: false
            },
            data: {
                used: true
            }
        });

        const newCode = await prisma.authCode.create({
            data: {
                authCode: generatedCode,
                userId,
                expiredAt: expiresAt
            }
        });
        return newCode;
    }

}

export default new AuthService();