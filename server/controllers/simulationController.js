
const {
  simulateBatchRecovery,
} = require("../services/simulationService");

// ============================================================
// BATCH SIMULATION CONTROLLER
// Supports:
// 1. JSON payments array
// 2. CSV file upload
// ============================================================

const parseCSV = (csvText) => {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error(
      "CSV must contain a header and at least one payment"
    );
  }

  const headers = lines[0]
    .split(",")
    .map((header) => header.trim());

  const payments = lines.slice(1).map((line) => {
    const values = line.split(",");

    const payment = {};

    headers.forEach((header, index) => {
      payment[header] =
        values[index]?.trim() || "";
    });

    return payment;
  });

  return payments;
};

// ============================================================
// RUN BATCH SIMULATION
// ============================================================

const runBatchSimulation = async (req, res) => {
  try {
    let payments = [];

    // --------------------------------------------------------
    // OPTION 1: CSV FILE
    // --------------------------------------------------------

    if (req.file) {
      const csvText =
        req.file.buffer.toString("utf-8");

      payments = parseCSV(csvText);
    }

    // --------------------------------------------------------
    // OPTION 2: JSON
    // --------------------------------------------------------

    else if (Array.isArray(req.body?.payments)) {
      payments = req.body.payments;
    }

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    else {
      return res.status(400).json({
        success: false,
        message:
          "Provide a CSV file or a payments array",
      });
    }

    if (payments.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No payment records found",
      });
    }

    // --------------------------------------------------------
    // SAFETY LIMIT
    // --------------------------------------------------------

    if (payments.length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum 500 payments are allowed per simulation",
      });
    }

    // --------------------------------------------------------
    // RUN REVIVE SIMULATION
    // --------------------------------------------------------

    const result =
      await simulateBatchRecovery(payments);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      ...result,

      batchSize:
        payments.length,

      inputType:
        req.file ? "CSV" : "JSON",
    });

  } catch (error) {
    console.error(
      "Batch simulation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Batch simulation failed",
    });
  }
};

module.exports = {
  runBatchSimulation,
};