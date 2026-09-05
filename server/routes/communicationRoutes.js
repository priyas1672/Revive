const express = require("express");

const {
  sendRecovery,
   chatWithCustomer,
} = require("../controllers/communicationController");

const router = express.Router();

router.post("/send", sendRecovery);
router.post("/chat", chatWithCustomer);

module.exports = router;