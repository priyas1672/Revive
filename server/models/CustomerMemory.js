const mongoose = require("mongoose");

const customerMemorySchema = new mongoose.Schema(
  {
    customerPhone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    customerName: {
      type: String,
      default: null,
    },

    customerEmail: {
      type: String,
      default: null,
    },

    // ----------------------------------------------------
    // Communication preferences
    // ----------------------------------------------------

    preferredLanguage: {
      type: String,
      enum: [
        "ENGLISH",
        "HINDI",
        "HINGLISH",
      ],
      default: "HINGLISH",
    },

    preferredChannel: {
      type: String,
      enum: [
        "WHATSAPP",
        "VOICE",
        "SMS",
        "EMAIL",
      ],
      default: "WHATSAPP",
    },

    preferredTone: {
      type: String,
      enum: [
        "FRIENDLY",
        "DIRECT",
        "FORMAL",
      ],
      default: "FRIENDLY",
    },

    // ----------------------------------------------------
    // Payment behaviour
    // ----------------------------------------------------

    totalPayments: {
      type: Number,
      default: 0,
    },

    successfulPayments: {
      type: Number,
      default: 0,
    },

    failedPayments: {
      type: Number,
      default: 0,
    },

    totalRecoveryCases: {
      type: Number,
      default: 0,
    },

    recoveredCases: {
      type: Number,
      default: 0,
    },

    // ----------------------------------------------------
    // Promise behaviour
    // ----------------------------------------------------

    promisesMade: {
      type: Number,
      default: 0,
    },

    promisesFulfilled: {
      type: Number,
      default: 0,
    },

    promisesBroken: {
      type: Number,
      default: 0,
    },

    lastPromiseDate: {
      type: Date,
      default: null,
    },

    // ----------------------------------------------------
    // Behavioural signals
    // ----------------------------------------------------

    averagePromiseDelayDays: {
      type: Number,
      default: 0,
    },

    reliabilityScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },

    // ----------------------------------------------------
    // AI memory
    // ----------------------------------------------------

    importantNotes: {
      type: [String],
      default: [],
    },

    lastInteractionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "CustomerMemory",
  customerMemorySchema
);