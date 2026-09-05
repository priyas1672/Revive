const crypto = require("crypto");
const Payment = require("../models/Payment");
const RecoveryCase = require("../models/RecoveryCase");
const CustomerMemory = require("../models/CustomerMemory");
const AuditLog = require("../models/AuditLog");

const {processFailedPayment,} = require("../services/recoveryService");

const {sendRecoveryCommunication,} = require("../services/communicationService");


const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  }

  if (!signature) {
    throw new Error("Missing Razorpay webhook signature");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    throw new Error("Invalid Razorpay webhook signature");
  }

  const isValid = crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );

  if (!isValid) {
    throw new Error("Invalid Razorpay webhook signature");
  }

  return true;
};

const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];

    // req.body is a Buffer because this route uses express.raw()
    const rawBody = req.body;

    console.log("========== WEBHOOK DEBUG ==========");
console.log(
  "Secret length:",
  process.env.RAZORPAY_WEBHOOK_SECRET?.length
);
console.log("Raw body length:", rawBody?.length);
console.log("Received signature:", signature);
console.log(
  "Expected signature:",
  crypto
    .createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET
    )
    .update(rawBody)
    .digest("hex")
);
console.log("===================================");

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook body",
      });
    }

    // 1. Verify Razorpay signature
    verifyWebhookSignature(rawBody, signature);

    // 2. Parse only AFTER signature verification
    const event = JSON.parse(rawBody.toString("utf8"));

    console.log("========================================");
    console.log("Razorpay Webhook Received");
    console.log("Event:", event.event);
    console.log("Event ID:", eventId);
    console.log("========================================");

    // 3. Ignore unsupported events for now
    const supportedEvents = [
      "payment.failed",
      "payment.authorized",
      "payment.captured",
      "payment_link.paid",
    ];

    if (!supportedEvents.includes(event.event)) {
      return res.status(200).json({
        success: true,
        message: "Event received but not handled",
        event: event.event,
      });
    }


    
const paymentEntity =
  event?.payload?.payment?.entity;

    //====================================================
// NEGOTIATED PAYMENT LINK PAID
// ====================================================


