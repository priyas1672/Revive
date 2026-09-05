

const RecoveryCase = require("../models/RecoveryCase");
const CustomerMemory = require("../models/CustomerMemory");
const AuditLog = require("../models/AuditLog");


// ============================================================
// 1. CUSTOMER PROMISE RECEIVED
// ============================================================

const receivePromise = async (req, res) => {
  try {
    const {
      recoveryCaseId,
      promisedDate,
      promisedAmount,
      customerMessage,
    } = req.body;

    if (!recoveryCaseId || !promisedDate) {
      return res.status(400).json({
        success: false,
        message:
          "recoveryCaseId and promisedDate are required",
      });
    }

    const recoveryCase = await RecoveryCase.findById(
      recoveryCaseId
    );

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        message: "Recovery case not found",
      });
    }

    // Don't allow promise after case is already recovered/stopped
    if (
      recoveryCase.status === "RECOVERED" ||
      recoveryCase.status === "STOPPED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This recovery case is already resolved or stopped",
      });
    }

    recoveryCase.status = "PROMISED";

    recoveryCase.promiseToPay = {
      promised: true,

      promisedAmount:
        promisedAmount || recoveryCase.amount,

      promisedDate: new Date(promisedDate),

      status: "PROMISED",

      customerMessage:
        customerMessage || null,

      createdAt: new Date(),

      fulfilledAt: null,
    };

    recoveryCase.lastAction = "PROMISE_RECEIVED";

    recoveryCase.nextActionAt =
      new Date(promisedDate);

    await recoveryCase.save();


    // ---------------------------------------------------------
    // Customer Memory
    // ---------------------------------------------------------

    if (recoveryCase.customerPhone) {
      const memory = await CustomerMemory.findOne({
        customerPhone: recoveryCase.customerPhone,
      });

      if (memory) {
        memory.promisesMade =
          (memory.promisesMade || 0) + 1;

        memory.lastPromiseDate =
          new Date(promisedDate);

        memory.lastInteractionAt =
          new Date();

        await memory.save();
      }
    }


    // ---------------------------------------------------------
    // Audit
    // ---------------------------------------------------------

    await AuditLog.create({
      recoveryCase: recoveryCase._id,

      eventType: "PROMISE_RECEIVED",

      actor: "CUSTOMER",

      action:
        "Customer promised to complete payment.",

      reasoning:
        "Customer provided a payment commitment date.",

      metadata: {
        promisedAmount:
          promisedAmount || recoveryCase.amount,

        promisedDate,

        customerMessage:
          customerMessage || null,
      },
    });


    return res.status(200).json({
      success: true,

      message:
        "Promise recorded successfully",

      recoveryCase: {
        id: recoveryCase._id,

        status: recoveryCase.status,

        promiseToPay:
          recoveryCase.promiseToPay,

        nextActionAt:
          recoveryCase.nextActionAt,
      },
    });

  } catch (error) {
    console.error(
      "Promise receive error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to record promise",
    });
  }
};


// ============================================================
// 2. PROMISE FULFILLED
// ============================================================

const fulfillPromise = async (req, res) => {
  try {
    const { recoveryCaseId } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "recoveryCaseId is required",
      });
    }

    const recoveryCase =
      await RecoveryCase.findById(
        recoveryCaseId
      );

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        message:
          "Recovery case not found",
      });
    }


    // ---------------------------------------------------------
    // Idempotency
    // ---------------------------------------------------------

    if (
      recoveryCase.promiseToPay?.status ===
      "FULFILLED"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Promise was already fulfilled",
        recoveryCase,
      });
    }


    if (
      recoveryCase.promiseToPay?.status !==
      "PROMISED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No active promise exists for this recovery case",
      });
    }


    // ---------------------------------------------------------
    // Update Recovery Case
    // ---------------------------------------------------------

    recoveryCase.promiseToPay.status =
      "FULFILLED";

    recoveryCase.promiseToPay.fulfilledAt =
      new Date();

    recoveryCase.status =
      "RECOVERED";

    recoveryCase.lastAction =
      "PROMISE_FULFILLED";

    recoveryCase.nextActionAt = null;

    recoveryCase.resolvedAt =
      new Date();

    recoveryCase.stoppingRuleTriggered =
      false;

    recoveryCase.stoppingReason = null;

    await recoveryCase.save();


    // ---------------------------------------------------------
    // Update Customer Memory
    // ---------------------------------------------------------

    if (recoveryCase.customerPhone) {
      const memory =
        await CustomerMemory.findOne({
          customerPhone:
            recoveryCase.customerPhone,
        });

      if (memory) {
        memory.promisesFulfilled =
          (memory.promisesFulfilled || 0) + 1;

        memory.recoveredCases =
          (memory.recoveredCases || 0) + 1;

        memory.lastInteractionAt =
          new Date();


        // Reliability score improves
        const made =
          memory.promisesMade || 0;

        const fulfilled =
          memory.promisesFulfilled || 0;

        if (made > 0) {
          memory.reliabilityScore =
            Math.min(
              1,
              fulfilled / made
            );
        }

        await memory.save();
      }
    }


    // ---------------------------------------------------------
    // Audit
    // ---------------------------------------------------------

    await AuditLog.create({
      recoveryCase:
        recoveryCase._id,

      eventType:
        "RECOVERY_SUCCEEDED",

      actor: "SYSTEM",

      action:
        "Customer fulfilled the promised payment.",

      reasoning:
        "The promised payment was successfully completed.",

      metadata: {
        promisedAmount:
          recoveryCase.promiseToPay
            .promisedAmount,

        promisedDate:
          recoveryCase.promiseToPay
            .promisedDate,

        fulfilledAt:
          recoveryCase.promiseToPay
            .fulfilledAt,
      },
    });


    return res.status(200).json({
      success: true,

      message:
        "Promise fulfilled successfully",

      recoveryCase: {
        id: recoveryCase._id,

        status:
          recoveryCase.status,

        promiseStatus:
          recoveryCase.promiseToPay.status,

        fulfilledAt:
          recoveryCase.promiseToPay
            .fulfilledAt,
      },
    });

  } catch (error) {
    console.error(
      "Promise fulfillment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fulfill promise",
    });
  }
};


