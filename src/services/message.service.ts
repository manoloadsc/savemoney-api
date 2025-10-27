import prisma, { FromMessage } from "lib/prisma.js";

class MessageService {
    async createMessage(
        userId: string,
        from: FromMessage,
        content: string
    ) {
        let message = await prisma.messages.create({
            data: {
                clientId: userId,
                from: from,
                content,
            },
        });

        return message;
    }


    async getMessageFromWaID( whaId : string) { 
        return prisma.notificationMessage.findFirst({ where : { whaId } })
    }
}

export default new MessageService();    