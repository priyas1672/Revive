const RecoveryCase = require("../models/RecoveryCase");
const {
  processCustomerMessage,
} = require("./conversationService");

/**
 * =========================================================
 * AI VOICE AGENT
 * =========================================================
 *
 * Voice layer ka kaam:
 *
 * Customer Speech
 *      ↓
 * Speech-to-Text transcript
 *      ↓
 * processCustomerMessage()
 *      ↓
 * AI intent + response
 *      ↓
 * Voice layer ko response
 *
 * Twilio baad mein is service ko real phone call
 * ke saath connect karega.
 */

/**
 * Start a voice recovery conversation
 */
const startVoiceAgent = async ({
  recoveryCaseId,
  channel = "VOICE",
}) => {
  const recoveryCase = await RecoveryCase.findById(
    recoveryCaseId
  );

  if (!recoveryCase) {
    throw new Error("Recovery case not found");
  }

  // Do not start voice recovery for closed cases
  if (recoveryCase.status === "RECOVERED") {
    return {
      success: false,
      stopped: true,
      reason:
        "Customer payment has already been recovered.",
    };
  }

  if (
    recoveryCase.status === "STOPPED" ||
    recoveryCase.stoppingRuleTriggered === true ||
    recoveryCase.optedOut === true
  ) {
    return {
      success: false,
      stopped: true,
      reason:
        recoveryCase.stoppingReason ||
        "Automated recovery has been stopped.",
    };
  }

  return {
    success: true,
    channel,
    recoveryCaseId: recoveryCase._id,
    customerName: recoveryCase.customerName,
    customerPhone: recoveryCase.customerPhone,
    amount: recoveryCase.amount,
    message:
      `Namaste ${recoveryCase.customerName || "ji"}, ` +
      `main Revive se payment recovery ke regarding ` +
      `aapse baat kar raha hoon. ` +
      `Kya abhi baat karna convenient hai?`,
  };
};

/**
 * =========================================================
 * PROCESS CUSTOMER VOICE RESPONSE
 * =========================================================
 *
 * IMPORTANT:
 * voiceTranscript = customer ne call par jo bola
 *
 * Example:
 * "Main kal payment kar dungi."
 *
 * Is transcript ko existing AI conversation engine
 * process karega.
 */
const processVoiceTranscript = async ({
  recoveryCaseId,
  voiceTranscript,
}) => {
  if (!recoveryCaseId) {
    throw new Error("recoveryCaseId is required");
  }

  if (!voiceTranscript) {
    throw new Error("voiceTranscript is required");
  }

  const recoveryCase = await RecoveryCase.findById(
    recoveryCaseId
  );

  if (!recoveryCase) {
    throw new Error("Recovery case not found");
  }

  // Closed / stopped cases must not continue
  if (
    recoveryCase.status === "RECOVERED" ||
    recoveryCase.status === "STOPPED" ||
    recoveryCase.stoppingRuleTriggered === true ||
    recoveryCase.optedOut === true
  ) {
    return {
      success: false,
      stopped: true,
      reason:
        recoveryCase.stoppingReason ||
        "Voice recovery conversation has been stopped.",
    };
  }

  /**
   * Existing conversationService already handles:
   *
   * - AI intent detection
   * - Promise-to-Pay detection
   * - date extraction
   * - customer memory
   * - conversation memory
   * - opt-out
   * - audit
   *
   * So voice agent duplicate AI logic nahi banayega.
   */
  const result = await processCustomerMessage({
    recoveryCaseId,
    customerMessage: voiceTranscript,
    channel: "VOICE",
  });

  return {
    success: true,
    channel: "VOICE",
    recoveryCaseId,
    customerTranscript: voiceTranscript,
    aiResponse: result,
  };
};

module.exports = {
  startVoiceAgent,
  processVoiceTranscript,
};