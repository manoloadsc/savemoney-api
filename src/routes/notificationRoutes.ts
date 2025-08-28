import { notFoundError } from "errors/defaultErrors.js";
import { FastifyInstance } from "fastify";
import prisma from "lib/prisma.js";
import notificationService from "services/notification.service.js";
import userService from "services/user.service.js";
import { confirmationsResponseSchema, createNotificationValidation, getNotificationsValidation, NotificationResponseSchema, notificationSchema, notificationsListResponseSchema, updatedNotificationGptDTO, updatedNotificationValidation, updateNotificationValidation, updateNotificationValidationGpt } from "validatation/notification.validation.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export default async function notificationRoutes(app : FastifyInstance) { 
    app.addHook('onRequest', app.authenticate);

    app.post('', 
        {
            schema : { 
                tags : ['Notifications'],
                body : zodToJsonSchema(createNotificationValidation),
                response : { 
                    201 : zodToJsonSchema(notificationSchema)
                },
                security : [{ bearerAuth : [] }]
            }
        }
    ,async (req,res) => {

        let { data, error, success } = createNotificationValidation.safeParse(req.body);

        if (!success) return res.status(400).send({ error: error! });

        let userId = req.user.id;
        if (!userId) notFoundError("USER_ID not found");

        let user = await prisma.users.findUnique({ where: { id: userId } });
        if(!user) notFoundError("User not found");

        let notification = await notificationService.createFutureGoalNotification(data!, userId);
        await userService.updateLastUsedAt(userId);

        return res.status(201).send(notification);
    })

    app.put('/:id', 
        {
            schema : { 
                tags : ['Notifications'],
                response : { 
                    200 : zodToJsonSchema(notificationSchema)
                },
                body : zodToJsonSchema(updateNotificationValidation),
                params : zodToJsonSchema(z.object({ id : z.number() })),
                security : [{ bearerAuth : [] }]
            }
        }
    ,async (req, res) => {
        let user = await prisma.users.findUnique({ where: { id: req.user.id } });
        if(!user) notFoundError("User not found");

        let body = req.body as updatedNotificationValidation;
        let params = req.params as { id : number }

        let updatedNotification = await notificationService.updateNotification(req.user.id, body, params.id);

        return updatedNotification
    })

    app.delete('/:id', 
        {
            schema : { 
                tags : ['Notifications'],
                param : zodToJsonSchema(z.object({ id : z.string() })),
                security : [{ bearerAuth : [] }],
                response : { 
                    200 : zodToJsonSchema(z.object({ message : z.string() }))
                }
            }
        }
    ,async (req, res) => {
        let user = await prisma.users.findUnique({ where: { id: req.user.id } });
        if(!user) notFoundError("User not found");
        let { id } = req.params as { id : string };

        await notificationService.deleteNotification(parseInt(id), req.user.id);

        return res.status(200).send({ message : "Notification deleted" });
    })

    app.get('', 
        {
            schema : { 
                tags : ['Notifications'],
                query : zodToJsonSchema(getNotificationsValidation),
                response : {
                    200 : zodToJsonSchema(notificationsListResponseSchema)
                },
                security : [{ bearerAuth : [] }]
            }
        }
    ,async (req, res) => {
        const userId = req.user.id;
        if (!userId) notFoundError("USER_ID not found");

        let {success, data , error} = getNotificationsValidation.safeParse(req.query);

        if (!success) return res.status(400).send({ error: error! });

        let notifications = await notificationService.getNotifications(userId, data!)

        return notifications
    })

    app.get('/:id', { 
        schema : { 
            params: zodToJsonSchema(z.object({ id : z.string() })),
            tags : ['Notifications'],
            response : { 
                200 : zodToJsonSchema(NotificationResponseSchema)
            },
            security : [{ bearerAuth : [] }]
        },

    } , async(req, res) => {
        const userId = req.user.id
        let { id } = req.params as { id : string }
        let notification = await notificationService.getNotification(userId, Number(id))
        
        if(!notification) { throw notFoundError("Notificação não encontrada :(") }

        let { deletedAt, updatedAt, isFutureGoal, ...toSend} = notification

        res.status(200).send(toSend)
    })

    app.post('/:id', 
        {
            schema : { 
                tags : ['Notifications'],
                param : zodToJsonSchema(z.object({ id : z.string() })),
                summary : "Aceitar ou recusar notificação",
                query : zodToJsonSchema(z.object({ accept : z.boolean() })),
                response : { 
                    200 : zodToJsonSchema(z.object({ message : z.string() }))
                },
                security : [{ bearerAuth : [] }]
            }
        }
    ,async (req, res) => {
        const userId = req.user.id; 
        if (!userId) notFoundError("USER_ID not found");

        let params = req.params as { id : string };
        let query = req.query as { accept : boolean };

        let notificationId = Number(params.id)

        await notificationService.updateNotificationMessageStatus(notificationId, query.accept ? "ACCEPTED" : "REJECTED")

        query.accept ? res.status(200).send({ message:  "Parcela criada" }) : res.status(200).send({ message:  "Parcela rejeitada" });   
        // aceitar ou recusar notificação (se aceitar criar a transação, se não resausa.)
    })

    app.put("/activate/:id", {
        schema : { 
            tags : ['Notifications'],
            param : zodToJsonSchema(z.object({ id : z.string() })),
            summary : "Alterar o status da notificação (ativa ou dessativa)",
            response : { 
                200 : zodToJsonSchema(z.object({ ok : z.boolean() }))
            },
            security : [{ bearerAuth : [] }]
        }
    },async (req, res) => {
        const userId = req.user.id; 
        if (!userId) notFoundError("USER_ID not found");

        let params = req.params as { id : string };

        let notificationId = params.id

        await notificationService.changeNotificationActivation(parseInt(notificationId))

        return res.status(200).send({ ok : true });
    })

    app.get('/messages', 
        {
            schema : { 
                tags : ['Notifications'],
                response : { 
                    200 : zodToJsonSchema(z.object({ notifications : z.array(confirmationsResponseSchema) })),
                },
                security : [{ bearerAuth : [] }],
                summary : "Infomações referentes a notificação, como se fossem as notificações do insta. podem ser do tipo info ou confirm, c for confirm tem q ter a representação visual do X ou V para aceitar ou recusar a criação da parcelsa."
            }
        }
    ,async (req, res) => {
        let userId = req.user.id;
        
        if (!userId) notFoundError("USER_ID not found");

        let user = prisma.users.findUnique({ where: { id: userId } });
        if(!user) notFoundError("User not found");

        let notifications = await notificationService.GetNotificationMessages(userId)


        return res.status(200).send({ notifications }); 
    })
}