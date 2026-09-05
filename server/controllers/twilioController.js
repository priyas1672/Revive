const twilio = require("twilio");

const RecoveryCase = require("../models/RecoveryCase");
const {
  processCustomerMessage,
} = require("../services/conversationService");

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN
    ? twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
    : null;

const receiveWhatsAppMessage = async (req, res) => {
  try {
    const incomingMessage = String(
      req.body.Body || ""
    ).trim();

    const from = String(
      req.body.From || ""
    ).trim();

    console.log("📩 Twilio WhatsApp message:", {
      from,
      message: incomingMessage,
    });

    if (!incomingMessage || !from) {
      return res
        .type("text/xml")
        .send("<Response></Response>");
    }

    // --------------------------------------------
    // Convert whatsapp:+919999912345
    // to +919999912345
    // --------------------------------------------

    const customerPhone = from.replace(
      /^whatsapp:/i,
      ""
    );

    // --------------------------------------------
    // Find customer's active recovery case
    // --------------------------------------------

    let recoveryCase =
  await RecoveryCase.findOne({
    customerPhone,
    status: {
      $nin: [
        "RECOVERED",
        "STOPPED",
      ],
    },
  }).sort({
    createdAt: -1,
  });


// Demo mode fallback
if (
  !recoveryCase &&
  process.env.TWILIO_DEMO_MODE === "true" &&
  process.env.TWILIO_DEMO_RECOVERY_CASE_ID
) {
  recoveryCase =
    await RecoveryCase.findById(
      process.env.TWILIO_DEMO_RECOVERY_CASE_ID
    );

  console.log(
    "🧪 Demo mode: using recovery case:",
    recoveryCase?._id
  );
}

    if (!recoveryCase) {
      console.log(
        "⚠️ No active recovery case found for:",
        customerPhone
      );

      return res
        .type("text/xml")
        .send("<Response></Response>");
    }

    // --------------------------------------------
    // Send customer message to Revive AI
    // --------------------------------------------

    const result =
      await processCustomerMessage({
        recoveryCaseId:
          recoveryCase._id.toString(),
        customerMessage: incomingMessage,
        channel: "WHATSAPP",
      });

    // --------------------------------------------
    // If Revive stopped communication
    // --------------------------------------------

    if (
      result.stopped ||
      !result.response
    ) {
      return res
        .type("text/xml")
        .send("<Response></Response>");
    }

    // --------------------------------------------
    // Send AI response back to WhatsApp
    // --------------------------------------------

    if (!twilioClient) {
      console.error(
        "❌ Twilio client is not configured"
      );

      return res
        .type("text/xml")
        .send("<Response></Response>");
    }

    const whatsappTo =
      `whatsapp:${customerPhone}`;

    const sentMessage =
      await twilioClient.messages.create({
        from:
          process.env.TWILIO_WHATSAPP_FROM,
        to: whatsappTo,
         contentSid: "HX7cf5a23fe00549e2ed931e272889fb49",
      });

    console.log(
      "🤖 Revive AI WhatsApp reply sent:",
      sentMessage.sid
    );

    // --------------------------------------------
    // Return empty TwiML response
    // --------------------------------------------

    return res
      .type("text/xml")
      .send("<Response></Response>");

  } catch (error) {
    console.error(
      "❌ Twilio WhatsApp webhook error:",
      error
    );

    return res
      .type("text/xml")
      .send("<Response></Response>");
  }
};

module.exports = {
  receiveWhatsAppMessage,
};