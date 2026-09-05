
const mongoose = require("mongoose");

const recoveryCaseSchema = new mongoose.Schema(
  {
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    customerName: {
      type: String,
      required: true,
    },

    customerEmail: {
      type: String,
      default: null,
    },

    customerPhone: {
      type: String,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    failureCode: {
      type: String,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },

    merchantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Merchant",
  required: false,
  index: true,
 },

    // Revive's decision
    decision: {
      action: {
        type: String,
        enum: [
          "RETRY_PAYMENT",
          "PROMISE_TO_PAY",
          "ESCALATE_HUMAN",
          "STOP",
        ],
        required: true,
      },

      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null,
      },

      reasoning: {
        type: String,
        default: null,
      },

      nextAction: {
        type: String,
        default: null,
      },
    },

    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "PROMISED",
        "RECOVERED",
        "ESCALATED",
        "STOPPED",
      ],
      default: "OPEN",
      index: true,
    },

    retryCount: {
      type: Number,
      default: 0,
    },
    
   communicationAttemptCount: {
   type: Number,
   default: 0,
   },

retryPaymentLinkId: {
  type: String,
  default: null,
},

retryPaymentLink: {
  type: String,
  default: null,
},

retryScheduledAt: {
  type: Date,
  default: null,
},

retryAttemptedAt: {
  type: Date,
  default: null,
},

    // Stopping / safety controls
    stoppingRuleTriggered: {
      type: Boolean,
      default: false,
    },

    stoppingReason: {
      type: String,
      default: null,
    },

    // Channel that Revive will eventually use
    recoveryChannel: {
      type: String,
      enum: [
        "WHATSAPP",
        "VOICE",
        "SMS",
        "EMAIL",
        "HUMAN",
        null,
      ],
      default: null,
    },

    lastAction: {
      type: String,
      default: null,
    },



    nextActionAt: {
      type: Date,
      default: null,
    },

       // ----------------------------------------------------
    // Promise-to-Pay
    // ----------------------------------------------------

    promiseToPay: {
      promised: {
        type: Boolean,
        default: false,
      },

      promisedAmount: {
        type: Number,
        default: null,
      },

      promisedDate: {
        type: Date,
        default: null,
      },

      status: {
        type: String,
        enum: [
          "NOT_REQUESTED",
          "REQUESTED",
          "PROMISED",
          "FULFILLED",
          "BROKEN",
        ],
        default: "NOT_REQUESTED",
      },

      customerMessage: {
        type: String,
        default: null,
      },

      createdAt: {
        type: Date,
        default: null,
      },

      fulfilledAt: {
        type: Date,
        default: null,
      },
    },

     // ----------------------------------------------------
    // Dynamic Negotiation / Soft Recovery
    // ----------------------------------------------------

    negotiation: {
      offerAvailable: {
        type: Boolean,
        default: false,
      },

      originalAmount: {
        type: Number,
        default: null,
      },

      discountAmount: {
        type: Number,
        default: null,
      },

      finalAmount: {
        type: Number,
        default: null,
      },

      offerAccepted: {
        type: Boolean,
        default: false,
      },

      offerCreatedAt: {
        type: Date,
        default: null,
      },

      offerAcceptedAt: {
        type: Date,
        default: null,
      },

      paymentLinkId: {
        type: String,
        default: null,
      },

      paymentLink: {
        type: String,
        default: null,
      },

      status: {
        type: String,
        enum: [
          "NONE",
          "OFFER_CREATED",
          "ACCEPTED",
          "LINK_CREATED",
          "RECOVERED",
        ],
        default: "NONE",
      },
    },


    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RecoveryCase", recoveryCaseSchema);