

const {
  decideRecoveryAction,
} = require("./recoveryEngine");

const Payment = require("../models/Payment");
const RecoveryCase = require("../models/RecoveryCase");
const AuditLog = require("../models/AuditLog");
const CustomerMemory = require("../models/CustomerMemory");
const razorpay = require("../config/razorpay");
const {shouldRetryNow,} = require("./gatewayHealthService");


// ============================================================
// GET OR CREATE CUSTOMER MEMORY
// ============================================================

const getOrCreateCustomerMemory = async (payment) => {
  if (!payment.customerPhone) {
    return null;
  }

  let memory = await CustomerMemory.findOne({
    customerPhone: payment.customerPhone,
  });

  if (!memory) {
    memory = await CustomerMemory.create({
      customerPhone: payment.customerPhone,
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      preferredLanguage: "HINGLISH",
      preferredChannel: "WHATSAPP",
      preferredTone: "FRIENDLY",
      totalPayments: 1,
      failedPayments: 1,
    });

    return memory;
  }

  // Update basic customer information
  memory.customerName =
    payment.customerName || memory.customerName;

  memory.customerEmail =
    payment.customerEmail || memory.customerEmail;

  memory.totalPayments =
    (memory.totalPayments || 0) + 1;

  memory.failedPayments =
    (memory.failedPayments || 0) + 1;

  memory.lastInteractionAt = new Date();

  await memory.save();

  return memory;
};

// ============================================================
// CREATE RETRY PAYMENT LINK
// ============================================================

const createRetryPaymentLink = async (recoveryCase) => {
  if (!recoveryCase) {
    throw new Error("Recovery case is required");
  }

  if (recoveryCase.status !== "IN_PROGRESS") {
    throw new Error(
      "Retry payment link can only be created for IN_PROGRESS cases"
    );
  }

  if ((recoveryCase.retryCount || 0) >= 3) {
    throw new Error(
      "Maximum automatic retry limit reached"
    );
  }

  const paymentLink = await razorpay.paymentLink.create({
    amount: Math.round(recoveryCase.amount * 100),
    currency: recoveryCase.currency || "INR",

    accept_partial: false,

    reference_id:
        // `REVIVE-${recoveryCase._id.toString()}`,
        //  `REVIVE-${recoveryCase._id.toString()}-${Date.now()}`,
          `REVIVE-${recoveryCase._id.toString().slice(-12)}-${Date.now().toString().slice(-10)}`,

    description:
      `Revive payment recovery for ${recoveryCase.customerName}`,

    customer: {
      name: recoveryCase.customerName,
      email: recoveryCase.customerEmail,
      contact: recoveryCase.customerPhone,
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
        "RETRY_PAYMENT",
    },
  });

  return paymentLink;
};


// ============================================================
// PROCESS FAILED PAYMENT
// ============================================================

