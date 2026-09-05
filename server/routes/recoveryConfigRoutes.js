const express = require("express");

const {
  getRecoveryConfig,
  updateRecoveryConfig,
} = require("../controllers/recoveryConfigController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// GET MERCHANT RECOVERY CONFIG
// ============================================================

router.get(
  "/",
  protect,
  getRecoveryConfig
);

// ============================================================
// UPDATE MERCHANT RECOVERY CONFIG
// ============================================================

router.put(
  "/",
  protect,
  updateRecoveryConfig
);

module.exports = router;