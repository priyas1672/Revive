const ConversationMemory = require("../models/ConversationMemory");
const CustomerMemory = require("../models/CustomerMemory");
const RecoveryCase = require("../models/RecoveryCase");

const { createAuditLog } = require("./auditService");


const {
  calculateRecoveryOffer,
  createNegotiatedPaymentLink,
} = require("./negotiationService");

let geminiAI = null;

const getGeminiAI = async () => {
  if (!geminiAI) {
    const { GoogleGenAI } = await import("@google/genai");

    geminiAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  return geminiAI;
};

const MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

const parsePromiseDate = (dateText) => {
  if (!dateText) return null;

  const text = String(dateText).toLowerCase().trim();

  const now = new Date();

  // Tomorrow
  if (
    text.includes("kal") ||
    text.includes("tomorrow")
  ) {
    now.setDate(now.getDate() + 1);
    now.setHours(10, 0, 0, 0);
    return now;
  }

  // Day after tomorrow
  if (
    text.includes("parso") ||
    text.includes("day after tomorrow")
  ) {
    now.setDate(now.getDate() + 2);
    now.setHours(10, 0, 0, 0);
    return now;
  }

  // Date like "5 tareekh"
  const dateMatch = text.match(/(\d{1,2})\s*(tareekh|date)/);

  if (dateMatch) {
    const day = Number(dateMatch[1]);

    const promiseDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      day,
      10,
      0,
      0,
      0
    );

    // If date already passed this month,
    // assume next month.
    if (promiseDate < now) {
      promiseDate.setMonth(
        promiseDate.getMonth() + 1
      );
    }

    return promiseDate;
  }

  return null;
};


// ------------------------------------------------------
// Get or create short-term conversation memory
// ------------------------------------------------------

const getOrCreateConversation = async ({
  recoveryCaseId,
  customerPhone,
  customerName,
  channel = "WHATSAPP",
  language = "HINGLISH",
}) => {
  let conversation =
    await ConversationMemory.findOne({
      recoveryCase: recoveryCaseId,
    });

  if (!conversation) {
    conversation =
      await ConversationMemory.create({
        recoveryCase: recoveryCaseId,
        customerPhone,
        customerName,
        channel,
        language,
        conversationStatus: "ACTIVE",
        messages: [],
      });
  }

  return conversation;
};

// ------------------------------------------------------
// Detect customer intent using lightweight rules
// before LLM call
// ------------------------------------------------------

const detectBasicIntent = (message) => {
  const text = String(message || "").toLowerCase();

  if (
    text.includes("stop") ||
    text.includes("unsubscribe") ||
    text.includes("message mat") ||
    text.includes("call mat") ||
    text.includes("contact mat")
  ) {
    return "OPT_OUT";
  }

  if (
    text.includes("5 tareekh") ||
    text.includes("kal payment") ||
    text.includes("parso payment") ||
    text.includes("date ko payment") ||
    text.includes("payment kar dunga") ||
    text.includes("payment kar dungi") ||
    text.includes("baad mein pay")
  ) {
    return "PROMISE_TO_PAY";
  }

  if (
    text.includes("upi") ||
    text.includes("upi link")
  ) {
    return "UPI_REQUEST";
  }

  if (
    text.includes("card") &&
    (
      text.includes("block") ||
      text.includes("blocked") ||
      text.includes("decline")
    )
  ) {
    return "CARD_PROBLEM";
  }

  if (
    text.includes("discount") ||
    text.includes("kam") ||
    text.includes("offer") ||
    text.includes("emi")
  ) {
    return "AFFORDABILITY";
  }

  if (
    text.includes("kyu") ||
    text.includes("why") ||
    text.includes("problem") ||
    text.includes("fail")
  ) {
    return "FAILURE_EXPLANATION";
  }

  return "GENERAL_RECOVERY";
};

// ------------------------------------------------------
// Detect whether customer accepted an existing offer
// ------------------------------------------------------

