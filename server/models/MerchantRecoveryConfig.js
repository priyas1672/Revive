const mongoose = require("mongoose");

const merchantRecoveryConfigSchema = new mongoose.Schema(
  {
    merchantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Maximum discount Revive is allowed to offer
    maxDiscountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },

    // Whether AI negotiation is enabled
    negotiationEnabled: {
      type: Boolean,
      default: true,
    },

    // Minimum payment amount for negotiation
    minAmountForNegotiation: {
      type: Number,
      default: 1000,
    },

    // Maximum discount amount in INR
    maxDiscountAmount: {
      type: Number,
      default: 1000,
    },

    // Merchant-approved recovery options
    allowDiscount: {
      type: Boolean,
      default: true,
    },

    allowPromiseToPay: {
      type: Boolean,
      default: true,
    },

    allowEmi: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "MerchantRecoveryConfig",
  merchantRecoveryConfigSchema
);