if (event.event === "payment_link.paid") {
  
  const paymentLinkEntity =
    event?.payload?.payment_link?.entity;

    // const paymentEntity =
    //   event?.payload?.payment?.entity;

      const orderEntity =
    event?.payload?.order?.entity;
      
  if (!paymentLinkEntity) {
    return res.status(400).json({
      success: false,
      message: "Payment Link entity missing from webhook",
    });
  }

  // ---------------------------------------------
  // Find RecoveryCase
  // ---------------------------------------------

  const recoveryCaseId =
    paymentLinkEntity?.notes?.recoveryCaseId ||
    paymentEntity?.notes?.recoveryCaseId ||
    orderEntity?.notes?.recoveryCaseId;

  let recoveryCase = null;

  if (recoveryCaseId) {
    recoveryCase =
      await RecoveryCase.findById(recoveryCaseId);
  }

  // ---------------------------------------------
  // Fallback: find using Payment Link ID
  // ---------------------------------------------

  if (!recoveryCase) {
    recoveryCase =
      await RecoveryCase.findOne({
        "negotiation.paymentLinkId":
          paymentLinkEntity.id,
      });
  }

  if (!recoveryCase) {
    console.error(
      "Recovery case not found for negotiated Payment Link:",
      paymentLinkEntity.id
    );

    return res.status(404).json({
      success: false,
      message:
        "Recovery case not found for negotiated Payment Link",
    });
  }

  // ---------------------------------------------
// Prevent duplicate payment_link.paid processing
// ---------------------------------------------

if (recoveryCase.negotiation?.status === "RECOVERED") {
  return res.status(200).json({
    success: true,
    message: "Negotiated payment already processed",
    event: event.event,
    recoveryCaseId: recoveryCase._id,
    paymentLinkId: paymentLinkEntity.id,
    status: "RECOVERED",
  });
}

  // ---------------------------------------------
  // Mark negotiation as recovered
  // ---------------------------------------------

  recoveryCase.status = "RECOVERED";

  recoveryCase.resolvedAt = new Date();

  recoveryCase.lastAction =
    "NEGOTIATED_RECOVERY_SUCCEEDED";

  recoveryCase.stoppingRuleTriggered = false;
  recoveryCase.stoppingReason = null;

  if (!recoveryCase.negotiation) {
    recoveryCase.negotiation = {};
  }

  recoveryCase.negotiation.offerAccepted = true;

  recoveryCase.negotiation.paymentLinkId =
    paymentLinkEntity.id;

  recoveryCase.negotiation.paymentLink =
  paymentLinkEntity.short_url || null;

  recoveryCase.negotiation.status = "RECOVERED";

  await recoveryCase.save();

  // ---------------------------------------------
  // Update Customer Memory
  // ---------------------------------------------

  if (recoveryCase.customerPhone) {
    const memory =
      await CustomerMemory.findOne({
        customerPhone:
          recoveryCase.customerPhone,
      });

    if (memory) {
      memory.successfulPayments =
        (memory.successfulPayments || 0) + 1;

      memory.recoveredCases =
        (memory.recoveredCases || 0) + 1;

      memory.lastInteractionAt =
        new Date();

      await memory.save();

      console.log(
        "Customer memory updated after negotiated recovery:",
        memory.customerPhone
      );
    }
  }

  // ---------------------------------------------
  // Audit Trail
  // ---------------------------------------------

  await AuditLog.create({
    recoveryCase: recoveryCase._id,

    eventType: "RECOVERY_SUCCEEDED",

    actor: "SYSTEM",

    action:
      "Negotiated recovery payment was successfully completed.",

    reasoning:
      "Razorpay payment_link.paid confirmed that the negotiated recovery Payment Link was paid.",

    metadata: {
      paymentLinkId:
        paymentLinkEntity.id,

      razorpayPaymentId:
        paymentEntity?.id || null,

      razorpayOrderId:
        paymentEntity?.order_id ||
        orderEntity?.id ||
        null,

      originalAmount:
        recoveryCase.negotiation.originalAmount,

      discountAmount:
        recoveryCase.negotiation.discountAmount,

      finalAmount:
        recoveryCase.negotiation.finalAmount,
    },
  });

  await AuditLog.create({
    recoveryCase: recoveryCase._id,

    eventType: "NEGOTIATION_RECOVERED",

    actor: "SYSTEM",

    action:
      "Customer completed payment through the negotiated recovery offer.",

    reasoning:
      "Razorpay confirmed successful payment against the negotiated Payment Link.",

    metadata: {
      paymentLinkId:
        paymentLinkEntity.id,

      finalAmount:
        recoveryCase.negotiation.finalAmount,

      discountAmount:
        recoveryCase.negotiation.discountAmount,
    },
  });

  console.log(
    "Negotiated recovery successfully completed:",
    recoveryCase._id
  );

  // ---------------------------------------------
  // IMPORTANT:
  // Do NOT continue into normal payment flow.
  // ---------------------------------------------

  return res.status(200).json({
    success: true,

    message:
      "Negotiated recovery payment processed successfully",

    event: event.event,

    recoveryCaseId:
      recoveryCase._id,

    paymentLinkId:
      paymentLinkEntity.id,

    status:
      recoveryCase.status,

    negotiation:
      recoveryCase.negotiation,
  });
}
    if (!paymentEntity) {
      return res.status(400).json({
        success: false,
        message: "Payment entity missing from webhook",
      });
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;

    if (!razorpayPaymentId || !razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID or Order ID missing",
      });
    }

    // 4. Find the payment created during create-order
    const payment = await Payment.findOne({
      razorpayOrderId,
    });

    if (!payment) {
      console.error(
        "Payment record not found for order:",
        razorpayOrderId
      );

      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // 5. Idempotency check
    if (
      eventId &&
      payment.webhookEventIds.includes(eventId)
    ) {
      console.log("Duplicate webhook ignored:", eventId);

      return res.status(200).json({
        success: true,
        message: "Duplicate webhook ignored",
      });
    }

    // 6. Update payment based on event
    if (event.event === "payment.failed") {
      payment.razorpayPaymentId = razorpayPaymentId;

      payment.status = "FAILED";

      payment.failureReason =
        paymentEntity.error_reason ||
        paymentEntity.error_description ||
        "Payment failed";

      payment.failureCode =
        paymentEntity.error_code || null;

      payment.paymentMethod =
        paymentEntity.method || null;

      payment.retryCount =
        (payment.retryCount || 0) + 1;
    }

    if (event.event === "payment.authorized") {
      payment.razorpayPaymentId = razorpayPaymentId;

      payment.status = "AUTHORIZED";

      payment.paymentMethod =
        paymentEntity.method || null;
    }



     // ----------------------------------------
  // Mark existing Revive recovery case
   // as RECOVERED
  // ----------------------------------------

  

  if (event.event === "payment.captured") {
  payment.razorpayPaymentId = razorpayPaymentId;

  payment.status = "CAPTURED";

  payment.paymentMethod =
    paymentEntity.method || null;

  payment.failureReason = null;
  payment.failureCode = null;

  // ----------------------------------------------------
  // AUTOMATIC RECOVERY SUCCESS
  // ----------------------------------------------------

  const recoveryCase = await RecoveryCase.findOne({
    payment: payment._id,
  });

  if (recoveryCase) {
    // Only recover an actually active/promised case
    if (
      recoveryCase.status === "PROMISED" ||
      recoveryCase.promiseToPay?.status === "PROMISED" ||
      recoveryCase.status === "OPEN" ||
      recoveryCase.status === "IN_PROGRESS"
    ) {
      recoveryCase.status = "RECOVERED";

      recoveryCase.resolvedAt = new Date();

      recoveryCase.lastAction = "RECOVERY_SUCCEEDED";

      recoveryCase.stoppingRuleTriggered = false;
      recoveryCase.stoppingReason = null;

      // ------------------------------------------------
      // Fulfill Promise-To-Pay automatically
      // ------------------------------------------------

      if (recoveryCase.promiseToPay?.promised) {
        recoveryCase.promiseToPay.status = "FULFILLED";
        recoveryCase.promiseToPay.fulfilledAt = new Date();
      }

      await recoveryCase.save();

      console.log(
        "Recovery case automatically marked as RECOVERED:",
        recoveryCase._id
      );

      // ------------------------------------------------
      // Update Customer Memory
      // ------------------------------------------------

      if (recoveryCase.customerPhone) {
        const memory = await CustomerMemory.findOne({
          customerPhone: recoveryCase.customerPhone,
        });

        if (memory) {
          memory.successfulPayments =
            (memory.successfulPayments || 0) + 1;

          memory.recoveredCases =
            (memory.recoveredCases || 0) + 1;

          if (
            recoveryCase.promiseToPay?.status ===
            "FULFILLED"
          ) {
            memory.promisesFulfilled =
              (memory.promisesFulfilled || 0) + 1;
          }

          memory.lastInteractionAt = new Date();

          await memory.save();

          console.log(
            "Customer memory updated:",
            memory.customerPhone
          );
        }
      }

      // ------------------------------------------------
      // Audit: Recovery succeeded
      // ------------------------------------------------

      await AuditLog.create({
        recoveryCase: recoveryCase._id,

        eventType: "RECOVERY_SUCCEEDED",

        actor: "SYSTEM",

        action:
          "Payment successfully captured and recovery case resolved automatically.",

        reasoning:
          "Razorpay confirmed successful payment capture.",

        metadata: {
          razorpayPaymentId,
          razorpayOrderId,
          amount: payment.amount,
          currency: payment.currency,
        },
      });

      // ------------------------------------------------
      // Audit: Promise fulfilled
      // ------------------------------------------------

      if (recoveryCase.promiseToPay?.status === "FULFILLED") {
        await AuditLog.create({
          recoveryCase: recoveryCase._id,

          eventType: "PROMISE_FULFILLED",

          actor: "SYSTEM",

          action:
            "Customer promise automatically fulfilled after successful payment capture.",

          reasoning:
            "Razorpay payment.captured event confirmed that the promised payment was completed.",

          metadata: {
            promisedAmount:
              recoveryCase.promiseToPay.promisedAmount,

            promisedDate:
              recoveryCase.promiseToPay.promisedDate,

            fulfilledAt:
              recoveryCase.promiseToPay.fulfilledAt,

            razorpayPaymentId,
            razorpayOrderId,
          },
        });
      }
    }
  }
}

    // 7. Store processed event ID
    if (eventId) {
      payment.webhookEventIds.push(eventId);
    }

    await payment.save();

    console.log("Payment updated successfully");
    console.log("Payment ID:", razorpayPaymentId);
    console.log("Order ID:", razorpayOrderId);
    console.log("Status:", payment.status);


   let recoveryResult = null;

if (event.event === "payment.failed") {
  recoveryResult = await processFailedPayment(payment);

  console.log("Revive recovery case processed");

  if (recoveryResult?.decision) {
    console.log(
      "Revive Decision:",
      recoveryResult.decision.action
    );

    // ---------------------------------------------
    // AUTOMATIC CUSTOMER COMMUNICATION
    // ---------------------------------------------

    const recoveryCaseId =
      recoveryResult?.recoveryCase?._id;

    if (recoveryCaseId) {
      const action = recoveryResult.decision.action;

      // Only communicate when automated customer
      // recovery is appropriate.
      if (
        action === "PROMISE_TO_PAY" ||
        action === "RETRY_PAYMENT"
      ) {
        const communicationResult =
          await sendRecoveryCommunication(
            recoveryCaseId.toString()
          );

        console.log(
          "Revive Communication:",
          communicationResult
        );
      }
    }
  }
}

    

    return res.status(200).json({
  success: true,
  message: "Webhook processed successfully",
  event: event.event,
  paymentId: razorpayPaymentId,
  orderId: razorpayOrderId,
  status: payment.status,

  recovery: recoveryResult
    ? {
        created: recoveryResult.created,
        caseId: recoveryResult.recoveryCase?._id,
        action: recoveryResult.decision?.action,
        confidence: recoveryResult.decision?.confidence,
      }
    : null,
});

  } catch (error) {
    console.error("========== WEBHOOK ERROR ==========");
    console.error("Message:", error.message);
    console.error("===================================");

    return res.status(400).json({
      success: false,
      message: error.message || "Webhook processing failed",
    });
  }
};

module.exports = {
  handleRazorpayWebhook,
};