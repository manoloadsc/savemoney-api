import fastify, { FastifyInstance } from "fastify";
import ejs from 'ejs'
import fastifyView from '@fastify/view'
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "lib/paths.js";


export async function setupTemplate(app: FastifyInstance) {
    app.register(fastifyView, {
        engine : { ejs },
        root : path.join(dirname,'views'),
        viewExt : 'ejs',
        includeViewExtension : true,
        defaultContext : { 
            siteName : 'Economize AI',
        },
        options : {}
    })
}