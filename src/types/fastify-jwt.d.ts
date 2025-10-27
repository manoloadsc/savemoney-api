// fastify-jwt.d.ts
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      type? : string;
      jti? : string;
    };
    user: {
      id: string;
      email: string;
    };
  }
}