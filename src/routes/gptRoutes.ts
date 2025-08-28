import { FastifyInstance } from "fastify";
import { z } from "zod";
import messageService from "services/message.service.js";
// import gptService from "services/gpt.service.js";
import { FromMessage, prisma  } from "lib/prisma.js";
import gptService from "services/gpt.service.js";
import { notFoundError } from "errors/defaultErrors.js";

export default async function gptRoutes(app : FastifyInstance) { 
    app.addHook('onRequest', app.authenticate);

    app.get("/message", { schema : { hide : true } } ,async (req, res) => {
      try {
        const userId = req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let params = z.object({ content: z.string() }).parse(req.query);

        let user = await prisma.users.findUnique({ where: { id: userId } });

        if(!user) throw notFoundError("User not found");
        let message = await messageService.createMessage(user.id, FromMessage.USER, params.content)
        let gptMessage = await gptService.sendMessage(user.id)
        let handledMessage = await gptService.handleMessage(gptMessage, user.id)
        let gptReturnMessage = await messageService.createMessage(user.id, FromMessage.BOT, handledMessage.summary)
        res.status(200).send({ message : handledMessage.messageToSend });
      } catch (error) {
        res.status(500).send({ error });
      }
    });
}