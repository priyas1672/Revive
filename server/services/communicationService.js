

const { Resend } = require("resend");
const twilio = require("twilio");

const RecoveryCase = require("../models/RecoveryCase");
const CustomerMemory = require("../models/CustomerMemory");

const { createAuditLog } = require("./auditService");


// =========================================================
// EXTERNAL SERVICES
// =========================================================

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN
    ? twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
    : null;


// =========================================================
// GUARDRAILS
// =========================================================

const MAX_COMMUNICATION_ATTEMPTS = 3;

const canCommunicate = (recoveryCase) => {
  if (!recoveryCase) {
    return {
      allowed: false,
      reason: "Recovery case not found",
    };
  }

  // Already recovered
  if (recoveryCase.status === "RECOVERED") {
    return {
      allowed: false,
      reason: "Customer payment has already been recovered",
    };
  }

  // Manually escalated
  if (recoveryCase.status === "ESCALATED") {
    return {
      allowed: false,
      reason: "Case has been escalated to human support",
    };
  }

  // Explicitly stopped
  if (
    recoveryCase.status === "STOPPED" ||
    recoveryCase.stoppingRuleTriggered === true
  ) {
    return {
      allowed: false,
      reason:
        recoveryCase.stoppingReason ||
        "Automated recovery has been stopped",
    };
  }

  // Maximum communication attempts
  if (
    (recoveryCase.communicationAttemptCount || 0) >=
    MAX_COMMUNICATION_ATTEMPTS
  ) {
    return {
      allowed: false,
      reason:
        "Maximum automated communication attempts reached",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
};


// =========================================================
// CUSTOMER MEMORY
// =========================================================

const getCustomerCommunicationProfile = async (recoveryCase) => {
  if (!recoveryCase.customerPhone) {
    return {
      preferredChannel:
        recoveryCase.recoveryChannel || "EMAIL",
      preferredLanguage: "HINGLISH",
      preferredTone: "FRIENDLY",
      reliabilityScore: 0.5,
      importantNotes: [],
    };
  }

  const memory = await CustomerMemory.findOne({
    customerPhone: recoveryCase.customerPhone,
  });

  if (!memory) {
    return {
      preferredChannel:
        recoveryCase.recoveryChannel || "WHATSAPP",
      preferredLanguage: "HINGLISH",
      preferredTone: "FRIENDLY",
      reliabilityScore: 0.5,
      importantNotes: [],
    };
  }

  return {
    preferredChannel:
      memory.preferredChannel ||
      recoveryCase.recoveryChannel ||
      "WHATSAPP",

    preferredLanguage:
      memory.preferredLanguage || "HINGLISH",

    preferredTone:
      memory.preferredTone || "FRIENDLY",

    reliabilityScore:
      memory.reliabilityScore ?? 0.5,

    importantNotes:
      memory.importantNotes || [],
  };
};


// =========================================================
// MESSAGE GENERATOR
// =========================================================

const generateRecoveryMessage = ({
  customerName,
  amount,
  reason,
  language = "HINGLISH",
  tone = "FRIENDLY",
}) => {
  const name = customerName || "Customer";

  const formattedAmount =
    `₹${Number(amount || 0).toLocaleString("en-IN")}`;


  // -------------------------
  // HINGLISH
  // -------------------------

  if (language === "HINGLISH") {

    if (tone === "DIRECT") {
      return `Hi ${name}, aapka ${formattedAmount} ka payment complete nahi ho paya. Reason: ${
        reason || "payment issue"
      }. Agar ab payment karna convenient hai, please payment complete karein.`;
    }

    if (tone === "FORMAL") {
      return `Namaste ${name}, aapka ${formattedAmount} ka payment complete nahi ho saka. ${
        reason || "Payment process mein issue aaya."
      } Aap apni convenience ke according payment complete kar sakte hain.`;
    }

    return `Hi ${name} 👋, aapka ${formattedAmount} ka payment complete nahi ho paya. ${
      reason || "Payment process mein temporary issue aaya."
    } Agar ab convenient hai toh aap payment complete kar sakte hain. Agar aapko thoda time chahiye, toh hum aapke convenient date par payment arrange kar sakte hain. 😊`;
  }


  // -------------------------
  // HINDI
  // -------------------------

  if (language === "HINDI") {
    return `नमस्ते ${name}, आपका ${formattedAmount} का भुगतान पूरा नहीं हो पाया। ${
      reason || "भुगतान प्रक्रिया में समस्या आई।"
    } आप अपनी सुविधा के अनुसार भुगतान पूरा कर सकते हैं।`;
  }


  // -------------------------
  // ENGLISH
  // -------------------------

  return `Hi ${name}, your payment of ${formattedAmount} could not be completed. ${
    reason || "There was an issue while processing your payment."
  } Please complete the payment when convenient.`;
};


// =========================================================
// AUDIT COMMUNICATION
// =========================================================

const auditCommunication = async ({
  recoveryCase,
  channel,
  message,
  profile,
  simulation = false,
}) => {

  await createAuditLog({
    recoveryCase: recoveryCase._id,
    eventType: "RECOVERY_MESSAGE_SENT",
    actor: "REVIVE_AGENT",
    action: `Recovery message sent via ${channel}`,
    reasoning:
      "Revive selected the communication channel using customer memory and recovery preferences.",
    metadata: {
      channel,
      language: profile.preferredLanguage,
      tone: profile.preferredTone,
      reliabilityScore: profile.reliabilityScore,
      simulation,
      message,
    },
  });
};


// =========================================================
// UPDATE COMMUNICATION ATTEMPT
// =========================================================

const incrementCommunicationAttempt = async (
  recoveryCase
) => {

  recoveryCase.communicationAttemptCount =
    (recoveryCase.communicationAttemptCount || 0) + 1;

  recoveryCase.lastCommunicationAt = new Date();

  await recoveryCase.save();
};


// =========================================================
// EMAIL
// =========================================================

const sendRecoveryEmail = async ({
  to,
  customerName,
  amount,
  reason,
  recoveryCase,
  profile,
  customMessage = null,
}) => {

  if (!to) {
    return {
      success: false,
      error: "Customer email is required",
    };
  }


  const message =
    customMessage ||
    generateRecoveryMessage({
      customerName,
      amount,
      reason,
      language: profile.preferredLanguage,
      tone: profile.preferredTone,
    });


  // Demo / simulation mode
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !resend
  ) {

    await auditCommunication({
      recoveryCase,
      channel: "EMAIL",
      message,
      profile,
      simulation: true,
    });

    return {
      success: true,
      simulated: true,
      channel: "EMAIL",
      recipient: to,
      message,
    };
  }


  try {

    const { data, error } =
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject: "Payment Recovery Reminder",

        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Payment Recovery Reminder</h2>

            <p>${message}</p>

            <p>
              If you need any assistance, please let us know.
            </p>

            <p>
              Thank you,<br/>
              Revive Team
            </p>
          </div>
        `,
      });


    if (error) {
      return {
        success: false,
        error,
      };
    }


    await auditCommunication({
      recoveryCase,
      channel: "EMAIL",
      message,
      profile,
      simulation: false,
    });


    return {
      success: true,
      channel: "EMAIL",
      messageId: data?.id,
      recipient: to,
      message,
    };

  } catch (error) {

    return {
      success: false,
      error: error.message,
    };
  }
};


// =========================================================
// WHATSAPP
// =========================================================

const sendWhatsAppRecovery = async ({
  phone,
  customerName,
  amount,
  reason,
  recoveryCase,
  profile,
  customMessage = null,
}) => {

  if (!phone) {
    return {
      success: false,
      error: "Customer phone number is required",
    };
  }


  const message =
    customMessage ||
    generateRecoveryMessage({
      customerName,
      amount,
      reason,
      language: profile.preferredLanguage,
      tone: profile.preferredTone,
    });


  // -----------------------------------------
  // Simulation mode
  // -----------------------------------------

  if (
    !twilioClient ||
    !process.env.TWILIO_WHATSAPP_FROM
  ) {

    await auditCommunication({
      recoveryCase,
      channel: "WHATSAPP",
      message,
      profile,
      simulation: true,
    });

    return {
      success: true,
      simulated: true,
      channel: "WHATSAPP",
      recipient: phone,
      message,
    };
  }


  // -----------------------------------------
  // Real WhatsApp message through Twilio
  // -----------------------------------------

  try {

    const result =
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${phone}`,
        body: message,
      });


    await auditCommunication({
      recoveryCase,
      channel: "WHATSAPP",
      message,
      profile,
      simulation: false,
    });


    return {
      success: true,
      channel: "WHATSAPP",
      messageId: result.sid,
      recipient: phone,
      message,
    };

  } catch (error) {

    return {
      success: false,
      error: error.message,
    };
  }
};


