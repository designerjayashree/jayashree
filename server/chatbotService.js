import OpenAI from 'openai';
import { 
  evaluateRuleChatbot, 
  CATALOGUE_INDEX, 
  PUBLIC_BUSINESS_INFO,
  formatCurrency 
} from '../js/ruleChatbot.js';

// Cache for verified model
let activeModel = null;
let openaiClient = null;

// Sliding window in-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

export function checkRateLimit(clientIp) {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIp) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetAt) {
    clientData.count = 1;
    clientData.resetAt = now + RATE_LIMIT_WINDOW_MS;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(clientIp, clientData);

  // Periodic cleanup
  if (rateLimitMap.size > 2000) {
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now > data.resetAt) rateLimitMap.delete(ip);
    }
  }

  return {
    allowed: clientData.count <= MAX_REQUESTS_PER_WINDOW,
    count: clientData.count,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - clientData.count),
    resetInSeconds: Math.ceil((clientData.resetAt - now) / 1000)
  };
}

/**
 * Get or initialize OpenAI SDK client
 */
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Verify requested model or discover the cheapest suitable supported model
 */
export async function verifyOrSelectModel() {
  if (activeModel) return activeModel;

  const targetModel = process.env.OPENAI_MODEL || 'gpt-6-luna';
  const client = getOpenAIClient();

  if (!client) {
    activeModel = targetModel;
    return activeModel;
  }

  try {
    const listRes = await client.models.list();
    const available = (listRes.data || []).map(m => m.id);

    if (available.includes(targetModel)) {
      activeModel = targetModel;
      console.log(`[ChatbotService] Verified requested model '${targetModel}' is available.`);
      return activeModel;
    }

    // Fallback hierarchy: select the cheapest suitable model available on the account
    const preferredOrder = [
      'gpt-6-luna',
      'gpt-5.6-luna',
      'gpt-5-mini',
      'gpt-4.5-mini',
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo'
    ];

    for (const candidate of preferredOrder) {
      if (available.includes(candidate)) {
        activeModel = candidate;
        console.log(`[ChatbotService] Requested model '${targetModel}' not in account list. Using cheapest suitable supported model: '${candidate}'.`);
        return activeModel;
      }
    }

    // Default to targetModel if none matched
    activeModel = targetModel;
    return activeModel;
  } catch (err) {
    console.warn(`[ChatbotService] Could not query models list (${err.message}). Defaulting to '${targetModel}'.`);
    activeModel = targetModel;
    return activeModel;
  }
}

/**
 * System prompt strictly grounded in public Jayashree data
 */
function buildSystemPrompt() {
  return `You are the official Jayashree Fashion Customer Assistant for the Jayashree designer boutique website (jayashreefashion.com).
Your role is to assist customers with collections, product information, prices, sizing, and store policies in a polite, helpful, and concise manner.

STRICT ACCURACY & CATALOGUE FACTS:
1. Brand: Jayashree creates elegant fashion for women, kids, and special occasions.
2. Collections:
   - Women's Wear (Co-Ords, Dresses, Kurtis, Party Wear, Skirts, Tops & Blouses, Trousers & Pants)
   - Kids' Wear (Casual Wear, Customized Kids' Wear, Ethnic Kids' Wear, Girls' Dresses, Party Wear)
   - Bridal Wear (Bridal Lehengas, Bridal Gowns, Bridal Blouses, Bridesmaid Wear, Engagement Wear, Reception Wear, Bridal Accessories)
   - Ethnic Wear (Anarkalis, Kurta Sets, Lehengas, Salwar Suits, Saree Blouses, Sharara Sets, Traditional Dresses)
   - Western Wear (Bodycon Dresses, Co-Ord Sets, Jumpsuits, Skirts, Tops, Trousers, Western Dresses)
3. Pricing Facts:
   - Lowest/Cheapest outfit: Kids' Casual Dresses starting at ₹299. For adult wear, prices start at ₹399 (such as Bridal Belts, Saree Blouses, and Co-Ord Sets).
   - Highest/Most expensive outfit: Traditional Bridal Lehengas in Bridal Wear, ranging up to ₹69,999 (from ₹9,999).
   - Prices range from ₹299 up to ₹69,999 across the 141 catalogue items.
4. Policies:
   - Cancellation: Orders can be cancelled within 24 hours of placing via 'Your Account → My Orders' using the 'Hold to Cancel' button.
   - Delivery: Standard delivery takes 5–7 business days across India with free shipping.
   - Payment: Cash on Delivery (COD) and Online Payment via Razorpay (UPI, Credit/Debit cards, NetBanking).
   - Customisation: Customers can submit measurements via the Customisation page (#/customisation); the team responds within 24–48 hours.
   - Support/Help Centre: Customers can submit queries or report issues via the Help Centre (#/help).
   - Contact: Phone/WhatsApp: +91 9177976293, Email: designerjayashree9@gmail.com, Instagram: @sweet_y7673.
5. Standard Sizes: XS, S, M, L, XL, XXL (Adults); 2-3Y to 12-13Y (Kids); Free Size (Accessories).

SECURITY & PRIVACY RULES:
- Never disclose admin credentials, admin dashboard links, database keys, or internal system configurations.
- Never reveal other customers' personal data, phone numbers, emails, or private orders.
- For order tracking and cancellation, instruct customers to check their orders under 'Your Account → My Orders' (#/account).
- Politely refuse off-topic questions (e.g. general knowledge, programming, politics, other companies).
- Keep answers concise, factual, and friendly. Use Indian currency format (e.g. ₹1,299).`;
}

