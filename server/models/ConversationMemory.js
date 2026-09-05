const mongoose = require("mongoose");

const conversationMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["CUSTOMER", "REVIVE_AGENT"],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    intent: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const conversationMemorySchema = new mongoose.Schema(
  {
    recoveryCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecoveryCase",
      required: true,
      unique: true,
      index: true,
    },

    customerPhone: {
      type: String,
      required: true,
      index: true,
    },

    customerName: {
      type: String,
      default: null,
    },

    channel: {
      type: String,
      enum: ["WHATSAPP", "VOICE", "SMS", "EMAIL"],
      default: "WHATSAPP",
    },

    language: {
      type: String,
      enum: ["ENGLISH", "HINDI", "HINGLISH"],
      default: "HINGLISH",
    },

    currentIntent: {
      type: String,
      default: null,
    },

    conversationStatus: {
      type: String,
      enum: [
        "ACTIVE",
        "PTP_CAPTURED",
        "RECOVERED",
        "ESCALATED",
        "STOPPED",
      ],
      default: "ACTIVE",
    },

    lastCustomerMessage: {
      type: String,
      default: null,
    },

    lastAgentMessage: {
      type: String,
      default: null,
    },

    messages: {
      type: [conversationMessageSchema],
      default: [],
    },

    context: {
      failureReason: {
        type: String,
        default: null,
      },

      discussedAmount: {
        type: Number,
        default: null,
      },

      promisedAmount: {
        type: Number,
        default: null,
      },

      promisedDate: {
        type: Date,
        default: null,
      },

      paymentMethod: {
        type: String,
        default: null,
      },

      customerRequest: {
        type: String,
        default: null,
      },
    },

    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ConversationMemory",
  conversationMemorySchema
);