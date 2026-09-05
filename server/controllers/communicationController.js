const {
  sendRecoveryCommunication,
} = require("../services/communicationService");

const {
  processCustomerMessage,
} = require("../services/conversationService");

const sendRecovery = async (req, res) => {
  try {
    const { recoveryCaseId ,channel } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

    const result =
      await sendRecoveryCommunication(recoveryCaseId , channel);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Communication controller error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const chatWithCustomer = async (req, res) => {
  try {
    const {
      recoveryCaseId,
      customerMessage,
      channel = "WHATSAPP",
    } = req.body;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

    if (!customerMessage) {
      return res.status(400).json({
        success: false,
        message: "customerMessage is required",
      });
    }

    const result = await processCustomerMessage({
      recoveryCaseId,
      customerMessage,
      channel,
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error("AI conversation controller error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  sendRecovery,
  chatWithCustomer,
};