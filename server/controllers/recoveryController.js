

const {
  decideRecoveryAction,
} = require("../services/recoveryEngine");

const RecoveryCase = require("../models/RecoveryCase");

const {
  processRecoveryRetry,
} = require("../services/recoveryScheduler");

const {
  calculateRecoveryOffer,
} = require("../services/negotiationService");

// ------------------------------------------------------
// Evaluate recovery decision
// ------------------------------------------------------

const evaluateRecovery = async (req, res) => {
  try {
    const {
      failureCode,
      failureReason,
      retryCount,
    } = req.body;

    const decision = decideRecoveryAction({
      failureCode,
      failureReason,
      retryCount,
    });

    return res.status(200).json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error(
      "Recovery evaluation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to evaluate recovery decision",
    });
  }
};

const generateRecoveryOffer = async (req, res) => {
  try {
    const {
      amount,
    } = req.body;

    // Logged-in merchant ki ID
     const merchantId = req.merchantId;

    if (!merchantId || !amount) {
      return res.status(400).json({
        success: false,
        message: "merchantId and amount are required",
      });
    }

    const offer =
      await calculateRecoveryOffer({
        merchantId,
        amount: Number(amount),
      });

    return res.status(200).json({
      success: true,
      offer,
    });
  } catch (error) {
    console.error(
      "Recovery offer error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to generate recovery offer",
      error: error.message,
    });
  }
};


// ------------------------------------------------------
// Manually trigger retry for testing
// ------------------------------------------------------

const retryRecovery = async (req, res) => {
  try {
    const {
      recoveryCaseId,
    } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

   
       // Only find recovery case belonging
    // to the logged-in merchant

    const recoveryCase =
     await RecoveryCase.findOne({
    _id: recoveryCaseId,
    merchantId: req.merchantId,
  });

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        message: "Recovery case not found",
      });
    }

    // Make this case immediately eligible
    // for the retry processor.
    recoveryCase.status =
      "IN_PROGRESS";

    recoveryCase.lastAction =
      "AUTOMATIC_RETRY_SCHEDULED";

    recoveryCase.nextActionAt =
      new Date();

    await recoveryCase.save();

    // Run retry processor
    await processRecoveryRetry(recoveryCase);

    // Fetch latest state
      const updatedCase =
       await RecoveryCase.findOne({
      _id: recoveryCaseId,
       merchantId: req.merchantId,
  });


    return res.status(200).json({
      success: true,
      message:
        "Recovery retry processing completed",
      recoveryCase: {
        id: updatedCase._id,
        status: updatedCase.status,
        retryCount: updatedCase.retryCount,
        lastAction: updatedCase.lastAction,
        nextActionAt:
          updatedCase.nextActionAt,
        retryPaymentLink:
          updatedCase.retryPaymentLink,
      },
    });
  } catch (error) {
    console.error(
      "Manual recovery retry error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to process recovery retry",
      error: error.message,
    });
  }
};

module.exports = {
  evaluateRecovery,
  retryRecovery,
  generateRecoveryOffer,
};