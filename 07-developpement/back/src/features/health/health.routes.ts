/**
 * `GET /api/sante` — sonde d'état (publique, jamais gardée). Amorce US-10.4.
 * Vérifie la base et Redis ; l'état worker est un placeholder tant qu'aucune
 * queue n'écrit de heartbeat.
 */
import type { FastifyPluginAsync } from "fastify";
import { HEALTH_PATH } from "@capclair/contract";
import { prisma } from "../../server/database/client.js";
import { sharedRedis } from "../../server/queues/connection.js";

type ComponentState = "ok" | "down" | "unknown";

async function checkDb(): Promise<ComponentState> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "down";
  }
}

async function checkRedis(): Promise<ComponentState> {
  try {
    const pong = await sharedRedis().ping();
    return pong === "PONG" ? "ok" : "down";
  } catch {
    return "down";
  }
}

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(HEALTH_PATH, async (_request, reply) => {
    const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
    const status: ComponentState = db === "ok" && redis === "ok" ? "ok" : "down";
    return reply.code(status === "ok" ? 200 : 503).send({
      status,
      db,
      redis,
      worker: "unknown" as ComponentState,
      version: process.env.npm_package_version ?? "0.1.0",
      time: new Date().toISOString(),
    });
  });
};