const detectOfferAcceptance = (message) => {
  const text = String(message || "")
    .toLowerCase()
    .trim();

  if (!text) {
    return false;
  }

  const acceptancePatterns = [
    "haan",
    "ha",
    "yes",
    "yeah",
    "yup",
    "okay",
    "ok",
    "theek hai",
    "thik hai",
    "kar do",
    "kr do",
    "bhej do",
    "send kar do",
    "deal",
    "done",
    "manzoor",
    "accept",
    "accepted",
    "i accept",
    "yes please",
  ];

  return acceptancePatterns.some((pattern) => {
    return (
      text === pattern ||
      text.startsWith(pattern + " ") ||
      text.endsWith(" " + pattern) ||
      text.includes(" " + pattern + " ")
    );
  });
};

// ------------------------------------------------------
// Build customer context
// ------------------------------------------------------

const buildCustomerContext = async ({
  customerPhone,
  recoveryCase,
}) => {
  const customerMemory =
    await CustomerMemory.findOne({
      customerPhone,
    });

  return {
    customer: {
      name:
        recoveryCase.customerName ||
        customerMemory?.customerName ||
        "Customer",

      phone: customerPhone,

      preferredLanguage:
        customerMemory?.preferredLanguage ||
        "HINGLISH",

      preferredChannel:
        customerMemory?.preferredChannel ||
        "WHATSAPP",

      preferredTone:
        customerMemory?.preferredTone ||
        "FRIENDLY",

      reliabilityScore:
        customerMemory?.reliabilityScore ?? 0.5,

      promisesMade:
        customerMemory?.promisesMade || 0,

      promisesFulfilled:
        customerMemory?.promisesFulfilled || 0,

      promisesBroken:
        customerMemory?.promisesBroken || 0,

      importantNotes:
        customerMemory?.importantNotes || [],
    },

    recovery: {
      amount: recoveryCase.amount,
      currency: recoveryCase.currency,

      failureCode:
        recoveryCase.failureCode,

      failureReason:
        recoveryCase.failureReason,

      decision:
        recoveryCase.decision?.action,

      recoveryChannel:
        recoveryCase.recoveryChannel,

      retryCount:
        recoveryCase.retryCount,
    },
  };
};

// ---------------------------------------------------


// ------------------------------------------------------
// Generate Hinglish AI response
// ------------------------------------------------------

