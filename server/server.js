require("dotenv").config();

const express = require("express");
const cors = require("cors");


const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const recoveryRoutes = require("./routes/recoveryRoutes");
const promiseRoutes = require("./routes/promiseRoutes");

const {startRecoveryScheduler,} = require("./services/recoveryScheduler");

const communicationRoutes = require("./routes/communicationRoutes");

const voiceRoutes = require("./routes/voiceRoutes");

const simulationRoutes = require("./routes/simulationRoutes");

const roiRoutes = require("./routes/roiRoutes");

const recoveryConfigRoutes = require("./routes/recoveryConfigRoutes");

const authRoutes = require("./routes/authRoutes");

const twilioRoutes = require("./routes/twilioRoutes");


const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());


// IMPORTANT:
// Razorpay webhook must come BEFORE express.json()
app.use("/api/webhooks", webhookRoutes);

// Normal JSON APIs
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/payments", paymentRoutes);
app.use("/api/recovery",recoveryRoutes);
app.use("/api/promises",promiseRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/simulation", simulationRoutes);
app.use("/api/roi", roiRoutes);
app.use("/api/recovery-config",recoveryConfigRoutes
);
app.use("/api/auth", authRoutes);
app.use("/api/twilio", twilioRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Revive API is running 🚀",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Revive server running on port ${PORT}`);

    startRecoveryScheduler();
});