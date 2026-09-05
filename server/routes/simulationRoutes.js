
const express = require("express");
const multer = require("multer");

const {
  runBatchSimulation,
} = require("../controllers/simulationController");

const router = express.Router();

// ============================================================
// CSV UPLOAD CONFIGURATION
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

// ============================================================
// BATCH SIMULATION
// ============================================================

// JSON
router.post(
  "/batch",
  runBatchSimulation
);

// CSV
router.post(
  "/batch/csv",
  upload.single("file"),
  runBatchSimulation
);

module.exports = router;