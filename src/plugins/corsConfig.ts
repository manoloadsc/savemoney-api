import { FastifyInstance } from "fastify";
import cors from "@fastify/cors"

export async function setupCors(app : FastifyInstance) { 
    await app.register(cors, { 
        origin : (origin, cb) => { 
            const allowedOrigins = process.env.ENVIRONMENT === "PROD" ? ["https://economize-ai.com", "https://www.savemoneyy.com"] : ["http://localhost:3000", "http://localhost:4000","https://dev.economize-ai.com"]
            if(!origin || allowedOrigins.includes(origin)) { 
                cb(null,  true)
            }else {
                cb(new Error("Not allowed by cors"), false)
            }
        },
        methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials : true,
    })
}