const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    customerEmail: {
      type: String,
    },

    customerPhone: {
      type: String,
    },

    amount: {
      type: Number,
      required: true,
    },

   merchantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Merchant",
  required: false,
  index: true,
  }, 

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "AUTHORIZED",
        "CAPTURED",
        "FAILED",
        "REFUNDED",
      ],
      default: "CREATED",
    },

    failureReason: {
      type: String,
      default: null,
    },

    failureCode: {
      type: String,
      default: null,
    },

    paymentMethod: {
      type: String,
      default: null,
    },

    retryCount: {
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

    webhookEventIds: {
       type: [String],
       default: [],
      },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);