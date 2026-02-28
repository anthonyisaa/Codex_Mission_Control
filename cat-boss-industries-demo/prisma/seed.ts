import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.incident.deleteMany();

  const blocked = await prisma.incident.create({
    data: {
      title: "Blocked deploy on East region",
      description: "Rollout halted after failing smoke checks.",
      status: "blocked",
      severity: "high",
    },
  });

  await prisma.activityLog.create({
    data: {
      incidentId: blocked.id,
      message: "Incident created from release monitor.",
    },
  });

  await prisma.incident.createMany({
    data: [
      {
        title: "Access policy drift",
        description: "Detected drift from policy baseline.",
        status: "in_progress",
        severity: "medium",
      },
      {
        title: "Webhook retry flood",
        description: "Retry loop causing duplicate downstream jobs.",
        status: "open",
        severity: "critical",
        escalationOwner: "oncall@catboss.io",
        escalationDueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    ],
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
