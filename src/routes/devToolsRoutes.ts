import { FastifyInstance } from "fastify";
import prisma from "lib/prisma.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";


export default async function toolsRoutes(app: FastifyInstance) {
    const pass = process.env.DEV_PASS

    app.post("/tool-user", {
        schema: {
            body: zodToJsonSchema(z.object({ id: z.string(), pass : z.string(), field : z.enum(["email", "account", "number"]) })),
            
        }
    }, async (req, res) => {
        let body = req.body as { id: string, pass : string, field : "email" | "account" | "number" };

        if (body.pass !== pass) return res.status(401).send({ error: "Unauthorized" });

        let user = await prisma.users.findUnique({ where: { id: body.id } });
        if (!user) return res.status(404).send({ error: "User not found" });

        if (body.field === "email") user.emailVerified_at = user.emailVerified_at ? null : new Date();
        if (body.field === "account") user.active = !user.active;
        if (body.field === "number") user.numberVerified_at = user.numberVerified_at ? null : new Date();

        await prisma.users.update({ where: { id: body.id }, data: user });

        return res.status(200).send(true);
    });

    app.get("/tool-user", {
        schema: {
            querystring: zodToJsonSchema(z.object({ pass: z.string() })),
        }
    } ,async (req, res) => { 
        let users = await prisma.users.findMany({ omit : { password : true,  } });

        return users;
    });

    app.delete("/dell-user", {
        schema: {
            querystring: zodToJsonSchema(z.object({ id: z.string(), pass: z.string() })),
        }
    } ,async (req, res) => { 

        const query = req.query as { id : string, pass : string };

        if (query.pass !== pass) return res.status(401).send({ error: "Unauthorized" });
        let notMessages = await prisma.notificationMessage.deleteMany({ where : { userId : query.id } })
        let notifications = await prisma.notifications.deleteMany({ where : { userId : query.id } });
        let parcels = await prisma.parcels.deleteMany({ where : { userId : query.id } });   
        let messages = await prisma.messages.deleteMany({ where : { clientId : query.id } });
        let authCodes = await prisma.authCode.deleteMany({ where : { userId : query.id } });
        let transactions = await prisma.transaction.deleteMany({ where : { userId : query.id } });
        let user = await prisma.users.delete({  where : { id : query.id} });

        return res.status(200).send(true);
    });

    app.post('/clean-analise', 
        {
            schema: {
                querystring: zodToJsonSchema(z.object({ id: z.string(), pass: z.string() })),
            }
        },async (req, res) => { 

        const query = req.query as { id : string, pass : string };

        if (query.pass !== pass) return res.status(401).send({ error: "Unauthorized" });
        await prisma.users.updateMany({ where : { id : query.id }, data : { sendMonthAnalyis : null } });
        return res.status(200).send(true);
    })
}