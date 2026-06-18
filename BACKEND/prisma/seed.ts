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
}

seed().then(() => process.exit(0));