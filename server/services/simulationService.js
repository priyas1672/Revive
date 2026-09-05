const {
  decideRecoveryAction,
} = require("./recoveryEngine");

// ============================================================
// BATCH SIMULATION SERVICE
// ============================================================

const simulateBatchRecovery = async (payments) => {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new Error("At least one payment record is required");
  }

  const results = [];

  const summary = {
    total: payments.length,
    processed: 0,
    retryPayment: 0,
    promiseToPay: 0,
    escalatedHuman: 0,
    stopped: 0,
  };

  for (const payment of payments) {
    try {
      const amount = Number(payment.amount || 0);

      const failureCode =
        payment.failureCode ||
        payment.errorCode ||
        "";

      const failureReason =
        payment.failureReason ||
        payment.errorDescription ||
        "";

      // --------------------------------------------------------
      // Validate payment data
      // --------------------------------------------------------

      if (!payment.customerName || !amount || !failureCode) {
        results.push({
          customerName:
            payment.customerName || null,

          amount,

          failureCode,

          failureReason,

          status: "INVALID",

          action: "STOP",

          reasoning:
            "Required payment information is missing.",
        });

        summary.stopped++;

        continue;
      }

      // --------------------------------------------------------
      // Ask Revive Recovery Engine
      // --------------------------------------------------------

      const decision =
        decideRecoveryAction({
          failureCode,
          failureReason,
          retryCount: Number(
            payment.retryCount || 0
          ),
        });

      // --------------------------------------------------------
      // Update summary
      // --------------------------------------------------------

      summary.processed++;

      if (
        decision.action ===
        "RETRY_PAYMENT"
      ) {
        summary.retryPayment++;
      }

      else if (
        decision.action ===
        "PROMISE_TO_PAY"
      ) {
        summary.promiseToPay++;
      }

      else if (
        decision.action ===
        "ESCALATE_HUMAN"
      ) {
        summary.escalatedHuman++;
      }

      else {
        summary.stopped++;
      }

      // --------------------------------------------------------
      // Store simulation result
      // --------------------------------------------------------

      results.push({
        customerName:
          payment.customerName,

        customerEmail:
          payment.customerEmail || null,

        customerPhone:
          payment.customerPhone || null,

        amount,

        currency:
          payment.currency || "INR",

        failureCode,

        failureReason,

        retryCount:
          Number(payment.retryCount || 0),

        action:
          decision.action,

        confidence:
          decision.confidence,

        reasoning:
          decision.reasoning,

        nextAction:
          decision.nextAction,

        simulated:
          true,
      });

    } catch (error) {

      results.push({
        customerName:
          payment.customerName || null,

        amount:
          Number(payment.amount || 0),

        failureCode:
          payment.failureCode || null,

        failureReason:
          payment.failureReason || null,

        status: "ERROR",

        action: "ESCALATE_HUMAN",

        reasoning:
          error.message,
      });

      summary.escalatedHuman++;
    }
  }

  return {
    success: true,

    simulation: true,

    summary,

    results,
  };
};

module.exports = {
  simulateBatchRecovery,
};