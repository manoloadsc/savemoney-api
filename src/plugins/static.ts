import { FastifyInstance } from "fastify";
import staticFastify from "@fastify/static"
import path from "path";
import { dirname } from "lib/paths.js";

export async function setupStatic(app: FastifyInstance) {
    app.register(staticFastify,  {
        root : path.join(dirname,'public'),
        prefix : '/static/',
        decorateReply: false,
    })
}