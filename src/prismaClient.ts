import { PrismaClient } from "@prisma/client";

// Singleton Prisma client — reuse a single connection across the app.
const prisma = new PrismaClient();

export default prisma;
