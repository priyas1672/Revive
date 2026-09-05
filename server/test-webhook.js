require("dotenv").config();
const crypto = require("crypto");
const http = require("http");

// 👇 YAHAN apna real order ID daalo (jo Payments page se copy kiya)
const razorpayOrderId = "order_TYOjK1NgKkduWL";

const payload = {
  event: "payment.failed",
  payload: {
    payment: {
      entity: {
        id: "pay_test_" + Date.now(),
        order_id: razorpayOrderId,
        error_code: "BAD_REQUEST_ERROR",
        error_reason: "insufficient_funds",
        error_description: "Insufficient balance in the customer's account",
        method: "upi",
      },
    },
  },
};

const rawBody = JSON.stringify(payload);

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
const signature = crypto
  .createHmac("sha256", secret)
  .update(rawBody)
  .digest("hex");

const options = {
  hostname: "localhost",
  port: process.env.PORT || 5000,
  path: "/api/webhooks/razorpay",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(rawBody),
    "x-razorpay-signature": signature,
    "x-razorpay-event-id": "evt_test_" + Date.now(),
  },
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Response:", data);
  });
});

req.on("error", (e) => console.error("Request error:", e));
req.write(rawBody);
req.end();