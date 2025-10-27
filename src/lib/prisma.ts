export * from "../../generated/prisma/index.js";
import { PrismaClient } from "../../generated/prisma/index.js";

export const prisma = new PrismaClient();
export default prisma;