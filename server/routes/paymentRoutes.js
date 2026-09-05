const express = require("express");

const {
  createOrder,
  listPayments,
} = require("../controllers/paymentController");


const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, listPayments);
router.post("/create-order", protect, createOrder);

module.exports = router;