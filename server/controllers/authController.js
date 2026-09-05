const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Merchant = require("../models/Merchant");


// ==========================================
// Generate JWT Token
// ==========================================
const generateToken = (merchantId) => {
  return jwt.sign(
    {
      merchantId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};


// ==========================================
// SIGN UP
// ==========================================
const signup = async (req, res) => {
  try {
    const {
      name,
      businessName,
      email,
      password,
    } = req.body;


    // -------------------------------
    // Validation
    // -------------------------------
    if (
      !name ||
      !businessName ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, business name, email and password are required.",
      });
    }


    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters long.",
      });
    }


    const normalizedEmail =
      email.toLowerCase().trim();


    // -------------------------------
    // Check existing merchant
    // -------------------------------
    const existingMerchant =
      await Merchant.findOne({
        email: normalizedEmail,
      });


    if (existingMerchant) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }


    // -------------------------------
    // Hash password
    // -------------------------------
    const hashedPassword =
      await bcrypt.hash(password, 12);


    // -------------------------------
    // Create merchant
    // -------------------------------
    const merchant =
      await Merchant.create({
        name: name.trim(),
        businessName: businessName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      });


    // -------------------------------
    // Generate JWT
    // -------------------------------
    const token =
      generateToken(merchant._id.toString());


    return res.status(201).json({
      success: true,
      message:
        "Merchant account created successfully.",
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        businessName: merchant.businessName,
        email: merchant.email,
      },
    });


  } catch (error) {

    console.error(
      "========== SIGNUP ERROR =========="
    );

    console.error(error);

    console.error(
      "=================================="
    );


    return res.status(500).json({
      success: false,
      message:
        "Unable to create merchant account.",
    });
  }
};



// ==========================================
// LOGIN
// ==========================================
const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;


    // -------------------------------
    // Validation
    // -------------------------------
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }


    const normalizedEmail =
      email.toLowerCase().trim();


    // -------------------------------
    // Find merchant
    // -------------------------------
    const merchant =
      await Merchant.findOne({
        email: normalizedEmail,
      });


    if (!merchant) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }


    // -------------------------------
    // Check active account
    // -------------------------------
    if (!merchant.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This merchant account is inactive.",
      });
    }


    // -------------------------------
    // Compare password
    // -------------------------------
    const passwordMatch =
      await bcrypt.compare(
        password,
        merchant.password
      );


    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }


    // -------------------------------
    // Generate JWT
    // -------------------------------
    const token =
      generateToken(merchant._id.toString());


    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        businessName: merchant.businessName,
        email: merchant.email,
      },
    });


  } catch (error) {

    console.error(
      "========== LOGIN ERROR =========="
    );

    console.error(error);

    console.error(
      "================================"
    );


    return res.status(500).json({
      success: false,
      message:
        "Unable to login.",
    });
  }
};
  

const getMe = async (req, res) => {
  try {
    if (!req.merchant) {
      return res.status(401).json({
        success: false,
        message: "Merchant authentication required.",
      });
    }

    res.status(200).json({
      success: true,
      merchant: {
        id: req.merchant._id,
        name: req.merchant.name,
        businessName: req.merchant.businessName,
        email: req.merchant.email,
      },
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch merchant profile.",
    });
  }
};


module.exports = {
  signup,
  login,
  getMe
};