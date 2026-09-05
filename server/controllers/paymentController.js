const razorpay = require("../config/razorpay");
const Payment = require("../models/Payment");

const createOrder = async (req, res) => {
  try {

    // Logged-in merchant ki ID
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Merchant authentication required.",
      });
    }

    const {
      amount,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    if (!amount || !customerName) {
      return res.status(400).json({
        success: false,
        message: "Amount and customer name are required",
      });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `revive_${Date.now()}`,
      notes: {
        product: "Revive",
        customerName,
      },
    };

    const order = await razorpay.orders.create(options);

    const payment = await Payment.create({
      merchantId,
      razorpayOrderId: order.id,
      customerName,
      customerEmail,
      customerPhone,
      amount,
      currency: "INR",
      status: "CREATED",
    });

    res.status(201).json({
      success: true,
      order,
      payment,
    });
  } catch (error) {
    console.error("========== CREATE ORDER ERROR ==========");
  console.error("Message:", error.message);
  console.error("Status:", error.statusCode);
  console.error("Description:", error.description);
  console.error("Full Error:", error);
  console.error("========================================");

    res.status(500).json({
      success: false,
      message: error.message || "Unable to create payment order",
      description: error.description || null
    });
  }
};

const listPayments = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: "Merchant authentication required." });
    }

    const payments = await Payment.find({ merchantId }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("LIST PAYMENTS ERROR:", error);
    res.status(500).json({ success: false, message: "Unable to fetch payments" });
  }
};

module.exports = {
  createOrder,
  listPayments,
};

