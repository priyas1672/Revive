
const express = require("express");

const {
  getDashboard,
} = require("../controllers/roiController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ROI DASHBOARD
// ============================================================

router.get(
  "/dashboard",
  protect,
  getDashboard
);

module.exports = router;