const processFailedPayment = async (payment) => {
  if (!payment) {
    throw new Error("Payment is required");
  }


  // ----------------------------------------------------------
  // 1. Check whether RecoveryCase already exists
  // ----------------------------------------------------------

  const existingCase = await RecoveryCase.findOne({
    payment: payment._id,
  });

  if (existingCase) {
    return {
      created: false,
      recoveryCase: existingCase,
    };
  }


  // ----------------------------------------------------------
  // 2. Get / create customer memory
  // ----------------------------------------------------------

  const customerMemory =
    await getOrCreateCustomerMemory(payment);


  // ----------------------------------------------------------
  // 3. Ask Revive decision engine
  // ----------------------------------------------------------

  const decision = decideRecoveryAction({
    failureCode: payment.failureCode,
    failureReason: payment.failureReason,
    retryCount: payment.retryCount || 0,
  });


  // ----------------------------------------------------------
  // 4. Determine case state
  // ----------------------------------------------------------

  let status = "OPEN";

  let stoppingRuleTriggered = false;

  let stoppingReason = null;

  let recoveryChannel = null;

  if (decision.action === "ESCALATE_HUMAN") {
  status = "ESCALATED";

  stoppingRuleTriggered = true;

  stoppingReason =
    "Automated recovery stopped because Revive could not safely continue.";

  recoveryChannel = "HUMAN";
}

if (decision.action === "PROMISE_TO_PAY") {
  recoveryChannel =
    customerMemory?.preferredChannel || "WHATSAPP";
}

if (decision.action === "RETRY_PAYMENT") {
  status = "IN_PROGRESS";

  recoveryChannel = null;
}

if (decision.action === "STOP") {
  status = "STOPPED";

  stoppingRuleTriggered = true;

  stoppingReason =
    "Revive stopping rule prevented further automated recovery.";
}

  // ----------------------------------------------------------
  // 5. Create Recovery Case
  // ----------------------------------------------------------

  const recoveryCase =
    await RecoveryCase.create({

      payment: payment._id,

      razorpayOrderId:
        payment.razorpayOrderId,

      razorpayPaymentId:
        payment.razorpayPaymentId,

      customerName:
        payment.customerName,

      customerEmail:
        payment.customerEmail,

      customerPhone:
        payment.customerPhone,

      amount:
        payment.amount,

      currency:
        payment.currency,

      failureCode:
        payment.failureCode,

      failureReason:
        payment.failureReason,
      
      merchantId:
        payment.merchantId,

      decision: {
        action:
          decision.action,

        confidence:
          decision.confidence,

        reasoning:
          decision.reasoning,

        nextAction:
          decision.nextAction,
      },


      status,

      retryCount:
        decision.action === "RETRY_PAYMENT"
            ? (payment.retryCount || 0) + 1
            : (payment.retryCount || 0),

      stoppingRuleTriggered,

      stoppingReason,

      recoveryChannel,

      lastAction:
         decision.action === "RETRY_PAYMENT"
            ? "AUTOMATIC_RETRY_SCHEDULED"
            : decision.action,

      nextActionAt:
      decision.action === "RETRY_PAYMENT"
           ? new Date(Date.now() + 30 * 60 * 1000)
           : null,


      // Promise-to-Pay starts as REQUESTED
      promiseToPay: {
        promised: false,

        promisedAmount:
          decision.action === "PROMISE_TO_PAY"
            ? payment.amount
            : null,

        promisedDate: null,

        status:
          decision.action === "PROMISE_TO_PAY"
            ? "REQUESTED"
            : "NOT_REQUESTED",

        customerMessage: null,

        createdAt:
          decision.action === "PROMISE_TO_PAY"
            ? new Date()
            : null,

        fulfilledAt: null,
      },
    });


  // ----------------------------------------------------------
  // 6. Update customer recovery memory
  // ----------------------------------------------------------

  if (customerMemory) {

    customerMemory.totalRecoveryCases =
      (customerMemory.totalRecoveryCases || 0) + 1;

    customerMemory.lastInteractionAt =
      new Date();

    if (decision.action === "PROMISE_TO_PAY") {

      customerMemory.promisesMade =
        (customerMemory.promisesMade || 0);

    }

    await customerMemory.save();
  }


  // ----------------------------------------------------------
  // 7. Initial audit log
  // ----------------------------------------------------------

  await AuditLog.create({

    recoveryCase:
      recoveryCase._id,

    eventType:
      "PAYMENT_FAILED",

    actor:
      "SYSTEM",

    action:
      "Payment marked as failed by Razorpay webhook.",

    reasoning:
      payment.failureReason,

    metadata: {
      razorpayPaymentId:
        payment.razorpayPaymentId,

      razorpayOrderId:
        payment.razorpayOrderId,

      failureCode:
        payment.failureCode,

      amount:
        payment.amount,

      currency:
        payment.currency,
    },
  });


  // ----------------------------------------------------------
  // 8. Audit Revive decision
  // ----------------------------------------------------------

  await AuditLog.create({

    recoveryCase:
      recoveryCase._id,

    eventType:
      "DECISION_MADE",

    actor:
      "REVIVE_AGENT",

    action:
      decision.action,

    reasoning:
      decision.reasoning,

    metadata: {

      confidence:
        decision.confidence,

      nextAction:
        decision.nextAction,

      retryCount:
        payment.retryCount || 0,

      recoveryChannel,

      customerMemoryUsed:
        !!customerMemory,

      customerReliabilityScore:
        customerMemory?.reliabilityScore ?? null,
    },
  });


  // ----------------------------------------------------------
  // 9. Audit Promise-to-Pay request
  // ----------------------------------------------------------

  if (decision.action === "PROMISE_TO_PAY") {

    await AuditLog.create({

      recoveryCase:
        recoveryCase._id,

      eventType:
        "PROMISE_REQUESTED",

      actor:
        "REVIVE_AGENT",

      action:
        "Promise-to-Pay requested from customer.",

      reasoning:
        "Revive selected Promise-to-Pay because the payment failure indicates insufficient funds.",

      metadata: {

        amount:
          payment.amount,

        currency:
          payment.currency,

        channel:
          recoveryChannel,

        preferredLanguage:
          customerMemory?.preferredLanguage || "HINGLISH",

        preferredTone:
          customerMemory?.preferredTone || "FRIENDLY",

        reliabilityScore:
          customerMemory?.reliabilityScore ?? 0.5,
      },
    });
  }


  // ----------------------------------------------------------
  // 10. Audit stopping rule
  // ----------------------------------------------------------

  if (stoppingRuleTriggered) {

    await AuditLog.create({

      recoveryCase:
        recoveryCase._id,

      eventType:
        "STOPPING_RULE_TRIGGERED",

      actor:
        "REVIVE_AGENT",

      action:
        "Automated recovery stopped.",

      reasoning:
        stoppingReason,

      metadata: {

        decision:
          decision.action,

        retryCount:
          payment.retryCount || 0,
      },
    });
  }


  // ----------------------------------------------------------
  // 11. Return everything
  // ----------------------------------------------------------

  return {

    created: true,

    recoveryCase,

    decision,

    customerMemory,
  };
};

