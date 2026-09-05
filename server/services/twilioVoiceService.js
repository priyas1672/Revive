
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const PUBLIC_BASE_URL =
  "https://bankable-cornhusk-prenatal.ngrok-free.dev";

/**
 * Make real Twilio voice call
 */
const makeVoiceCall = async ({
  to,
  customerName,
  recoveryCaseId,
}) => {
  if (!to) {
    throw new Error("Phone number is required");
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    throw new Error(
      "TWILIO_PHONE_NUMBER is missing in .env"
    );
  }

  if (!recoveryCaseId) {
    throw new Error(
      "recoveryCaseId is required"
    );
  }

  const call = await client.calls.create({
    to: to,

    from:
      process.env.TWILIO_PHONE_NUMBER,

    url:
      `${PUBLIC_BASE_URL}/api/voice/twilio?recoveryCaseId=${encodeURIComponent(
        recoveryCaseId
      )}`,
  });

  return {
    success: true,
    callSid: call.sid,
    status: call.status,
    to: call.to,
    from: call.from,
    recoveryCaseId,
  };
};

module.exports = {
  makeVoiceCall,
};