// =========================================================
// MAIN COMMUNICATION FUNCTION
// =========================================================

const sendRecoveryCommunication = async (
  recoveryCaseId,
  requestedChannel = null
) => {

  try {

    // -----------------------------------------
    // Find recovery case
    // -----------------------------------------

    const recoveryCase =
      await RecoveryCase.findById(
        recoveryCaseId
      );


    if (!recoveryCase) {
      return {
        success: false,
        error: "Recovery case not found",
      };
    }


    // -----------------------------------------
    // Guardrails
    // -----------------------------------------

    const guard =
      canCommunicate(recoveryCase);


    if (!guard.allowed) {
      return {
        success: false,
        error: guard.reason,
      };
    }


    // -----------------------------------------
    // Customer profile
    // -----------------------------------------

    const profile =
      await getCustomerCommunicationProfile(
        recoveryCase
      );


    // -----------------------------------------
    // Decide channel
    // -----------------------------------------

    const channel = (
      requestedChannel ||
      profile.preferredChannel ||
      recoveryCase.recoveryChannel ||
      "EMAIL"
    ).toUpperCase();


    // -----------------------------------------
    // Common data
    // -----------------------------------------

    const customerName =
      recoveryCase.customerName ||
      recoveryCase.name ||
      "Customer";

    const amount =
      recoveryCase.amount ||
      recoveryCase.paymentAmount ||
      0;

    const reason =
      recoveryCase.reason ||
      recoveryCase.failureReason ||
      "Payment could not be completed";


    // -----------------------------------------
    // EMAIL
    // -----------------------------------------

    let result;

    if (channel === "EMAIL") {

      result =
        await sendRecoveryEmail({
          to: recoveryCase.customerEmail,
          customerName,
          amount,
          reason,
          recoveryCase,
          profile,
        });

    }


    // -----------------------------------------
    // WHATSAPP
    // -----------------------------------------

    else if (
      channel === "WHATSAPP" ||
      channel === "SMS"
    ) {

      result =
        await sendWhatsAppRecovery({
          phone: recoveryCase.customerPhone,
          customerName,
          amount,
          reason,
          recoveryCase,
          profile,
        });

    }


    // -----------------------------------------
    // Unsupported channel
    // -----------------------------------------

    else {

      return {
        success: false,
        error: `Unsupported communication channel: ${channel}`,
      };
    }


    // -----------------------------------------
    // Count attempt only after success
    // -----------------------------------------

    if (result.success) {
      await incrementCommunicationAttempt(
        recoveryCase
      );
    }


    return result;

  } catch (error) {

    console.error(
      "sendRecoveryCommunication error:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
};


// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  canCommunicate,
  getCustomerCommunicationProfile,
  generateRecoveryMessage,
  sendRecoveryEmail,
  sendWhatsAppRecovery,
  sendRecoveryCommunication,
};