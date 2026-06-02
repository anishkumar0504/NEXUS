import cron from "node-cron";
import { prisma } from "./prisma.js";

export function startKeepAlive() {
  cron.schedule("0 0 * * *", async () => {
    try {
      await prisma.searchCache.findFirst({ select: { query: true } });
      console.log("Supabase keep-alive ping sent");
    } catch (err) {
      console.error("Supabase keep-alive failed:", err);
    }
  });
}