const generateAIResponse = async ({
  recoveryCase,
  conversation,
  customerMessage,
  channel = "WHATSAPP",
  recoveryOffer = null,
}) => {
  const basicIntent =
    detectBasicIntent(customerMessage);

    // ------------------------------------------------------
// Dynamic Negotiation / Soft Recovery
// ------------------------------------------------------
     


if (basicIntent === "AFFORDABILITY") {
  try {
    recoveryOffer =
      await calculateRecoveryOffer({
        merchantId:
          recoveryCase.merchantId || "default-merchant",
        amount: recoveryCase.amount,
      });

    console.log(
      "Dynamic Recovery Offer:",
      recoveryOffer
    );
  } catch (error) {
    console.error(
      "Recovery offer calculation error:",
      error.message
    );
  }
}
    // ------------------------------------------------------
// Fast voice response
// Do not wait for Gemini during a live phone call
// ------------------------------------------------------
if (channel === "VOICE") {
  if (basicIntent === "PROMISE_TO_PAY") {
    const lowerMessage =
      String(customerMessage || "").toLowerCase();

    let promiseDateText = null;

    if (lowerMessage.includes("kal")) {
      promiseDateText = "kal";
    } else if (lowerMessage.includes("parso")) {
      promiseDateText = "parso";
    } else if (lowerMessage.includes("5 tareekh")) {
      promiseDateText = "5 tareekh";
    }

    return {
      message:
        "Ji. Humne note kar liya hai ki aap kal payment karenge. Thank you so much!",

      intent: "PROMISE_TO_PAY",

      needsPromiseToPay: true,

      promiseDateText,

      needsPaymentLink: false,

      optOut: false,
    };
  }

  if (basicIntent === "OPT_OUT") {
    return {
      message:
        "Bilkul ji. Hum aapko further recovery messages nahi bhejenge.",

      intent: "OPT_OUT",

      needsPromiseToPay: false,

      promiseDateText: null,

      needsPaymentLink: false,

      optOut: true,
    };
  }

  if (basicIntent === "UPI_REQUEST") {
    return {
      message:
        "Bilkul ji. Main aapke liye payment option arrange karne mein help karta hoon.",

      intent: "UPI_REQUEST",

      needsPromiseToPay: false,

      promiseDateText: null,

      needsPaymentLink: true,

      optOut: false,
    };
  }
}


// ------------------------------------------------------
// Fast WhatsApp Promise-to-Pay response
// ------------------------------------------------------

if (
  channel === "WHATSAPP" &&
  basicIntent === "PROMISE_TO_PAY"
) {
  const lowerMessage = String(customerMessage || "").toLowerCase();

  let promiseDateText = null;

  if (lowerMessage.includes("kal")) {
    promiseDateText = "kal";
  } else if (lowerMessage.includes("parso")) {
    promiseDateText = "parso";
  } else if (lowerMessage.includes("5 tareekh")) {
    promiseDateText = "5 tareekh";
  }

  return {
    message:
      "Bilkul ji. Humne note kar liya hai ki aap kal payment karenge. Thank you so much! 🙏",

    intent: "PROMISE_TO_PAY",

    needsPromiseToPay: true,

    promiseDateText,

    needsPaymentLink: false,

    optOut: false,

    offerAvailable: false,

    discountAmount: null,

    finalAmount: null,

    offerAccepted: false,
  };
}

  const context =
    await buildCustomerContext({
      customerPhone: conversation.customerPhone,
      recoveryCase,
    });

  const recentMessages =
    conversation.messages
      .slice(-10)
      .map((item) => {
        const role =
          item.role === "CUSTOMER"
            ? "Customer"
            : "Revive Agent";

        return `${role}: ${item.message}`;
      })
      .join("\n");

  const systemPrompt = `
You are Revive, an AI payment recovery agent.

Your goal is to recover a failed payment politely,
without being spammy, threatening, or manipulative.

Communication style:
- Use natural Indian Hinglish.
- Be friendly and concise.
- Do not sound robotic.
- Use the customer's name when appropriate.
- Never threaten or pressure the customer.
- Never invent discounts.
- Never invent payment links.
- Never claim a payment was successful unless the system confirms it.
- If the customer asks for a payment link, indicate that Revive can arrange one.
- If the customer wants to pay later, help capture a Promise-to-Pay date.
- Respect opt-out requests immediately.

CUSTOMER IDENTITY RULE:
- The customer's identity comes only from the provided customer context.

Rules:
- If customerName is available, use that customer's name.
- Never invent, guess, or replace the customer's name with another name.
- Never use a name from previous conversations or unrelated context.
- Never use the merchant's name, developer's name, or any previous person's name.
- If customerName is missing or null, do not address the customer by name.
- For example, if customerName is "Rahul Sharma", you may say "Rahul ji".
- Never call the customer "Priya" unless the provided customerName is actually "Priya".

- Never invent discounts.
- If a Current recovery offer is eligible, use ONLY the provided discountAmount and finalAmount.
- Never calculate or modify the discount yourself.
- Only set offerAccepted to true when the customer clearly accepts the offered amount.
- Never invent payment links.

Current customer context:

${JSON.stringify(context, null, 2)}

Current recovery offer:

${JSON.stringify(
  recoveryOffer || {
    eligible: false,
    reason: "No recovery offer available.",
  },
  null,
  2
)}

Detected basic intent:

${basicIntent}

Recent conversation:

${recentMessages || "No previous conversation."}

Return ONLY valid JSON matching the requested schema.
`;

  const prompt = `
${systemPrompt}

Current customer message:

${customerMessage}
`;

  // ------------------------------------------------------
  // Get Gemini AI
  // ------------------------------------------------------

  const ai = await getGeminiAI();

  let response = null;

  // ------------------------------------------------------
  // Gemini call with retry
  // ------------------------------------------------------

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(
        `Gemini request attempt ${attempt}/3`
      );

      response =
        await ai.models.generateContent({
          model: MODEL,
          contents: prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                message: {
                  type: "string",
                  description:
                    "Customer-facing Hinglish response",
                },

                intent: {
                  type: "string",

                  enum: [
                    "GENERAL_RECOVERY",
                    "PROMISE_TO_PAY",
                    "UPI_REQUEST",
                    "CARD_PROBLEM",
                    "AFFORDABILITY",
                    "FAILURE_EXPLANATION",
                    "OPT_OUT",
                    "PAYMENT_CONFIRMATION",
                    "HUMAN_ESCALATION",
                    "OFFER_ACCEPTED",
                  ],
                },

                needsPromiseToPay: {
                  type: "boolean",
                },

                promiseDateText: {
                  type: "string",
                  nullable: true,
                },

                needsPaymentLink: {
                  type: "boolean",
                },

                optOut: {
                  type: "boolean",
                },

                  offerAvailable: {
                   type: "boolean",
                    },

                  discountAmount: {
                    type: "number",
                    nullable: true,
                       },

                   finalAmount: {
                      type: "number",
                      nullable: true,
                        },

                    offerAccepted: {
                     type: "boolean",
                     },
                  },

              required: [
                "message",
                "intent",
                "needsPromiseToPay",
                "promiseDateText",
                "needsPaymentLink",
                "optOut",
                "offerAvailable",
                "discountAmount",
                "finalAmount",
                 "offerAccepted",
              ],
            },
          },
        });

      // Gemini request successful
      break;

    } catch (error) {
      console.error(
        `Gemini attempt ${attempt} failed:`,
        error.message
      );

      // Retry after 1.5 seconds
      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500)
        );
      }
    }
  }

  // ------------------------------------------------------
  // Safe fallback if Gemini is unavailable
  // ------------------------------------------------------

  if (!response) {
    console.warn(
      "Gemini unavailable. Using Revive fallback response."
    );

    // Promise-to-Pay fallback
    if (
      basicIntent === "PROMISE_TO_PAY"
    ) {
      const text =
        customerMessage
          .toLowerCase();

      let promiseDateText = null;

      if (text.includes("kal")) {
        promiseDateText = "kal";
      } else if (
        text.includes("parso")
      ) {
        promiseDateText = "parso";
      } else if (
        text.includes("5 tareekh")
      ) {
        promiseDateText =
          "5 tareekh";
      }

      return {
        message:
          "Bilkul ji. Aap kis date ko payment kar paayenge? Main aapka Promise-to-Pay note kar deta hoon.",

        intent:
          "PROMISE_TO_PAY",

        needsPromiseToPay:
          true,

        promiseDateText,

        needsPaymentLink:
          false,

        optOut:
          false,
      };
    }

    // Opt-out fallback
    if (
      basicIntent === "OPT_OUT"
    ) {
      return {
        message:
          "Bilkul ji, hum aapko further recovery messages nahi bhejenge. 🙏",

        intent:
          "OPT_OUT",

        needsPromiseToPay:
          false,

        promiseDateText:
          null,

        needsPaymentLink:
          false,

        optOut:
          true,
      };
    }

    // UPI request fallback
    if (
      basicIntent === "UPI_REQUEST"
    ) {
      return {
        message:
          "Bilkul ji. Main aapke liye payment option arrange karne mein help karta hoon.",

        intent:
          "UPI_REQUEST",

        needsPromiseToPay:
          false,

        promiseDateText:
          null,

        needsPaymentLink:
          true,

        optOut:
          false,
      };
    }

    // General recovery fallback
    return {
      message:
        "Ji, aapki payment recovery mein main help karta hoon. Aap batayein aap payment kab kar paayenge?",

      intent:
        basicIntent,

      needsPromiseToPay:
        false,

      promiseDateText:
        null,

      needsPaymentLink:
        false,

      optOut:
        false,
    };
  }

  // ------------------------------------------------------
  // Parse Gemini response
  // ------------------------------------------------------

  const output =
    response.text;

  try {
    
     const parsedResponse = JSON.parse(output);

  // Merchant-approved recovery offer is the source of truth.
  // Gemini must not decide the actual discount or final amount.
  if (recoveryOffer?.eligible === true) {
    parsedResponse.offerAvailable = true;

    parsedResponse.discountAmount =
      recoveryOffer.discountAmount;

    parsedResponse.finalAmount =
      recoveryOffer.finalAmount;
  } else {
    parsedResponse.offerAvailable = false;
    parsedResponse.discountAmount = null;
    parsedResponse.finalAmount = null;
  }

  return parsedResponse


  } catch (error) {
    console.error(
      "Gemini JSON parsing failed:",
      output
    );

    return {
      message:
        output,

      intent:
        basicIntent,

      needsPromiseToPay:
        basicIntent ===
        "PROMISE_TO_PAY",

      promiseDateText:
        basicIntent ===
        "PROMISE_TO_PAY"
          ? customerMessage
          : null,

      needsPaymentLink:
        false,

      optOut:
        basicIntent ===
        "OPT_OUT",
    };
  }
};

