import { prisma } from "../lib/prisma.js";

async function seed() {
  await prisma.agent.upsert({
    where: { name: "summarizer" },
    update: {},
    create: { name: "summarizer", type: "SUMMARIZER" },
  });

  await prisma.agent.upsert({
    where: { name: "imagegen" },
    update: {},
    create: { name: "imagegen", type: "IMAGE_GEN" },
  });

  // ← ADD THIS
  await prisma.agent.upsert({
    where: { name: "nexus" },
    update: {},
    create: { name: "nexus", type: "SUMMARIZER" }, // or create a new type like "ASSISTANT"
  });
}

seed().then(() => process.exit(0));