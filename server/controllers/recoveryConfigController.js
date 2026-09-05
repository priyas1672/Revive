const {
  getMerchantConfig,
} = require("../services/negotiationService");

// ============================================================
// GET MERCHANT RECOVERY CONFIG
// ============================================================

const getRecoveryConfig = async (req, res) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Merchant authentication required.",
      });
    }

    const config = await getMerchantConfig(merchantId);

    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error) {
    console.error(
      "Get recovery config error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to get recovery configuration.",
    });
  }
};

// ============================================================
// UPDATE MERCHANT RECOVERY CONFIG
// ============================================================

const updateRecoveryConfig = async (req, res) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Merchant authentication required.",
      });
    }

    const {
      maxDiscountPercent,
      maxDiscountAmount,
      minAmountForNegotiation,
      negotiationEnabled,
      allowDiscount,
      allowPromiseToPay,
      allowEmi,
    } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
      maxDiscountPercent !== undefined &&
      (maxDiscountPercent < 0 ||
        maxDiscountPercent > 100)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Max discount percent must be between 0 and 100.",
      });
    }

    if (
      maxDiscountAmount !== undefined &&
      maxDiscountAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Max discount amount cannot be negative.",
      });
    }

    if (
      minAmountForNegotiation !== undefined &&
      minAmountForNegotiation < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum negotiation amount cannot be negative.",
      });
    }

    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------

    const MerchantRecoveryConfig = require(
      "../models/MerchantRecoveryConfig"
    );

    const config =
      await MerchantRecoveryConfig.findOneAndUpdate(
        { merchantId },
        {
          ...(maxDiscountPercent !== undefined && {
            maxDiscountPercent,
          }),

          ...(maxDiscountAmount !== undefined && {
            maxDiscountAmount,
          }),

          ...(minAmountForNegotiation !== undefined && {
            minAmountForNegotiation,
          }),

          ...(negotiationEnabled !== undefined && {
            negotiationEnabled,
          }),

          ...(allowDiscount !== undefined && {
            allowDiscount,
          }),

          ...(allowPromiseToPay !== undefined && {
            allowPromiseToPay,
          }),

          ...(allowEmi !== undefined && {
            allowEmi,
          }),
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "Merchant recovery configuration updated successfully.",
      config,
    });
  } catch (error) {
    console.error(
      "Update recovery config error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to update recovery configuration.",
    });
  }
};

module.exports = {
  getRecoveryConfig,
  updateRecoveryConfig,
};