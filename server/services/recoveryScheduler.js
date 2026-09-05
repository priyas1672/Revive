
const RecoveryCase = require("../models/RecoveryCase");
const CustomerMemory = require("../models/CustomerMemory");
const AuditLog = require("../models/AuditLog");

const {
  createRetryPaymentLink,
} = require("./recoveryService");

const {
  decideRecoveryAction,
} = require("./recoveryEngine");

const {
  shouldRetryNow,
} = require("./gatewayHealthService");

const {
  sendRecoveryCommunication,
} = require("./communicationService");

// ============================================================
// PROCESS AUTOMATIC RETRY
// ============================================================

const processRecoveryRetry = async () => {
  try {
    const now = new Date();

    const retryCases = await RecoveryCase.find({
      status: "IN_PROGRESS",
      lastAction: {
            $in: [
                "AUTOMATIC_RETRY_SCHEDULED",
                "RETRY_POSTPONED_GATEWAY_DOWN",
            ],
      },
      nextActionAt: { $lte: now },
      retryCount: { $lt: 3 },
    });

    for (const recoveryCase of retryCases) {
      try {
        console.log(
          "Processing automatic retry:",
          recoveryCase._id.toString()
        );

        // ------------------------------------------------------
        // Gateway health check
        // ------------------------------------------------------

        const gatewayCheck = await shouldRetryNow();

        if (!gatewayCheck.retryNow) {
          const nextRetry = new Date(
            now.getTime() + 30 * 60 * 1000
          );

          recoveryCase.status = "IN_PROGRESS";

          // Actual retry nahi hui, isliye count increase nahi hoga
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

          console.log(
            "Gateway unhealthy → Retry postponed:",
            recoveryCase._id.toString()
          );

          continue;
        }

        // ------------------------------------------------------
        // Create controlled Razorpay retry payment link
        // ------------------------------------------------------

        const paymentLink =
          await createRetryPaymentLink(recoveryCase);


            // Actual retry attempt happened successfully
               recoveryCase.retryCount =
               (recoveryCase.retryCount || 0) + 1;

        // ------------------------------------------------------
        // Update retry information
        // ------------------------------------------------------

        recoveryCase.lastAction =
          "RETRY_PAYMENT_LINK_CREATED";

        recoveryCase.nextActionAt = null;

        recoveryCase.retryPaymentLinkId =
          paymentLink.id;

        recoveryCase.retryPaymentLink =
          paymentLink.short_url;

        recoveryCase.retryAttemptedAt = now;

        await recoveryCase.save();

        // ------------------------------------------------------
        // Audit retry
        // ------------------------------------------------------

        await AuditLog.create({
          recoveryCase:
            recoveryCase._id,

          eventType:
            "RETRY_SCHEDULED",

          actor:
            "REVIVE_AGENT",

          action:
            "Retry payment link created.",

          reasoning:
            "Revive created a controlled payment link for the failed payment.",

          metadata: {
            retryCount:
              recoveryCase.retryCount,

            paymentLinkId:
              paymentLink.id,

            paymentLink:
              paymentLink.short_url,

            attemptedAt:
              now,
          },
        });

        console.log(
          "Retry payment link created:",
          paymentLink.short_url
        );

      } catch (error) {
        console.error(
          "Retry payment link creation failed:",
          error
        );

        // ------------------------------------------------------
        // Retry link failure → human escalation
        // ------------------------------------------------------

        recoveryCase.status =
          "ESCALATED";

        recoveryCase.stoppingRuleTriggered =
          true;

        recoveryCase.stoppingReason =
          "Retry payment link could not be created.";

        recoveryCase.lastAction =
          "RETRY_LINK_CREATION_FAILED";

        recoveryCase.nextActionAt =
          null;

        await recoveryCase.save();

        await AuditLog.create({
          recoveryCase:
            recoveryCase._id,

          eventType:
            "ESCALATED",

          actor:
            "SYSTEM",

          action:
            "Retry payment link creation failed.",

          reasoning:
            error.message,

          metadata: {
            retryCount:
              recoveryCase.retryCount,
          },
        });
      }
    }

  } catch (error) {
    console.error(
      "Recovery retry error:",
      error
    );
  }
};

