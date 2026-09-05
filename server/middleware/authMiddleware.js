const jwt = require("jsonwebtoken");
const Merchant = require("../models/Merchant");


// ==========================================
// Authentication Middleware
// ==========================================
const protect = async (req, res, next) => {
  try {

    // --------------------------------------
    // Get Authorization header
    // --------------------------------------
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }


    // --------------------------------------
    // Check Bearer format
    // --------------------------------------
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication format.",
      });
    }


    // --------------------------------------
    // Extract token
    // --------------------------------------
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }


    // --------------------------------------
    // Verify JWT
    // --------------------------------------
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );


    // --------------------------------------
    // Find merchant
    // --------------------------------------
    const merchant = await Merchant.findById(
      decoded.merchantId
    ).select("-password");


    if (!merchant) {
      return res.status(401).json({
        success: false,
        message: "Merchant account not found.",
      });
    }


    // --------------------------------------
    // Check active account
    // --------------------------------------
    if (!merchant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Merchant account is inactive.",
      });
    }


    // --------------------------------------
    // Attach merchant to request
    // --------------------------------------
    req.merchant = merchant;

    req.merchantId = merchant._id;


    // --------------------------------------
    // Continue to API
    // --------------------------------------
    next();


  } catch (error) {

    console.error(
      "========== AUTH MIDDLEWARE ERROR =========="
    );

    console.error(error);

    console.error(
      "==========================================="
    );


    // JWT expired
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired.",
      });
    }


    // Invalid JWT
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }


    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};


module.exports = {
  protect,
};