// ------------------------------------------------------
// Save customer message
// ------------------------------------------------------

const saveCustomerMessage = async ({
  conversation,
  message,
  intent,
}) => {
  conversation.messages.push({
    role: "CUSTOMER",
    message,
    intent,
  });

  conversation.lastCustomerMessage =
    message;

  conversation.currentIntent =
    intent;

  conversation.lastInteractionAt =
    new Date();

  await conversation.save();

  return conversation;
};

// ------------------------------------------------------
// Save agent message
// ------------------------------------------------------

const saveAgentMessage = async ({
  conversation,
  message,
  intent,
  metadata = {},
}) => {
  conversation.messages.push({
    role: "REVIVE_AGENT",
    message,
    intent,
    metadata,
  });

  conversation.lastAgentMessage =
    message;

  conversation.currentIntent =
    intent;

  conversation.lastInteractionAt =
    new Date();

  await conversation.save();

  return conversation;
};

// ------------------------------------------------------
// Main conversation handler
// ------------------------------------------------------

const processCustomerMessage = async ({
  recoveryCaseId,
  customerMessage,
  channel = "WHATSAPP",
}) => {
  if (!recoveryCaseId) {
    throw new Error(
      "recoveryCaseId is required"
    );
  }

  if (!customerMessage) {
    throw new Error(
      "customerMessage is required"
    );
  }

  const recoveryCase =
    await RecoveryCase.findById(
      recoveryCaseId
    );

  if (!recoveryCase) {
    throw new Error(
      "Recovery case not found"
    );
  }

  if (
    recoveryCase.status === "RECOVERED" ||
    recoveryCase.status === "STOPPED"
  ) {
    return {
      stopped: true,
      reason:
        "Recovery case is already resolved or stopped.",
    };
  }

  if (!recoveryCase.customerPhone) {
    throw new Error(
      "Customer phone is required for conversation"
    );
  }

  const conversation =
    await getOrCreateConversation({
      recoveryCaseId,
      customerPhone:
        recoveryCase.customerPhone,
      customerName:
        recoveryCase.customerName,
      channel,
    });

  const basicIntent =
    detectBasicIntent(customerMessage);

    // ------------------------------------------------------
// Dynamic Negotiation Acceptance
// ------------------------------------------------------

const existingNegotiation =
  recoveryCase.negotiation;

const offerAlreadyAvailable =
  existingNegotiation?.offerAvailable === true;

const offerAccepted =
  offerAlreadyAvailable &&
  detectOfferAcceptance(customerMessage);

  // Save customer message first
  await saveCustomerMessage({
    conversation,
    message: customerMessage,
    intent: basicIntent,
  });


  // Generate AI response
  const aiResponse =
    await generateAIResponse({
      recoveryCase,
      conversation,
      customerMessage,
       channel,
       
    });
    // ------------------------------------------------------
// Persist newly generated recovery offer
// ------------------------------------------------------

if (
  aiResponse?.offerAvailable === true &&
  aiResponse?.discountAmount != null &&
  aiResponse?.finalAmount != null &&
  !recoveryCase.negotiation?.offerAvailable
) {
  recoveryCase.negotiation.offerAvailable = true;

  recoveryCase.negotiation.originalAmount =
    recoveryCase.amount;

  recoveryCase.negotiation.discountAmount =
    aiResponse.discountAmount;

  recoveryCase.negotiation.finalAmount =
    aiResponse.finalAmount;

  recoveryCase.negotiation.offerAccepted = false;

  recoveryCase.negotiation.offerCreatedAt =
    new Date();

  recoveryCase.negotiation.status =
    "OFFER_CREATED";

  recoveryCase.lastAction =
    "NEGOTIATION_OFFER_CREATED";

  await recoveryCase.save();

  await createAuditLog({
    recoveryCase: recoveryCase._id,
    eventType: "NEGOTIATION_OFFER_CREATED",
    actor: "REVIVE_AGENT",
    action:
      "Generated a merchant-approved dynamic recovery offer.",
    reasoning:
      "Customer indicated affordability concerns and the recovery offer was calculated within merchant-configured limits.",
    metadata: {
      originalAmount:
        recoveryCase.amount,
      discountAmount:
        aiResponse.discountAmount,
      finalAmount:
        aiResponse.finalAmount,
    },
  });
}

// ------------------------------------------------------
// Create Payment Link after offer acceptance
// ------------------------------------------------------

if (offerAccepted) {
  try {
    const recoveryOffer = {
      eligible: true,
      originalAmount:
        recoveryCase.negotiation.originalAmount,
      discountAmount:
        recoveryCase.negotiation.discountAmount,
      finalAmount:
        recoveryCase.negotiation.finalAmount,
    };

    recoveryCase.negotiation.offerAccepted = true;

    recoveryCase.negotiation.offerAcceptedAt =
      new Date();

    recoveryCase.negotiation.status =
      "ACCEPTED";

    await recoveryCase.save();

    await createAuditLog({
      recoveryCase: recoveryCase._id,
      eventType:
        "NEGOTIATION_OFFER_ACCEPTED",
      actor: "CUSTOMER",
      action:
        "Customer accepted the merchant-approved recovery offer.",
      reasoning:
        "Customer explicitly accepted the previously offered negotiated amount.",
      metadata: {
        originalAmount:
          recoveryOffer.originalAmount,
        discountAmount:
          recoveryOffer.discountAmount,
        finalAmount:
          recoveryOffer.finalAmount,
      },
    });

    const paymentLink =
      await createNegotiatedPaymentLink({
        recoveryCase,
        recoveryOffer,
      });

    recoveryCase.negotiation.paymentLinkId =
      paymentLink.id;

    recoveryCase.negotiation.paymentLink =
      paymentLink.short_url;

    recoveryCase.negotiation.status =
      "LINK_CREATED";

    recoveryCase.lastAction =
      "NEGOTIATED_PAYMENT_LINK_CREATED";

    recoveryCase.nextActionAt = null;

    await recoveryCase.save();

    await createAuditLog({
      recoveryCase: recoveryCase._id,
      eventType:
        "NEGOTIATION_PAYMENT_LINK_CREATED",
      actor: "REVIVE_AGENT",
      action:
        "Created Razorpay Payment Link for the accepted negotiated recovery offer.",
      reasoning:
        "Customer accepted the merchant-approved offer, so Revive generated the negotiated payment link.",
      metadata: {
        paymentLinkId:
          paymentLink.id,
        paymentLink:
          paymentLink.short_url,
        finalAmount:
          recoveryOffer.finalAmount,
      },
    });

    return {
      success: true,
      intent: "OFFER_ACCEPTED",

      response:
        `Bilkul ${recoveryCase.customerName || "ji"}! ` +
        `Aapke liye negotiated amount ₹${recoveryOffer.finalAmount} ka payment link ready hai. ` +
        `Please is link se payment complete kar dijiye: ${paymentLink.short_url}`,

      offerAvailable: true,

      discountAmount:
        recoveryOffer.discountAmount,

      finalAmount:
        recoveryOffer.finalAmount,

      offerAccepted: true,

      paymentLink:
        paymentLink.short_url,

      needsPaymentLink: false,

      needsPromiseToPay: false,
    };
  } catch (error) {
    console.error(
      "Negotiated payment link creation error:",
      error.message
    );

    return {
      success: false,

      intent: "OFFER_ACCEPTED",

      response:
        "Aapka offer accept ho gaya hai, lekin payment link banate waqt issue aa gaya. Please thodi der baad try karein.",

      offerAvailable: true,

      discountAmount:
        recoveryCase.negotiation.discountAmount,

      finalAmount:
        recoveryCase.negotiation.finalAmount,

      offerAccepted: true,

      needsPaymentLink: true,

      needsPromiseToPay: false,
    };
  }
}
    let promiseResult = null;

if (
  aiResponse.needsPromiseToPay &&
  aiResponse.promiseDateText
) {
  const promisedDate = parsePromiseDate(
    aiResponse.promiseDateText
  );

  if (promisedDate) {
    try {
      const promiseResponse = await fetch(
        `http://localhost:${process.env.PORT || 5000}/api/promises/receive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recoveryCaseId,
            promisedDate: promisedDate.toISOString(),
            promisedAmount: recoveryCase.amount,
            customerMessage,
          }),
        }
      );

      promiseResult = await promiseResponse.json();

      console.log(
        "Promise-to-Pay integration:",
        promiseResult
      );
    } catch (error) {
      console.error(
        "Promise-to-Pay integration error:",
        error.message
      );
    }
  }
}

// Final OPT-OUT guardrail
if (
  aiResponse.intent === "OPT_OUT" ||
  aiResponse.optOut === true
) {
  conversation.conversationStatus = "STOPPED";

  await conversation.save();

  recoveryCase.status = "STOPPED";
  recoveryCase.stoppingRuleTriggered = true;

  recoveryCase.stoppingReason =
    "Customer requested communication opt-out.";

  // Permanent opt-out
  recoveryCase.optedOut = true;
  recoveryCase.optOutAt = new Date();
  recoveryCase.optOutReason =
    "Customer requested communication opt-out.";

  recoveryCase.recoveryChannel = null;
  recoveryCase.nextActionAt = null;

  await recoveryCase.save();

  await createAuditLog({
    recoveryCase: recoveryCase._id,
    eventType: "STOPPING_RULE_TRIGGERED",
    actor: "CUSTOMER",
    action:
      "Customer opted out of recovery communication.",
    reasoning:
      "Revive immediately stopped automated customer communication.",
    metadata: {
      channel,
      customerMessage,
    },
  });

  return {
    stopped: true,
    optOut: true,
    message:
      "Bilkul, hum aapko further recovery messages nahi bhejenge. 🙏",
  };
}

  // Save agent response
  await saveAgentMessage({
    conversation,
    message:
      aiResponse.message,
    intent:
      aiResponse.intent,
    metadata: {
      needsPromiseToPay:
        aiResponse.needsPromiseToPay,

      promiseDateText:
        aiResponse.promiseDateText,

      needsPaymentLink:
        aiResponse.needsPaymentLink,

      offerAvailable:
        aiResponse.offerAvailable,

      discountAmount:
        aiResponse.discountAmount,

      finalAmount:
        aiResponse.finalAmount,

      offerAccepted:
        aiResponse.offerAccepted,
    },
  });

  // Update context
  conversation.context.customerRequest =
    customerMessage;

  

  if (aiResponse.needsPromiseToPay) {
  const promisedDate = parsePromiseDate(
    aiResponse.promiseDateText
  );

  conversation.context.promisedDate =
    promisedDate;

  conversation.context.promisedAmount =
    recoveryCase.amount;

  if (promisedDate) {
    conversation.conversationStatus =
      "PTP_CAPTURED";
  }
}

  await conversation.save();

  // Audit conversation event
  await createAuditLog({
    recoveryCase:
      recoveryCase._id,
    eventType:
      "RECOVERY_MESSAGE_SENT",
    actor: "REVIVE_AGENT",
    action:
      `AI recovery response sent via ${channel}.`,
    reasoning:
      "Revive generated a personalized Hinglish recovery response using short-term conversation memory and customer long-term memory.",
    metadata: {
      channel,
      intent:
        aiResponse.intent,
      customerMessage,
      agentMessage:
        aiResponse.message,
      shortTermMemoryUsed: true,
      longTermMemoryUsed: true,
      model: MODEL,
    },
  });

  return {
    stopped: false,

    success: true,

    channel,

    intent:
      aiResponse.intent,

    customerMessage,

    response:
      aiResponse.message,

    needsPromiseToPay:
      aiResponse.needsPromiseToPay,

    promiseDateText:
      aiResponse.promiseDateText,


    promiseRecorded:
       Boolean(promiseResult?.success),

    promiseResult:
       promiseResult,  

    needsPaymentLink:
      aiResponse.needsPaymentLink,
    
    offerAvailable:
      aiResponse.offerAvailable,
 
    discountAmount:
      aiResponse.discountAmount,

    finalAmount:
      aiResponse.finalAmount,

    offerAccepted:
      aiResponse.offerAccepted,

    negotiationPaymentLink:
       recoveryCase.negotiation?.paymentLink || null,

    conversationId:
      conversation._id,

    messageCount:
      conversation.messages.length,
  };
};

module.exports = {
  getOrCreateConversation,
  detectBasicIntent,
  generateAIResponse,
  processCustomerMessage,
};