// ============================================================
// 3. PROMISE BROKEN
// ============================================================

const breakPromise = async (req, res) => {
  try {
    const {
      recoveryCaseId,
      reason,
    } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message:
          "recoveryCaseId is required",
      });
    }

    const recoveryCase =
      await RecoveryCase.findById(
        recoveryCaseId
      );

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        message:
          "Recovery case not found",
      });
    }


    // ---------------------------------------------------------
    // Idempotency
    // ---------------------------------------------------------

    if (
      recoveryCase.promiseToPay?.status ===
      "BROKEN"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Promise was already marked as broken",
        recoveryCase,
      });
    }


    if (
      recoveryCase.promiseToPay?.status !==
      "PROMISED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No active promise exists for this recovery case",
      });
    }


    // ---------------------------------------------------------
    // Update Recovery Case
    // ---------------------------------------------------------

    recoveryCase.promiseToPay.status =
      "BROKEN";

    recoveryCase.status =
      "ESCALATED";

    recoveryCase.lastAction =
      "PROMISE_BROKEN";

    recoveryCase.stoppingRuleTriggered =
      true;

    recoveryCase.stoppingReason =
      reason ||
      "Customer did not fulfill the promised payment.";

    recoveryCase.recoveryChannel =
      "HUMAN";

    recoveryCase.nextActionAt = null;

    await recoveryCase.save();


    // ---------------------------------------------------------
    // Update Customer Memory
    // ---------------------------------------------------------

    if (recoveryCase.customerPhone) {
      const memory =
        await CustomerMemory.findOne({
          customerPhone:
            recoveryCase.customerPhone,
        });

      if (memory) {
        memory.promisesBroken =
          (memory.promisesBroken || 0) + 1;

        memory.lastInteractionAt =
          new Date();


        // Reliability decreases
        const made =
          memory.promisesMade || 0;

        const broken =
          memory.promisesBroken || 0;

        if (made > 0) {
          memory.reliabilityScore =
            Math.max(
              0,
              (made - broken) / made
            );
        }

        await memory.save();
      }
    }


    // ---------------------------------------------------------
    // Audit - Promise Broken
    // ---------------------------------------------------------

    await AuditLog.create({
      recoveryCase:
        recoveryCase._id,

      eventType:
        "STOPPING_RULE_TRIGGERED",

      actor: "SYSTEM",

      action:
        "Promise-to-Pay was not fulfilled. Automated recovery stopped and case escalated to human support.",

      reasoning:
        reason ||
        "Customer did not fulfill the promised payment.",

      metadata: {
        promisedAmount:
          recoveryCase.promiseToPay
            .promisedAmount,

        promisedDate:
          recoveryCase.promiseToPay
            .promisedDate,

        escalation:
          "HUMAN",
      },
    });


    // ---------------------------------------------------------
    // Audit - Escalation
    // ---------------------------------------------------------

    await AuditLog.create({
      recoveryCase:
        recoveryCase._id,

      eventType:
        "ESCALATED",

      actor: "REVIVE_AGENT",

      action:
        "Recovery case escalated to human support.",

      reasoning:
        "Customer promise was broken. Further automated recovery is stopped.",

      metadata: {
        reason:
          reason || null,
      },
    });


    return res.status(200).json({
      success: true,

      message:
        "Promise marked as broken and case escalated",

      recoveryCase: {
        id: recoveryCase._id,

        status:
          recoveryCase.status,

        promiseStatus:
          recoveryCase.promiseToPay.status,

        recoveryChannel:
          recoveryCase.recoveryChannel,

        stoppingRuleTriggered:
          recoveryCase
            .stoppingRuleTriggered,
      },
    });

  } catch (error) {
    console.error(
      "Promise broken error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to mark promise as broken",
    });
  }
};


module.exports = {
  receivePromise,
  fulfillPromise,
  breakPromise,
};