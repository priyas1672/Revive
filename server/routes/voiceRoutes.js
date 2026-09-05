const express = require("express");

const {
  startVoiceRecovery,
  handleVoiceTranscript,
  makeRealVoiceCall,
  twilioVoiceWebhook,
  handleTwilioSpeech,

} = require("../controllers/voiceController");

const router = express.Router();

router.post(
  "/start",
  startVoiceRecovery
);

router.post(
  "/transcript",
  handleVoiceTranscript
);

router.post(
  "/call",
  makeRealVoiceCall
);

router.post(
  "/twilio",
  twilioVoiceWebhook
);

router.post(
  "/speech",
  handleTwilioSpeech
);

module.exports = router;