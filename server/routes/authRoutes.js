

const express = require("express");

const {
  signup,
  login,
  getMe,
} = require("../controllers/authController");

const {
  protect,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Merchant Signup
router.post("/signup", signup);

// Merchant Login
router.post("/login", login);

// Get logged-in merchant
router.get("/me", protect, getMe);

module.exports = router;