
const {
  startVoiceAgent,
  processVoiceTranscript,
} = require("../services/voiceAgentService");

const {
  makeVoiceCall,
} = require("../services/twilioVoiceService");

const {
  processCustomerMessage,
} = require("../services/conversationService");

const twilio = require("twilio");

const PUBLIC_BASE_URL =
  "https://bankable-cornhusk-prenatal.ngrok-free.dev";

/**
 * Start AI Voice Agent
 */
const startVoiceRecovery = async (req, res) => {
  try {
    const {
      recoveryCaseId,
    } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

    const result = await startVoiceAgent({
      recoveryCaseId,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Start voice agent error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * Process customer voice transcript
 */
const handleVoiceTranscript = async (req, res) => {
  try {
    const {
      recoveryCaseId,
      voiceTranscript,
    } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

    if (!voiceTranscript) {
      return res.status(400).json({
        success: false,
        message: "voiceTranscript is required",
      });
    }

    const result = await processVoiceTranscript({
      recoveryCaseId,
      voiceTranscript,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Voice transcript error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * Make real Twilio voice call
 */
const makeRealVoiceCall = async (req, res) => {
  try {
    const {
      to,
      customerName,
      recoveryCaseId,
    } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "to phone number is required",
      });
    }

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

    const result = await makeVoiceCall({
      to,
      customerName,
      recoveryCaseId,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Real Twilio voice call error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * Twilio starts the interactive voice conversation
 */
const twilioVoiceWebhook = async (req, res) => {
  try {
    const recoveryCaseId =
      req.query?.recoveryCaseId;

    console.log(
      "========== TWILIO VOICE WEBHOOK =========="
    );

    console.log(
      "RecoveryCaseId:",
      recoveryCaseId
    );

    console.log(
      "CallSid:",
      req.body?.CallSid
    );

    console.log(
      "=========================================="
    );

    const VoiceResponse =
      twilio.twiml.VoiceResponse;

    const response =
      new VoiceResponse();

    const gather =
      response.gather({
        input: "speech",
        action:
          `${PUBLIC_BASE_URL}/api/voice/speech?recoveryCaseId=${encodeURIComponent(
            recoveryCaseId || ""
          )}`,
        method: "POST",
        language: "hi-IN",
        speechTimeout: "auto",
        actionOnEmptyResult: false,
      });

    gather.say(
      {
        language: "hi-IN",
      },
      "Namaste. Main Revive se payment recovery ke regarding aapse baat kar rahi hoon. Kya aap bata sakte hain ki aap payment kab complete karenge?"
    );

    response.say(
      {
        language: "hi-IN",
      },
      "Humein aapki baat  samajh nahi aayi. Kripya dobara batayein.Dhanyavaad."
    );

    response.redirect(
      {
        method: "POST",
      },
      `${PUBLIC_BASE_URL}/api/voice/twilio?recoveryCaseId=${encodeURIComponent(
        recoveryCaseId || ""
      )}`
    );
     
    return res
      .type("text/xml")
      .send(response.toString());
   
  } catch (error) {
    console.error(
      "Twilio voice webhook error:",
      error
    );

    return res
      .status(500)
      .send("Voice webhook error");
  }
};


/**
 * Receive Twilio speech and send it to Revive AI
 */
const handleTwilioSpeech = async (
  req,
  res
) => {
  try {
    const speechResult =
      req.body?.SpeechResult;

    const recoveryCaseId =
      req.query?.recoveryCaseId;

    console.log(
      "========== TWILIO AI SPEECH =========="
    );

    console.log(
      "SpeechResult:",
      speechResult
    );

    console.log(
      "RecoveryCaseId:",
      recoveryCaseId
    );

    console.log(
      "CallSid:",
      req.body?.CallSid
    );

    console.log(
      "======================================="
    );

    const VoiceResponse =
      twilio.twiml.VoiceResponse;

    const response =
      new VoiceResponse();

    /**
     * If speech was not detected
     */
    if (!speechResult) {
      response.say(
        {
          language: "hi-IN",
        },
        "Maaf kijiye, mujhe aapki baat samajh nahi aayi. Kripya dobara batayein."
      );

      response.redirect(
        {
          method: "POST",
        },
        `${PUBLIC_BASE_URL}/api/voice/twilio?recoveryCaseId=${encodeURIComponent(
          recoveryCaseId || ""
        )}`
      );

      return res
        .type("text/xml")
        .send(response.toString());
    }

    /**
     * Recovery case is required
     */
    if (!recoveryCaseId) {
      response.say(
        {
          language: "hi-IN",
        },
        "Maaf kijiye, recovery information available nahi hai. Dhanyavaad."
      );

      return res
        .type("text/xml")
        .send(response.toString());
    }

    /**
     * Send customer's speech
     * to the existing Revive AI conversation system
     */
    const result =
      await processCustomerMessage({
        recoveryCaseId,
        customerMessage: speechResult,
        channel: "VOICE",
      });

    console.log(
      "========== AI RESULT =========="
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    console.log(
      "==============================="
    );

    /**
     * Get AI response text
     */
    const aiMessage =
      result?.response ||
      result?.aiResponse ||
      result?.message ||
      "Dhanyavaad. Hum aapki payment recovery request ko process kar rahe hain.";

    /**
     * Speak AI response to customer
     */
    response.say(
      {
        language: "hi-IN",
      },
      aiMessage
    );

    /**
     * Continue conversation if recovery
     * has not been stopped or completed
     */
    if (
      result?.stopped !== true &&
      result?.status !== "STOPPED" &&
      result?.status !== "RECOVERED"
    ) {
      const gather =
        response.gather({
          input: "speech",
          action:
            `${PUBLIC_BASE_URL}/api/voice/speech?recoveryCaseId=${encodeURIComponent(
              recoveryCaseId
            )}`,
          method: "POST",
          language: "hi-IN",
          speechTimeout: "auto",
          actionOnEmptyResult: true,
        });

      gather.say(
        {
          language: "hi-IN",
        },
        "Kya aap kuch aur batana chahenge?"
      );
    }

    return res
      .type("text/xml")
      .send(response.toString());
  } catch (error) {
    console.error(
      "Twilio AI speech handler error:",
      error
    );

    const VoiceResponse =
      twilio.twiml.VoiceResponse;

    const response =
      new VoiceResponse();

    response.say(
      {
        language: "hi-IN",
      },
      "Maaf kijiye, abhi technical problem aa gayi hai. Kripya thodi der baad dobara try karein."
    );

    return res
      .type("text/xml")
      .send(response.toString());
  }
};


/**
 * Export controllers
 */
module.exports = {
  startVoiceRecovery,
  handleVoiceTranscript,
  makeRealVoiceCall,
  twilioVoiceWebhook,
  handleTwilioSpeech,
};