/**
 * Handle incoming chat requests
 */
export async function handleChatMessage({ message, history = [], authUser = null, clientIp = '127.0.0.1' }) {
  // 1. Rate Limit Check
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return {
      status: 429,
      success: false,
      error: `Too many requests. Please wait ${rateLimit.resetInSeconds} seconds before sending another message.`,
      answer: `You are sending messages too quickly. Please wait a moment before asking again.`
    };
  }

  // 2. Validate Message Length
  const cleaned = (message || '').trim();
  if (!cleaned) {
    return {
      status: 400,
      success: false,
      answer: "Welcome to Jayashree! How can I help you today?"
    };
  }

  if (cleaned.length > 500) {
    return {
      status: 400,
      success: false,
      answer: "Your message is too long. Please keep your question under 500 characters."
    };
  }

  // 3. Authenticated Order Inquiries Check
  const isOrderQuery = /\b(?:where\s+is\s+my\s+order|track\s+(?:my\s+)?order|status\s+of\s+my\s+order|order\s+status|cancel\s+(?:my\s+)?order)\b/i.test(cleaned);
  if (isOrderQuery) {
    if (!authUser) {
      return {
        status: 200,
        success: true,
        source: 'auth_prompt',
        answer: "To view your order status or cancel an order, please sign in to your Jayashree account and visit [Your Account → My Orders](#/account). You can also contact our support team at +91 9177976293 with your registered phone number."
      };
    }
  }

  // 4. Deterministic Rule Engine First (Zero API cost & 0ms latency)
  const ruleEvaluation = evaluateRuleChatbot(cleaned);
  // High confidence deterministic rule match that is NOT an unavailable/off-topic fallback
  if (
    ruleEvaluation && 
    ruleEvaluation.intent && 
    ruleEvaluation.intent !== 'fashion_query_unavailable' && 
    ruleEvaluation.intent !== 'unrecognized_refusal'
  ) {
    return {
      status: 200,
      success: true,
      source: 'deterministic_rule',
      answer: ruleEvaluation.answer,
      intent: ruleEvaluation.intent,
      suggestedChips: ruleEvaluation.suggestedChips || null
    };
  }

  // 5. OpenAI API Fallback for Natural-Language / Nuanced Customer Queries
  const client = getOpenAIClient();
  if (!client) {
    // If OpenAI API key is not configured yet, return rule evaluation cleanly
    return {
      status: 200,
      success: true,
      source: 'rule_fallback_no_api_key',
      answer: ruleEvaluation ? ruleEvaluation.answer : "I'm here to help with Jayashree's fashion collections, product information and store policies. How can I assist you?"
    };
  }

  try {
    const modelToUse = await verifyOrSelectModel();

    // Prepare bounded conversation history (max last 2 turns to minimize token cost)
    const formattedHistory = [];
    if (Array.isArray(history)) {
      const recent = history.slice(-4);
      for (const turn of recent) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          formattedHistory.push({
            role: turn.role,
            content: String(turn.content || '').slice(0, 300)
          });
        }
      }
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...formattedHistory,
      { role: 'user', content: cleaned }
    ];

    const completion = await client.chat.completions.create({
      model: modelToUse,
      messages,
      max_completion_tokens: 250
    });

    const aiReply = completion.choices?.[0]?.message?.content?.trim();

    return {
      status: 200,
      success: true,
      source: 'openai_api',
      model: modelToUse,
      answer: aiReply || ruleEvaluation.answer
    };
  } catch (err) {
    console.error('[ChatbotService] OpenAI API error:', err.message);
    // Graceful fallback to deterministic rule response on API error / quota limit
    return {
      status: 200,
      success: true,
      source: 'rule_fallback_api_error',
      answer: ruleEvaluation?.answer || "I'm sorry, I'm currently unable to process your request with our AI service. Please visit our [Help Centre](#/help) or contact us directly at +91 9177976293."
    };
  }
}
