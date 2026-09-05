const express = require("express");

const {
  receiveWhatsAppMessage,
} = require("../controllers/twilioController");

const router = express.Router();

router.post(
  "/whatsapp",
  receiveWhatsAppMessage
);

module.exports = router;