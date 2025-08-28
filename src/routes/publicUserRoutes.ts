import { FastifyJWT } from "@fastify/jwt";
import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import prismaClient from "lib/prisma.js";
import authService from "services/auth.service.js";
import resendService from "services/resend.service.js";
import stripeService from "services/stripeService.js";
import userService from "services/user.service.js";
import { authActivateValidation, createCheckoutWithEmail } from "validatation/auth.validation.js";
import { forgotEmailValidation, parseLogin, passwordValidation, userValidation } from "validatation/user.validation.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export default async function publicUserRoutes(app: FastifyInstance) {
  app.post("/register", {
    schema: {
      body: zodToJsonSchema(userValidation),
      response: {
        201: zodToJsonSchema(z.string().describe("email enviado")),
      },
      tags: ["User - Public"],
      summary: "Register user",
      description: "Deve retornar pra uma página informando o cliente que recebeu no email uma menssagem para a ativação da conta."
    }
  }, async (req, res) => {
    let { data, error, success } = userValidation.safeParse(req.body);

    if (!success) return res.status(400).send({ error: error! });


    let user = await userService.createUser(
      data!.name,
      data!.password,
      data!.phone_number,
      data!.email
    );


    let token = app.jwt.sign({ id: user.id, email: user.email, type: "EMAIL_VALIDATION" }, { expiresIn: '2h' });

    // await resendService.sendEmail(user.email, "Validação de email", `Esse é o email de validação \n voce tem 2 horas para clicar \n <a href="${process.env.PUBLIC_URL || "http://localhost:3000"}/auth/verify-user?token=${token}">Validar email</a>`);
    
    res.status(201).send(`email enviado para ${user.email}`);
  });

  app.post("/login", {
    schema: {
      body: zodToJsonSchema(parseLogin),
      response: {
        200: zodToJsonSchema(z.string().describe("token")),
      },
      tags: ["User - Public"],
      summary: "Login user",
      description: "Login user"
    }
  }, async (req, res) => {

    const { email, password, timezone } = req.body as parseLogin
    let user = await userService.userLogin(email, password, timezone);
    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '24h' });

    return token;
  });

  app.get("/validate", {
    schema: {
      query: zodToJsonSchema(authActivateValidation),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() })),
      },
      tags: ["User - Public"],
      summary: "Validate user",
      description: "Rota que voce deve enviar para ativar a conta do usuario, vamos definir uma rota no frontend qe vai receber o token, após isso, vamos receber o token da query e enviar para o backend, oara ESSA rota"
    }
  }, async (req, res) => {
    const { token } = authActivateValidation.parse(req.query);

    try {
      const decoded = app.jwt.verify(token) as FastifyJWT['payload'];
      const userId = decoded.id;

      await prismaClient.users.update({
        where: { id: userId },
        data: { emailVerified_at: new Date() }
      })

      return res.status(200).send({ message: "User activated" });

    } catch (error) {
      return res.status(400).send({ error });
    }
  });

  app.post("/forgotPassword", {
    schema: {
      body: zodToJsonSchema(forgotEmailValidation),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() })),
      },
      tags: ["User - Public"],
      summary: "Forgot user",
      description: "Vai entriar para o email do cara um email de recuperação de senha."
    }
  },
    async (req, res) => {
      let { success, data, error } = forgotEmailValidation.safeParse(req.body);

      if (!success) return res.status(400).send({ error: error! });

      let { email } = data!;

      let user = await userService.findByEmail(email);
      let jti = randomUUID();
      let token = app.jwt.sign({ id: user!.id, email: user!.email, type: 'RESET_PASSWORD', jti }, { expiresIn: '2h' });
      let tokenSaved = await authService.saveUserTokenForgotPassword(jti, email);
      await resendService.recoverEmail(user!.name, user!.email, token)

      return res.status(200).send({ message: `email enviado para ${email}` });
    });

  app.post("/changePassword", {
    schema: {
      body: zodToJsonSchema(passwordValidation),
      query: zodToJsonSchema(authActivateValidation),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() })),
      },
      tags: ["User - Public"],
    }
  }, async (req, res) => {
    let query = req.query;
    let body = req.body;

    let password = passwordValidation.safeParse(body);
    let auth = authActivateValidation.safeParse(query);

    if (!auth.success) return res.status(400).send({ error: auth.error! });
    if (!password.success) return res.status(400).send({ error: password.error! });

    let { token } = auth.data!;

    let infos = app.jwt.verify(token) as FastifyJWT['payload'];

    let tokenSaved = await authService.verifyTokenForgotPassword(infos.jti!);

    await userService.changePassowordByEmailSendedToken(infos, password.data!.password);
    let user = await userService.findByEmail(infos.email)
    await resendService.passwordResetSuccessEmail(user!.name, user!.email);
    return res.status(200).send({ message: "Senha redefinida" });

  }
  )

  app.post("/checkout", {
    schema: {
      body: zodToJsonSchema(createCheckoutWithEmail),
      response: {
        200: zodToJsonSchema(z.object({ url: z.string() })),
      },
      tags: ["User - Public"],
    }
  },
    async (req, res) => {
      const authHeader = req.headers['authorization']
      let logged = false

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        try {
          app.jwt.verify(token)
          logged = true
        } catch (err) {
          logged = false
        }
      }
      let body: createCheckoutWithEmail = req.body as createCheckoutWithEmail
      let session = await stripeService.createCheckout(body.email, body.plan, body.phone, logged)

      return res.status(200).send({ url: session.url })
    })


}