// ============================================================
// PROCESS AUTOMATIC RECOVERY RETRY
// ============================================================

const processRecoveryRetry = async (recoveryCase) => {
  if (!recoveryCase) {
    throw new Error("Recovery case is required");
  }

  // ----------------------------------------------------------
  // 1. Safety check
  // ----------------------------------------------------------

  if (recoveryCase.status === "RECOVERED") {
    return {
      retried: false,
      reason: "Recovery case is already recovered.",
    };
  }

  // ----------------------------------------------------------
  // 2. Maximum retry limit
  // ----------------------------------------------------------

  if (recoveryCase.retryCount >= 3) {
    recoveryCase.status = "ESCALATED";
    recoveryCase.stoppingRuleTriggered = true;

    recoveryCase.stoppingReason =
      "Maximum automated recovery attempts reached.";

    recoveryCase.recoveryChannel = "HUMAN";

    recoveryCase.lastAction = "RETRY_LIMIT_REACHED";

    await recoveryCase.save();

    await AuditLog.create({
      recoveryCase: recoveryCase._id,

      eventType: "STOPPING_RULE_TRIGGERED",

      actor: "REVIVE_AGENT",

      action:
        "Automated recovery stopped after maximum retry attempts.",

      reasoning:
        "Revive reached the maximum allowed automated recovery attempts and escalated the case to human support.",

      metadata: {
        retryCount: recoveryCase.retryCount,
        maxRetries: 3,
      },
    });

    return {
      retried: false,
      escalated: true,
      reason: "Maximum retry limit reached.",
    };
  }

   // ----------------------------------------------------------
  // 3. Check gateway health before retry
  // ----------------------------------------------------------

  const gatewayCheck = await shouldRetryNow();

  if (!gatewayCheck.retryNow) {
    const nextRetry = new Date();

    nextRetry.setMinutes(
      nextRetry.getMinutes() + 30
    );

    recoveryCase.status = "IN_PROGRESS";

    // Do NOT increment retryCount because
    // actual payment retry did not happen.
    recoveryCase.lastAction =
      "RETRY_POSTPONED_GATEWAY_DOWN";

    recoveryCase.nextActionAt = nextRetry;

    await recoveryCase.save();

    await AuditLog.create({
      recoveryCase: recoveryCase._id,

      eventType: "RETRY_SCHEDULED",

      actor: "REVIVE_AGENT",

      action:
        "Payment retry postponed because gateway is unhealthy.",

      reasoning:
        gatewayCheck.health.reasoning,

      metadata: {
        gateway: gatewayCheck.health.gateway,
        gatewayStatus: gatewayCheck.health.status,
        checkedAt: gatewayCheck.health.checkedAt,
        retryCount: recoveryCase.retryCount,
        nextActionAt: nextRetry,
      },
    });

    return {
      retried: false,
      postponed: true,
      reason:
        "Gateway is currently unhealthy. Retry postponed.",
      gatewayHealth: gatewayCheck.health,
      nextActionAt: nextRetry,
    };
  }

  // ----------------------------------------------------------
  // 4. Increment retry count
  // ----------------------------------------------------------

  recoveryCase.retryCount =
    (recoveryCase.retryCount || 0) + 1;

  recoveryCase.status = "IN_PROGRESS";

  recoveryCase.lastAction = "AUTOMATED_RETRY_ATTEMPT";

  recoveryCase.stoppingRuleTriggered = false;

  recoveryCase.stoppingReason = null;

  // ----------------------------------------------------------
  // 5. Schedule next controlled action
  // ----------------------------------------------------------

  const nextRetry = new Date();

  nextRetry.setMinutes(
    nextRetry.getMinutes() + 30
  );

  recoveryCase.nextActionAt = nextRetry;

  await recoveryCase.save();

  // ----------------------------------------------------------
  // 6. Audit retry
  // ----------------------------------------------------------

  await AuditLog.create({
    recoveryCase: recoveryCase._id,

    eventType: "RETRY_ATTEMPTED",

    actor: "REVIVE_AGENT",

    action:
      "Controlled automated payment recovery retry initiated.",

    reasoning:
      "Revive selected a bounded retry while the recovery attempt limit has not been reached.",

    metadata: {
      retryCount: recoveryCase.retryCount,
      maxRetries: 3,
      nextActionAt: nextRetry,
      amount: recoveryCase.amount,
      currency: recoveryCase.currency,
    },
  });

  return {
    retried: true,
    retryCount: recoveryCase.retryCount,
    nextActionAt: nextRetry,
  };
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  processFailedPayment,
  getOrCreateCustomerMemory,
  processRecoveryRetry,
  createRetryPaymentLink,
};

