import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

let prismaClient: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (prismaClient) return prismaClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaPg({ connectionString });
  prismaClient = new PrismaClient({ adapter });

  return prismaClient;
}

export { getPrisma };
