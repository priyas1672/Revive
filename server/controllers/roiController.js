const {
  getROIDashboard,
} = require("../services/roiService");

// ============================================================
// ROI DASHBOARD CONTROLLER
// ============================================================

const getDashboard = async (req, res) => {
  try {
    const result =
      await getROIDashboard(req.merchantId);

    return res.status(200).json(result);

  } catch (error) {
    console.error(
      "ROI dashboard error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to generate ROI dashboard",
    });
  }
};

module.exports = {
  getDashboard,
};