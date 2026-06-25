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

  await prisma.agent.upsert({
    where: { name: "nexus" },
    update: {},
    create: { name: "nexus", type: "ASSISTANT" }, // Change from SUMMARIZER to ASSISTANT
  });

  // ← ADD THIS
  await prisma.agent.upsert({
    where: { name: "research" },
    update: {},
    create: { name: "research", type: "RESEARCH" },
  });
}

seed().then(() => process.exit(0));