// ============================================================
// PROCESS RECOVERY CASES
// ============================================================

const processRecoveryCases = async () => {

  try {

    // --------------------------------------------------------
    // Process scheduled automatic retries
    // --------------------------------------------------------

    await processRecoveryRetry();

    const now = new Date();

    // ========================================================
    // 1. CHECK PROMISES WHOSE DEADLINE HAS ARRIVED
    // ========================================================

    const dueCases =
      await RecoveryCase.find({
        status:
          "PROMISED",

        "promiseToPay.status":
          "PROMISED",

        "promiseToPay.promisedDate": {
          $lte:
            now,
        },
      });

    for (
      const recoveryCase
      of dueCases
    ) {

      console.log(
        "Checking promise:",
        recoveryCase._id.toString()
      );

      // ------------------------------------------------------
      // Safety check
      // ------------------------------------------------------

      if (
        recoveryCase.status ===
        "RECOVERED"
      ) {
        continue;
      }

      // ------------------------------------------------------
      // Mark promise as broken
      // ------------------------------------------------------

      recoveryCase.promiseToPay.status =
        "BROKEN";

      recoveryCase.lastAction =
        "PROMISE_BROKEN";

      // ------------------------------------------------------
      // Update customer memory
      // ------------------------------------------------------

      if (
        recoveryCase.customerPhone
      ) {

        const memory =
          await CustomerMemory.findOne({
            customerPhone:
              recoveryCase.customerPhone,
          });

        if (memory) {

          memory.promisesBroken =
            (memory.promisesBroken || 0) + 1;

          memory.lastInteractionAt =
            now;

          const made =
            memory.promisesMade || 0;

          const fulfilled =
            memory.promisesFulfilled || 0;

          const broken =
            memory.promisesBroken || 0;

          if (made > 0) {

            memory.reliabilityScore =
              Math.max(
                0,
                Math.min(
                  1,
                  (fulfilled + 0.5) /
                    made -
                    broken * 0.1
                )
              );
          }

          await memory.save();
        }
      }

      // ------------------------------------------------------
      // Ask Recovery Engine
      // ------------------------------------------------------

      const decision =
        decideRecoveryAction({
          failureCode:
            recoveryCase.failureCode,

          failureReason:
            recoveryCase.failureReason,

          retryCount:
            recoveryCase.retryCount || 0,
        });

      // ------------------------------------------------------
      // Save new decision
      // ------------------------------------------------------

      recoveryCase.decision =
        decision;

      // ======================================================
      // RETRY PAYMENT
      // ======================================================

      if (
        decision.action ===
        "RETRY_PAYMENT"
      ) {

        // ----------------------------------------------
        // Maximum retry protection
        // ----------------------------------------------

        if (
          (recoveryCase.retryCount || 0) >= 3
        ) {

          recoveryCase.status =
            "ESCALATED";

          recoveryCase.stoppingRuleTriggered =
            true;

          recoveryCase.stoppingReason =
            "Maximum automatic payment retry limit reached.";

          recoveryCase.lastAction =
            "ESCALATED_AFTER_MAX_RETRIES";

          recoveryCase.nextActionAt =
            null;

          await recoveryCase.save();

          await AuditLog.create({
            recoveryCase:
              recoveryCase._id,

            eventType:
              "STOPPING_RULE_TRIGGERED",

            actor:
              "REVIVE_AGENT",

            action:
              "Maximum retry limit reached. Case escalated to human support.",

            reasoning:
              "Revive does not allow more than three automated payment recovery attempts.",

            metadata: {
              retryCount:
                recoveryCase.retryCount,

              maxRetries:
                3,
            },
          });

          console.log(
            "Retry limit reached → Human escalation:",
            recoveryCase._id.toString()
          );

        } else {

          recoveryCase.status =
            "IN_PROGRESS";

          // recoveryCase.retryCount =
          //   (recoveryCase.retryCount || 0) + 1;

          recoveryCase.lastAction =
            "AUTOMATIC_RETRY_SCHEDULED";

          recoveryCase.nextActionAt =
            new Date(
              now.getTime() +
              30 * 60 * 1000
            );

          await recoveryCase.save();

          await AuditLog.create({
            recoveryCase:
              recoveryCase._id,

            eventType:
              "RETRY_SCHEDULED",

            actor:
              "REVIVE_AGENT",

            action:
              "Automatic payment retry scheduled.",

            reasoning:
              decision.reasoning,

            metadata: {
              retryCount:
                recoveryCase.retryCount,

              nextActionAt:
                recoveryCase.nextActionAt,

              confidence:
                decision.confidence,
            },
          });

          console.log(
            "Promise broken → Retry scheduled:",
            recoveryCase._id.toString()
          );
        }
      }

      // ======================================================
      // PROMISE TO PAY AGAIN
      // ======================================================

      else if (
        decision.action ===
        "PROMISE_TO_PAY"
      ) {

        recoveryCase.status =
          "OPEN";

        recoveryCase.recoveryChannel =
          recoveryCase.recoveryChannel ||
          "WHATSAPP";

        recoveryCase.lastAction =
          "PROMISE_REOPENED";

        recoveryCase.nextActionAt =
          null;

        recoveryCase.promiseToPay.status =
          "REQUESTED";

        recoveryCase.promiseToPay.promised =
          false;

        recoveryCase.promiseToPay.promisedAmount =
          recoveryCase.amount;

        recoveryCase.promiseToPay.promisedDate =
          null;

        recoveryCase.promiseToPay.customerMessage =
          null;

        await recoveryCase.save();

        await AuditLog.create({
          recoveryCase:
            recoveryCase._id,

          eventType:
            "PROMISE_REOPENED",

          actor:
            "REVIVE_AGENT",

          action:
            "Promise-to-Pay reopened.",

          reasoning:
            decision.reasoning,

          metadata: {
            confidence:
              decision.confidence,

            nextAction:
              decision.nextAction,

            retryCount:
              recoveryCase.retryCount,

            channel:
              recoveryCase.recoveryChannel,
          },
        });

        console.log(
          "Promise broken → Promise reopened:",
          recoveryCase._id.toString()
        );
      }

      // ======================================================
      // HUMAN ESCALATION
      // ======================================================

      else if (
        decision.action ===
        "ESCALATE_HUMAN"
      ) {

        recoveryCase.status =
          "ESCALATED";

        recoveryCase.stoppingRuleTriggered =
          true;

        recoveryCase.stoppingReason =
          "Automated recovery stopped and case was escalated to human support.";

        recoveryCase.recoveryChannel =
          "HUMAN";

        recoveryCase.lastAction =
          "ESCALATED_AFTER_BROKEN_PROMISE";

        recoveryCase.nextActionAt =
          null;

        await recoveryCase.save();

        await AuditLog.create({
          recoveryCase:
            recoveryCase._id,

          eventType:
            "STOPPING_RULE_TRIGGERED",

          actor:
            "REVIVE_AGENT",

          action:
            "Automated recovery stopped and human escalation triggered.",

          reasoning:
            decision.reasoning,

          metadata: {
            confidence:
              decision.confidence,

            retryCount:
              recoveryCase.retryCount,

            nextAction:
              decision.nextAction,
          },
        });

        console.log(
          "Promise broken → Human escalation:",
          recoveryCase._id.toString()
        );
      }

      // ======================================================
      // STOP
      // ======================================================

      else {

        recoveryCase.status =
          "STOPPED";

        recoveryCase.stoppingRuleTriggered =
          true;

        recoveryCase.stoppingReason =
          "Recovery engine decided to stop automated recovery.";

        recoveryCase.lastAction =
          "RECOVERY_STOPPED";

        recoveryCase.nextActionAt =
          null;

        await recoveryCase.save();

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
            decision.reasoning,

          metadata: {
            confidence:
              decision.confidence,

            retryCount:
              recoveryCase.retryCount,
          },
        });
      }

      // ------------------------------------------------------
      // Common Promise Broken Audit
      // ------------------------------------------------------

      await AuditLog.create({
        recoveryCase:
          recoveryCase._id,

        eventType:
          "PROMISE_BROKEN",

        actor:
          "SYSTEM",

        action:
          `Customer promise deadline passed. Revive selected ${decision.action}.`,

        reasoning:
          decision.reasoning,

        metadata: {
          promisedAmount:
            recoveryCase.promiseToPay
              .promisedAmount,

          promisedDate:
            recoveryCase.promiseToPay
              .promisedDate,

          newAction:
            decision.action,

          confidence:
            decision.confidence,

          retryCount:
            recoveryCase.retryCount,
        },
      });

      console.log(
        "Promise marked BROKEN:",
        recoveryCase._id.toString()
      );
    }

    // ========================================================
    // 2. SCHEDULED RETRIES
    // ========================================================

    // Scheduled retries are handled by
    // processRecoveryRetry() above.

    // ========================================================
    // 3. PROMISE REMINDERS
    // ========================================================

    const reminderStart =
      new Date(
        now.getTime() +
        23 * 60 * 60 * 1000
      );

    const reminderEnd =
      new Date(
        now.getTime() +
        25 * 60 * 60 * 1000
      );

    const reminderCases =
      await RecoveryCase.find({
        status:
          "PROMISED",

        "promiseToPay.status":
          "PROMISED",

        "promiseToPay.promisedDate": {
          $gte:
            reminderStart,

          $lte:
            reminderEnd,
        },

        lastAction: {
          $ne:
            "PROMISE_REMINDER_SENT",
        },
      });

    // ------------------------------------------------------
    // Send automatic Promise-to-Pay reminder
    // ------------------------------------------------------

    for (const recoveryCase of reminderCases) {

      try {

        console.log(
          "Sending promise reminder:",
          recoveryCase._id.toString()
        );

        const channel =
          recoveryCase.recoveryChannel ||
          "WHATSAPP";

        const promisedAmount =
          recoveryCase.promiseToPay.promisedAmount ||
          recoveryCase.amount;

        const promisedDate =
          recoveryCase.promiseToPay.promisedDate;

        const reminderMessage =
          `Hi ${
            recoveryCase.customerName ||
            "there"
          }, yeh ek friendly reminder hai. ` +
          `Aapne ₹${promisedAmount} payment ` +
          `${new Date(
            promisedDate
          ).toLocaleDateString(
            "en-IN"
          )} tak complete karne ka Promise-to-Pay kiya tha. ` +
          `Agar payment mein koi issue aa raha hai, ` +
          `humein bata sakte hain. 🙏`;

        // --------------------------------------------------
        // ACTUAL COMMUNICATION
        // --------------------------------------------------

        await sendRecoveryCommunication({
          recoveryCase,
          channel,
          message:
            reminderMessage,
        });

        // --------------------------------------------------
        // UPDATE CASE
        // --------------------------------------------------

        recoveryCase.lastAction =
          "PROMISE_REMINDER_SENT";

        await recoveryCase.save();

        // --------------------------------------------------
        // AUDIT
        // --------------------------------------------------

        await AuditLog.create({
          recoveryCase:
            recoveryCase._id,

          eventType:
            "PROMISE_REMINDER",

          actor:
            "SYSTEM",

          action:
            "Automatic Promise-to-Pay reminder sent.",

          reasoning:
            "Customer payment commitment is approaching its promised date.",

          metadata: {
            channel,
            promisedAmount,
            promisedDate,
            message:
              reminderMessage,
          },
        });

        console.log(
          "Promise reminder sent successfully:",
          recoveryCase._id.toString()
        );

      } catch (error) {

        console.error(
          "Promise reminder failed:",
          error.message
        );
      }
    }

    // ========================================================
    // COMPLETE
    // ========================================================

    console.log(
      "Recovery scheduler completed:",
      now.toISOString()
    );

  } catch (error) {

    console.error(
      "Recovery scheduler error:",
      error
    );
  }
};

// ============================================================
// START SCHEDULER
// ============================================================

const startRecoveryScheduler = () => {

  console.log(
    "Revive Recovery Scheduler started"
  );

  // Run immediately

  processRecoveryCases();


  // Run every minute

  setInterval(
    processRecoveryCases,
    60 * 1000
  );
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {

  startRecoveryScheduler,

  processRecoveryCases,

  processRecoveryRetry,
};