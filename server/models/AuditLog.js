const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    recoveryCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecoveryCase",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      enum: [
        "PAYMENT_FAILED",
        "DECISION_MADE",
        "RETRY_SCHEDULED",
        "RETRY_ATTEMPTED",
        "PROMISE_REQUESTED",
        "PROMISE_RECEIVED",
        "PROMISE_REOPENED",
        "PROMISE_FULFILLED",
        "PROMISE_BROKEN",                           
  
        "PROMISE_REMINDER",
        "RECOVERY_MESSAGE_SENT",
        "RECOVERY_SUCCEEDED",
        
        "NEGOTIATION_OFFER_CREATED",
        "NEGOTIATION_OFFER_ACCEPTED",
        "NEGOTIATION_PAYMENT_LINK_CREATED",

        "ESCALATED",
        "STOPPING_RULE_TRIGGERED",
      ],
      required: true,
    },

    actor: {
      type: String,
      enum: [
        "SYSTEM",
        "REVIVE_AGENT",
        "CUSTOMER",
        "HUMAN",
      ],
      default: "SYSTEM",
    },

    action: {
      type: String,
      required: true,
    },

    reasoning: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);