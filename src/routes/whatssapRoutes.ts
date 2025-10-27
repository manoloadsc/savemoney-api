import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import userService, { UserService } from "services/user.service.js";
import messageService from "services/message.service.js";
import whatssapService from "services/whatssap.service.js";
import { FromMessage } from "lib/prisma.js";
import gptService from "services/gpt.service.js";
import notificationService from "services/notification.service.js";
import { formatPhoneNumber } from "utils/formatPhoneNumber.js";
import { notFoundError } from "errors/defaultErrors.js";
export default async function whatssapRoutes(server: FastifyInstance) {
    server.get("/webhook", { schema: { hide: true } }, async (req: FastifyRequest, res: FastifyReply) => {
        let query = req.query as any;
        const mode = query["hub.mode"];
        const token = query["hub.verify_token"];
        const challenge = query["hub.challenge"];

        const VERIFY_TOKEN = process.env.VERIFY_TOKEN!;
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("Webhook verificado com sucesso.");
            res.status(200).send(challenge);
        } else {
            console.warn("Falha na verificação do webhook.");
            res.send(403);
        }
    });

    server.post("/webhook", { schema: { hide: true } }, async (req: FastifyRequest, res: FastifyReply) => {
        const body = req.body as any;

        try {
            if (body.object) {
                const entry = body.entry?.[0];
                const change = entry?.changes?.[0];
                const value = change?.value;
                const message = value?.messages?.[0];


                if (message) {
                    const from = message.from;
                    if (message?.text?.body) {
                        const text = message.text.body;
                        let num = formatPhoneNumber(from);
                        console.log(`📩 Mensagem recebida de ${from}: ${text} | formatado : ${num}`);

                        let user = await userService.getuserByChatId("+" + num)
                        if (!user) return whatssapService.sendUserNotFound(num);
                        if ((!user?.numberVerified_at || !user.active) && process.env.ENVIRONMENT === "PROD") return whatssapService.sendUserNotFound(num)
                        let userMessage = await messageService.createMessage(user.id, FromMessage.USER, text)
                        let gptMessage = await gptService.sendMessage(user.id)
                        let handleMessage = await gptService.handleMessage(gptMessage, user.id)
                        let gptReturnMessage = await messageService.createMessage(user.id, FromMessage.BOT, handleMessage.summary)
                        await whatssapService.sendMessage(handleMessage.messageToSend, user.chat_id!)
                    }

                    if (message?.type === "button") {
                        const payload = message.button.payload as 'Sim.' | 'Não.' | 'Não' | "Sim";
                        const accepted = ["Sim", "Sim."].includes(payload);

                        const messageIdRespondido = message.context?.id;
                        let notMessage = await messageService.getMessageFromWaID(messageIdRespondido)
                        if (!notMessage) throw notFoundError("Notificação not found");
                        let userMessage = messageService.createMessage(notMessage?.userId!, FromMessage.USER, accepted ? 'Sim, aceito a notificação.' : 'Não eu recuso a notificação.')
                        whatssapService.sendMessage(accepted ? `*Beleza* ! Já estamos registrando a sua transação 😉` : `*Tranquilo* ! A gente continua te atualizando das próximas movimentações 😃.`, formatPhoneNumber(message.from))
                        if (notMessage) await notificationService.updateNotificationMessageStatus(notMessage.id, accepted ? 'ACCEPTED' : 'REJECTED')
                        console.log(`🔘 Botão clicado por ${from}: ${payload} (contextj id: ${messageIdRespondido})`);
                    }

                    if (message?.type === "audio") {
                        const audioId = message.audio.id
                        const num = formatPhoneNumber(from)
                        let mediaUrl = await whatssapService.getMediaUrl(audioId)
                        let buffer = await whatssapService.downloadMedia(mediaUrl)
                        let content = await gptService.transcriptReadable(buffer)
                        let user = await userService.getuserByChatId("+" + num)

                        if (!user) return whatssapService.sendUserNotFound(num);
                        if ((!user?.numberVerified_at || !user.active) && process.env.ENVIRONMENT === "PROD") return whatssapService.sendUserNotFound(num)

                        let userMessage = await messageService.createMessage(user.id, FromMessage.USER, content.text)
                        let gptMessage = await gptService.sendMessage(user.id)
                        let handleMessage = await gptService.handleMessage(gptMessage, user.id)
                        let gptReturnMessage = await messageService.createMessage(user.id, FromMessage.BOT, handleMessage.summary)
                        await whatssapService.sendMessage(handleMessage.messageToSend, user.chat_id!)

                    }
                }

            }
        } catch (error: any) {
            console.log("Erro ao enviar o webhook:", error.message);
        }

        res.status(200).send("EVENT_RECEIVED");
    });
}