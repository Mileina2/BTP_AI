import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export default prisma;

export async function connectDatabase() {
  await prisma.$connect();
  console.log("✅ PostgreSQL connecté via Prisma");
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
