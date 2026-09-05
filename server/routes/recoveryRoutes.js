const express = require("express");

const {
  evaluateRecovery,
  retryRecovery,
  generateRecoveryOffer,
} = require("../controllers/recoveryController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/evaluate",
  protect,
  evaluateRecovery
);

router.post(
  "/retry",
  protect,
  retryRecovery
);

router.post(
  "/offer",
  protect,
  generateRecoveryOffer
);

module.exports = router;