

const MerchantRecoveryConfig = require(
  "../models/MerchantRecoveryConfig"
);

const razorpay = require("../config/razorpay");

// ------------------------------------------------------
// Get or create merchant recovery configuration
// ------------------------------------------------------

const getMerchantConfig = async (merchantId) => {
  let config =
    await MerchantRecoveryConfig.findOne({
      merchantId,
    });

  if (!config) {
    config =
      await MerchantRecoveryConfig.create({
        merchantId,
      });
  }

  return config;
};

// ------------------------------------------------------
// Calculate safe recovery offer
// ------------------------------------------------------

const calculateRecoveryOffer = async ({
  merchantId,
  amount,
}) => {
  if (!merchantId) {
    throw new Error("merchantId is required");
  }

  if (!amount || amount <= 0) {
    throw new Error(
      "Valid payment amount is required"
    );
  }

  const config =
    await getMerchantConfig(merchantId);

  // Negotiation disabled
  if (!config.negotiationEnabled) {
    return {
      eligible: false,
      reason:
        "Dynamic negotiation is disabled by merchant.",
    };
  }

  // Discount disabled
  if (!config.allowDiscount) {
    return {
      eligible: false,
      reason:
        "Discount recovery is not allowed by merchant.",
    };
  }

  // Payment too small for negotiation
  if (
    amount <
    config.minAmountForNegotiation
  ) {
    return {
      eligible: false,
      reason:
        "Payment amount is below the merchant's negotiation threshold.",
    };
  }

  // Calculate percentage-based discount
  const percentageDiscount =
    (amount *
      config.maxDiscountPercent) /
    100;

  // Enforce BOTH merchant limits
  const discountAmount = Math.min(
    percentageDiscount,
    config.maxDiscountAmount
  );

  const finalAmount =
    amount - discountAmount;

  const discountPercent =
    (discountAmount / amount) * 100;

  return {
    eligible: true,

    originalAmount: amount,

    discountAmount: Number(
      discountAmount.toFixed(2)
    ),

    discountPercent: Number(
      discountPercent.toFixed(2)
    ),

    finalAmount: Number(
      finalAmount.toFixed(2)
    ),

    maxAllowedDiscountPercent:
      config.maxDiscountPercent,

    maxAllowedDiscountAmount:
      config.maxDiscountAmount,

    reason:
      "Offer generated within merchant-approved recovery limits.",
  };
};


// ------------------------------------------------------
// Create discounted Razorpay Payment Link
// ------------------------------------------------------

const createNegotiatedPaymentLink = async ({
  recoveryCase,
  recoveryOffer,
}) => {
  if (!recoveryCase) {
    throw new Error("Recovery case is required");
  }

  if (!recoveryOffer?.eligible) {
    throw new Error(
      "No eligible recovery offer available"
    );
  }

  if (
    !recoveryOffer.finalAmount ||
    recoveryOffer.finalAmount <= 0
  ) {
    throw new Error(
      "Invalid negotiated payment amount"
    );
  }

  const razorpay = require("../config/razorpay");

  const paymentLink =
    await razorpay.paymentLink.create({
      amount: Math.round(
        recoveryOffer.finalAmount * 100
      ),

      currency:
        recoveryCase.currency || "INR",

      accept_partial: false,

      reference_id:
        `REVIVE-OFFER-${recoveryCase._id.toString().slice(-12)}-${Date.now().toString().slice(-10)}`,

      description:
        `Revive negotiated recovery payment for ${recoveryCase.customerName}`,

      customer: {
        name:
          recoveryCase.customerName,

        email:
          recoveryCase.customerEmail,

        contact:
          recoveryCase.customerPhone,
      },

      notify: {
        sms: false,
        email: false,
      },

      reminder_enable: true,

      notes: {
        recoveryCaseId:
          recoveryCase._id.toString(),

        razorpayOrderId:
          recoveryCase.razorpayOrderId,

        recoveryAction:
          "DYNAMIC_NEGOTIATION",

        originalAmount:
          String(recoveryOffer.originalAmount),

        discountAmount:
          String(recoveryOffer.discountAmount),

        discountPercent:
          String(recoveryOffer.discountPercent),

        finalAmount:
          String(recoveryOffer.finalAmount),
      },
    });

  return paymentLink;
};


// ------------------------------------------------------
// Export
// ------------------------------------------------------

module.exports = {
  getMerchantConfig,
  calculateRecoveryOffer,
  createNegotiatedPaymentLink,
};