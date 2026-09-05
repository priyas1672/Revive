const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({
  recoveryCase,
  eventType,
  actor = "SYSTEM",
  action,
  reasoning = null,
  metadata = {},
}) => {
  if (!recoveryCase) {
    throw new Error("Recovery case is required for audit log");
  }

  if (!eventType) {
    throw new Error("Audit event type is required");
  }

  if (!action) {
    throw new Error("Audit action is required");
  }

  const auditLog = await AuditLog.create({
    recoveryCase,
    eventType,
    actor,
    action,
    reasoning,
    metadata,
  });

  return auditLog;
};

module.exports = {
  createAuditLog,
};