const Payment = require("../models/Payment");
const RecoveryCase = require("../models/RecoveryCase");

// ============================================================
// ROI DASHBOARD SERVICE
// ============================================================

const getROIDashboard = async (merchantId) => {
    if (!merchantId) {
    throw new Error("Merchant authentication required.");
  }
  // ----------------------------------------------------------
  // 1. PAYMENT METRICS
  // ----------------------------------------------------------

  const paymentStats = await Payment.aggregate([
    {
      $match: {
      merchantId: merchantId,
    },
  },
  {
      $group: {
        _id: null,

        totalPayments: {
          $sum: 1,
        },

        totalPaymentAmount: {
          $sum: "$amount",
        },

        capturedPayments: {
          $sum: {
            $cond: [
              { $eq: ["$status", "CAPTURED"] },
              1,
              0,
            ],
          },
        },

        capturedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "CAPTURED"] },
              "$amount",
              0,
            ],
          },
        },

        failedPayments: {
          $sum: {
            $cond: [
              { $eq: ["$status", "FAILED"] },
              1,
              0,
            ],
          },
        },

        failedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "FAILED"] },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  // ----------------------------------------------------------
  // 2. RECOVERY CASE METRICS
  // ----------------------------------------------------------

  const recoveryStats = await RecoveryCase.aggregate([
    {
      $match: {
      merchantId: merchantId,
    },
  },
  {
      $group: {
        _id: null,

        totalRecoveryCases: {
          $sum: 1,
        },

        recoveredCases: {
          $sum: {
            $cond: [
              { $eq: ["$status", "RECOVERED"] },
              1,
              0,
            ],
          },
        },

        recoveredAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "RECOVERED"] },
              "$amount",
              0,
            ],
          },
        },

        openCases: {
          $sum: {
            $cond: [
              { $eq: ["$status", "OPEN"] },
              1,
              0,
            ],
          },
        },

        inProgressCases: {
          $sum: {
            $cond: [
              { $eq: ["$status", "IN_PROGRESS"] },
              1,
              0,
            ],
          },
        },

        promisedCases: {
          $sum: {
            $cond: [
              { $eq: ["$status", "PROMISED"] },
              1,
              0,
            ],
          },
        },

        escalatedCases: {
          $sum: {
            $cond: [
              { $eq: ["$status", "ESCALATED"] },
              1,
              0,
            ],
          },
        },

        stoppedCases: {
          $sum: {
            $cond: [
              { $eq: ["$status", "STOPPED"] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  // ----------------------------------------------------------
  // 3. RECOVERY ACTION BREAKDOWN
  // ----------------------------------------------------------

  const actionStats =
    await RecoveryCase.aggregate([
      {
        $match: {
        merchantId: merchantId,
      },
    },
    {
        $group: {
          _id: "$decision.action",
          count: {
            $sum: 1,
          },
          amount: {
            $sum: "$amount",
          },
        },
      },
    ]);

  // ----------------------------------------------------------
  // 4. PROMISE-TO-PAY METRICS
  // ----------------------------------------------------------

  const promiseStats =
    await RecoveryCase.aggregate([
      {
          $match: {
        merchantId: merchantId,
      },
    },
    {
        $group: {
          _id: "$promiseToPay.status",
          count: {
            $sum: 1,
          },
          amount: {
            $sum: {
              $ifNull: [
                "$promiseToPay.promisedAmount",
                0,
              ],
            },
          },
        },
      },
    ]);

  // ----------------------------------------------------------
  // 5. NEGOTIATION METRICS
  // ----------------------------------------------------------

  const negotiationStats =
    await RecoveryCase.aggregate([
      {
          $match: {
        merchantId: merchantId,
      },
    },
    {
        $group: {
          _id: "$negotiation.status",
          count: {
            $sum: 1,
          },
          discountAmount: {
            $sum: {
              $ifNull: [
                "$negotiation.discountAmount",
                0,
              ],
            },
          },
          finalAmount: {
            $sum: {
              $ifNull: [
                "$negotiation.finalAmount",
                0,
              ],
            },
          },
        },
      },
    ]);

  // ----------------------------------------------------------
  // 6. SAFE DEFAULTS
  // ----------------------------------------------------------

  const payments =
    paymentStats[0] || {
      totalPayments: 0,
      totalPaymentAmount: 0,
      capturedPayments: 0,
      capturedAmount: 0,
      failedPayments: 0,
      failedAmount: 0,
    };

  const recoveries =
    recoveryStats[0] || {
      totalRecoveryCases: 0,
      recoveredCases: 0,
      recoveredAmount: 0,
      openCases: 0,
      inProgressCases: 0,
      promisedCases: 0,
      escalatedCases: 0,
      stoppedCases: 0,
    };

  // ----------------------------------------------------------
  // 7. RECOVERY RATE
  // ----------------------------------------------------------

  const recoveryRate =
    recoveries.totalRecoveryCases > 0
      ? (
          (recoveries.recoveredCases /
            recoveries.totalRecoveryCases) *
          100
        ).toFixed(2)
      : "0.00";

  // ----------------------------------------------------------
  // 8. REVENUE RECOVERY RATE
  // ----------------------------------------------------------

  const revenueRecoveryRate =
  payments.failedAmount > 0
    ? (
        (recoveries.recoveredAmount /
          payments.failedAmount) *
        100
      ).toFixed(2)
    : "0.00";
  // ----------------------------------------------------------
  // 9. OUTSTANDING RECOVERY
  // ----------------------------------------------------------

  const outstandingAmount =
    Math.max(
      0,
      payments.failedAmount -
        recoveries.recoveredAmount
    );

  // ----------------------------------------------------------
  // 10. BUILD ACTION MAP
  // ----------------------------------------------------------

  const actions = {
    RETRY_PAYMENT: {
      count: 0,
      amount: 0,
    },

    PROMISE_TO_PAY: {
      count: 0,
      amount: 0,
    },

    ESCALATE_HUMAN: {
      count: 0,
      amount: 0,
    },

    STOP: {
      count: 0,
      amount: 0,
    },
  };

  for (const item of actionStats) {
    if (actions[item._id]) {
      actions[item._id] = {
        count: item.count,
        amount: item.amount,
      };
    }
  }

  // ----------------------------------------------------------
  // 11. BUILD PROMISE MAP
  // ----------------------------------------------------------

  const promises = {};

  for (const item of promiseStats) {
    if (item._id) {
      promises[item._id] = {
        count: item.count,
        amount: item.amount,
      };
    }
  }

  // ----------------------------------------------------------
  // 12. BUILD NEGOTIATION MAP
  // ----------------------------------------------------------

  const negotiations = {};

  for (const item of negotiationStats) {
    if (item._id) {
      negotiations[item._id] = {
        count: item.count,
        discountAmount:
          item.discountAmount,
        finalAmount:
          item.finalAmount,
      };
    }
  }

  // ----------------------------------------------------------
  // 13. FINAL DASHBOARD
  // ----------------------------------------------------------

  return {
    success: true,

    dashboard: {
      generatedAt: new Date(),

      payments: {
        total:
          payments.totalPayments,

        totalAmount:
          payments.totalPaymentAmount,

        captured:
          payments.capturedPayments,

        capturedAmount:
          payments.capturedAmount,

        failed:
          payments.failedPayments,

        failedAmount:
          payments.failedAmount,
      },

      recovery: {
        totalCases:
          recoveries.totalRecoveryCases,

        recoveredCases:
          recoveries.recoveredCases,

        recoveredAmount:
          recoveries.recoveredAmount,

        recoveryRate:
          Number(recoveryRate),

        revenueRecoveryRate:
          Number(revenueRecoveryRate),

        outstandingAmount,

        openCases:
          recoveries.openCases,

        inProgressCases:
          recoveries.inProgressCases,

        promisedCases:
          recoveries.promisedCases,

        escalatedCases:
          recoveries.escalatedCases,

        stoppedCases:
          recoveries.stoppedCases,
      },

      actions,

      promises,

      negotiations,
    },
  };
};

module.exports = {
  getROIDashboard,
};