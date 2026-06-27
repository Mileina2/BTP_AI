import prisma from "../config/prisma.js";

export async function logAudit({ organizationId, userId, action, entity, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details ? String(details).slice(0, 2000) : null,
      },
    });
  } catch (err) {
    console.warn("⚠️ Audit log ignoré:", err.message);
  }
}
