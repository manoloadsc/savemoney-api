import Fastify from "fastify";
import "dotenv/config.js";
import fastifyJwt from "@fastify/jwt";
import publicUserRoutes from "./routes/publicUserRoutes.js";
import gptRoutes from "./routes/gptRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import webhookPlugin from "./plugins/webhook-plugin.js";
import whatssapRoutes from "./routes/whatssapRoutes.js";
import scheduleService from "./services/schedule.service.js";
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import privateUserRoutes from "./routes/privateUserRoutes.js";
import categoryService from "services/category.service.js";
import dashboardRoutes from "routes/dashboardRoutes.js";
import transactionRoutes from "routes/transactionRoutes.js";
import notificationRoutes from "routes/notificationRoutes.js";
import { setupCors } from "plugins/corsConfig.js";
import categoryRoutes from "routes/categoryRoutes.js";
import toolsRoutes from "routes/devToolsRoutes.js";
import { setupStatic } from "plugins/static.js";
import { setupTemplate } from "plugins/template.js";

async function start() {
  const server = Fastify();

  server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
  });

  await server.register(swagger, {
    openapi: {
      info: {
        title: "Economize ai API",
        version: "1.0.0",
      },
      servers: [
        { url: "/api", description: "Base publica via nginx" },
        { url : "/", description : "Base local" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  server.setErrorHandler(async (error, request, reply) => {
    server.log.error(error);
    reply.status(error.statusCode || 500).send({ error: error.message });
  });

  await server.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  server.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  await setupCors(server)
  await setupStatic(server)
  await setupTemplate(server)

  server.register(webhookPlugin);
  server.register(publicUserRoutes);
  server.register(categoryRoutes, { prefix: '/category' })
  server.register(transactionRoutes, { prefix: "/transaction", });
  server.register(notificationRoutes, { prefix: "/notification" });
  server.register(dashboardRoutes, { prefix: "/dashboard" });
  server.register(privateUserRoutes, { prefix: "/user" });
  server.register(gptRoutes, { prefix: "/gpt" });
  server.register(stripeRoutes, { prefix: "/stripe" });
  server.register(whatssapRoutes, { prefix: "/wa" });
  if (process.env.ENVIRONMENT !== "PROD") {
    server.register(toolsRoutes, { prefix: "/tools" })
  }

  server.get("/", (req, res) => {
    res.send("recendo dados corretamente");
  });

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    server.listen({ port, host }, function (err, address) {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
      console.log(`server listening on ${address}`);
    });
    scheduleService.start();
    categoryService.createDefaultCategories();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
