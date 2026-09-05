const decideRecoveryAction = ({
  failureCode,
  failureReason,
  retryCount = 0,
}) => {
  const code = String(failureCode || "").toUpperCase();
  const reason = String(failureReason || "").toLowerCase();

  /*
   * REVIVE POLICY
   *
   * Money-moving actions must be bounded.
   * The engine returns a decision + explanation.
   */

  // 1. Too many attempts → stop automated recovery
  if (retryCount >= 3) {
    return {
      action: "ESCALATE_HUMAN",
      confidence: 0.98,
      reasoning:
        "Payment has already failed multiple times. Revive stopped further automated retries and escalated the case to a human.",
      nextAction:
        "Escalate to human support for manual recovery.",
    };
  }

  // 2. Temporary/network failures → retry
  const temporaryFailure =
    code.includes("TIMEOUT") ||
    code.includes("GATEWAY") ||
    reason.includes("timeout") ||
    reason.includes("network") ||
    reason.includes("temporar");

  if (temporaryFailure) {
    return {
      action: "RETRY_PAYMENT",
      confidence: 0.91,
      reasoning:
        "The failure appears temporary or infrastructure-related. Revive will attempt a bounded retry instead of repeatedly contacting the customer.",
      nextAction:
        "Schedule one controlled payment retry.",
    };
  }

  // 3. Insufficient funds → Promise-to-Pay
  const insufficientFunds =
    code.includes("INSUFFICIENT") ||
    reason.includes("insufficient") ||
    reason.includes("balance");

  if (insufficientFunds) {
    return {
      action: "PROMISE_TO_PAY",
      confidence: 0.94,
      reasoning:
        "The payment appears to have failed because sufficient funds were unavailable. Revive should ask the customer for a suitable payment date instead of repeatedly retrying.",
      nextAction:
        "Start Hinglish recovery conversation and offer Promise-to-Pay.",
    };
  }

  // 4. Unknown failure → human review
  return {
    action: "ESCALATE_HUMAN",
    confidence: 0.72,
    reasoning:
      "The failure reason is not confidently understood by Revive's current recovery policy. The system will not guess when money movement is involved.",
    nextAction:
      "Escalate the case to human support.",
  };
};

module.exports = {
  decideRecoveryAction,
};