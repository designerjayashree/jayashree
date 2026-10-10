/**
 * Jayashree Fashion Website — Strictly Rule-Based Customer Chatbot Engine
 * 
 * STRICT ARCHITECTURAL CONSTRAINTS:
 * 1. Zero AI models, zero external APIs, zero network calls, zero API keys.
 * 2. Source of truth is STRICTLY the public catalogData.js and approved customer-facing policies/contacts.
 * 3. Never accesses admin collections, customer orders, private database records, credentials or secret keys.
 * 4. Deterministic pattern, keyword, and catalogue lookup with typo tolerance.
 * 5. Concise, direct answers without unnecessary promotional text, unsolicited category lists, or marketing paragraphs.
 * 6. Stateful clarification context for multi-collection disambiguation.
 */

import { 
  BRIDAL_CATEGORIES, 
  ETHNIC_CATEGORIES, 
  KIDS_CATEGORIES, 
  WESTERN_CATEGORIES, 
  WOMEN_CATEGORIES 
} from './catalogData.js';

// Standard Approved Refusal Messages (Verbatim per specifications)
export const REFUSAL_OFF_TOPIC = "I'm here to help with Jayashree's fashion collections, product information and publicly available business details. I can't help with that request.";
export const REFUSAL_UNAVAILABLE = "I'm sorry, that information isn't available on our website. Please contact the Jayashree team for assistance.";

// Approved Public Business Information
export const PUBLIC_BUSINESS_INFO = {
  designerName: "Jayashree",
  description: "Jayashree creates simple, elegant fashion for women, kids, and special occasions.",
  phone: "+91 9177976293",
  phoneFormatted: "+91 9177976293",
  email: "designerjayashree9@gmail.com",
  instagramHandle: "sweet_y7673",
  instagramUrl: "https://www.instagram.com/sweet_y7673?stkn=MWJsczkzMWcyZW8yYQ%3D%3D&utm_source=ig_contact_invite",
  standardSizes: ["XS", "S", "M", "L", "XL", "XXL"],
  kidsSizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y", "12-13Y"],
  accessoriesSizes: ["Free Size"],
  cancellationWindowHours: 24,
  deliveryTimeline: "5–7 business days across India",
  shippingFee: "Free standard delivery on orders",
  paymentMethods: "Cash on Delivery (COD) and Online Payment via Razorpay (UPI, Credit/Debit Cards, NetBanking)",
  customisationResponseTime: "24–48 hours"
};

/**
 * Format currency with Indian thousands separators (e.g., ₹1299 -> ₹1,299)
 */
export function formatCurrency(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return '';
  return priceStr.replace(/\d+/g, (n) => Number(n).toLocaleString('en-IN'));
}

// Typo and alias normalization map
const TYPO_MAP = {
  // Cancellation variations
  "cancle": "cancel",
  "cancelling": "cancel",
  "canceld": "cancel",
  "cancell": "cancel",
  "cancl": "cancel",
  "cancelation": "cancellation",
  "cancellations": "cancellation",

  // Customisation variations
  "custamize": "customise",
  "custamise": "customise",
  "costomize": "customise",
  "customize": "customise",
  "customised": "customise",
  "customized": "customise",
  "customising": "customise",
  "customizing": "customise",
  "customisation": "customisation",
  "customization": "customisation",
  "tailor": "tailor",
  "tailoring": "tailor",
  "stiching": "stitch",
  "stitching": "stitch",
  "bespoke": "bespoke",

  // Clothing item typos
  "lehanga": "lehenga",
  "lengha": "lehenga",
  "lehnga": "lehenga",
  "lahanga": "lehenga",
  "lehengas": "lehenga",
  "sari": "saree",
  "saris": "saree",
  "sarees": "saree",
  "curti": "kurti",
  "curtis": "kurti",
  "curtiz": "kurti",
  "kurtis": "kurti",
  "kurtiz": "kurti",
  "kurta": "kurta",
  "kurtas": "kurta",
  "anarkaly": "anarkali",
  "anarkalis": "anarkali",
  "shararas": "sharara",
  "shararah": "sharara",
  "jumpsuits": "jumpsuit",
  "jumpsut": "jumpsuit",
  "dupata": "dupatta",
  "dupattas": "dupatta",
  "blouses": "blouse",
  "blowse": "blouse",
  "coord": "co-ord",
  "coords": "co-ord",
  "co-ords": "co-ord",
  "gowns": "gown",

  // Delivery typos
  "delivary": "delivery",
  "dilvery": "delivery",
  "delevery": "delivery",
  "delvery": "delivery",
  "shipping": "delivery",
  "shippment": "delivery",
  "dispatch": "delivery",

  // Payment typos
  "paymnt": "payment",
  "pymnt": "payment",
  "razorpay": "payment",
  "gpay": "payment",
  "phonepe": "payment",
  "paytm": "payment",
  "upi": "payment",
  "cod": "cod",

  // Contact typos
  "phne": "phone",
  "numbr": "phone",
  "moble": "phone",
  "mobile": "phone",
  "whatapp": "whatsapp",
  "insta": "instagram",
  "instagrm": "instagram",
  "ig": "instagram",
  "contct": "contact",
  "cntact": "contact",

  // Support & Issue typos
  "issu": "issue",
  "isue": "issue",
  "issuse": "issue",
  "issuu": "issue",
  "problm": "problem",
  "probleem": "problem",
  "complnt": "complaint",
  "complent": "complaint",
  "complain": "complaint",
  "complant": "complaint",
  "suport": "support",
  "supprt": "support",
  "suppor": "support",
  "asistance": "assistance",
  "asist": "assistance",
  "admn": "admin",
  "admim": "admin",
  "hav": "have",
  "ordr": "order",
  "oder": "order",
  "odr": "order",
  "ordrs": "orders"
};

/**
 * Normalizes input string for reliable keyword and regex matching
 */
export function normalizeQuestion(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  
  let text = rawInput.toLowerCase();
  
  // Replace punctuation with spaces except hyphens and currency symbols
  text = text.replace(/[^a-z0-9\s₹\-\–]/gi, ' ');
  
  // Split tokens, apply typo dictionary, and rejoin
  const tokens = text.split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.map(tok => TYPO_MAP[tok] || tok);
  
  return normalizedTokens.join(' ');
}

/**
 * Canonical normalizer for product matching across punctuation, ampersands, singular/plural, hyphens
 */
export function canonicalize(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.toLowerCase();
  // Normalize & to and
  s = s.replace(/&/g, ' and ');
  // Normalize co-ord variations
  s = s.replace(/co[\-\s]?ords?/g, 'coord');
  // Strip non-alphanumeric
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  // Singularize common fashion nouns
  const tokens = s.split(/\s+/).filter(Boolean).map(w => {
    const typoMapped = TYPO_MAP[w] || w;
    if (typoMapped.endsWith('ies')) return typoMapped.slice(0, -3) + 'y';
    if (typoMapped.endsWith('sses')) return typoMapped.slice(0, -2);
    if (typoMapped.endsWith('s') && !typoMapped.endsWith('ss') && typoMapped.length > 3) return typoMapped.slice(0, -1);
    return typoMapped;
  });
  return tokens.join(' ');
}

/**
 * Checks if question is specifically asking about prices
 */
function isPriceQuestion(text) {
  return /\b(?:price|prices|cost|costs|rate|rates|how\s+much|how\s+much\s+is|how\s+much\s+are|pricing)\b/i.test(text);
}

/**
 * Flattens and indexes all customer-visible catalogue items for exact matching
 */
function buildCatalogueIndex() {
  const items = [];
  const categoryGroups = [
    { catKey: 'women', label: "Women's Wear", data: WOMEN_CATEGORIES, route: "#/women", defaultSizes: PUBLIC_BUSINESS_INFO.standardSizes },
    { catKey: 'kids', label: "Kids' Wear", data: KIDS_CATEGORIES, route: "#/kids", defaultSizes: PUBLIC_BUSINESS_INFO.kidsSizes },
    { catKey: 'bridal', label: "Bridal Wear", data: BRIDAL_CATEGORIES, route: "#/bridal", defaultSizes: PUBLIC_BUSINESS_INFO.standardSizes },
    { catKey: 'ethnic', label: "Ethnic Wear", data: ETHNIC_CATEGORIES, route: "#/ethnic", defaultSizes: PUBLIC_BUSINESS_INFO.standardSizes },
    { catKey: 'western', label: "Western Wear", data: WESTERN_CATEGORIES, route: "#/western", defaultSizes: PUBLIC_BUSINESS_INFO.standardSizes }
  ];

  for (const group of categoryGroups) {
    for (const [subKey, subVal] of Object.entries(group.data)) {
      const subLabel = subVal.label;
      for (const item of subVal.items) {
        items.push({
          categoryKey: group.catKey,
          categoryLabel: group.label,
          categoryRoute: group.route,
          subCategoryKey: subKey,
          subCategoryLabel: subLabel,
          name: item.name,
          normalizedName: normalizeQuestion(item.name),
          canonicalName: canonicalize(item.name),
          rawPrice: item.price,
          formattedPrice: formatCurrency(item.price),
          catalogueNum: item.num,
          image: item.img,
          sizes: item.sizes || group.defaultSizes
        });
      }
    }
  }
  return items;
}

export const CATALOGUE_INDEX = buildCatalogueIndex();

/**
 * Stateful conversation memory for multi-collection clarification questions
 */
export let conversationState = {
  pendingClarification: null
};

export function resetConversationState() {
  conversationState = {
    pendingClarification: null
  };
}

export function getConversationState() {
  return conversationState;
}

/**
 * Resolves customer's collection selection against pending matched items
 */
export function resolveCategorySelection(userInput, matchedItems) {
  if (!userInput || typeof userInput !== 'string' || !matchedItems || matchedItems.length === 0) {
    return null;
  }
  const raw = userInput.trim();
  const lower = raw.toLowerCase();
  const canon = canonicalize(raw);

  // Check numeric options: "1", "first", "2", "second", etc.
  if (/^(?:1|first|option\s*1)\b/i.test(lower) && matchedItems[0]) return matchedItems[0];
  if (/^(?:2|second|option\s*2)\b/i.test(lower) && matchedItems[1]) return matchedItems[1];
  if (/^(?:3|third|option\s*3)\b/i.test(lower) && matchedItems[2]) return matchedItems[2];

  for (const item of matchedItems) {
    if (lower.includes(item.categoryKey)) return item;
    if (lower.includes(item.categoryLabel.toLowerCase())) return item;
    if (canon.includes(item.categoryKey)) return item;
    if (item.categoryKey === 'women' && /\b(?:women|womens|women's)\b/i.test(lower)) return item;
    if (item.categoryKey === 'western' && /\bwestern\b/i.test(lower)) return item;
    if (item.categoryKey === 'kids' && /\b(?:kid|kids|kids'|child|children)\b/i.test(lower)) return item;
    if (item.categoryKey === 'bridal' && /\b(?:bridal|bride)\b/i.test(lower)) return item;
    if (item.categoryKey === 'ethnic' && /\bethnic\b/i.test(lower)) return item;
  }
  return null;
}

/**
 * Checks if question is specifically asking about sizes
 */
function isSizeQuestion(text) {
  return /\b(?:size|sizes|sizing|measurement|measurements|fit|fitting|xs|xxl)\b/i.test(text);
}

/**
 * Searches customer-visible products across the full catalogue
 */
function findProductMatches(query) {
  const qCanon = canonicalize(query);
  const qNorm = normalizeQuestion(query);
  const qLower = query.toLowerCase();

  const candidates = [];
  for (const item of CATALOGUE_INDEX) {
    // Exclude generic broad multi-category terms when asked standalone so they trigger proper overview
    const genericBroad = ['bridal lehengas', 'saree blouses', 'co-ord sets', 'coord sets'];
    if (genericBroad.includes(item.name.toLowerCase()) && 
        !qLower.includes('kids') && !qLower.includes('women') && 
        !qLower.includes('ethnic') && !qLower.includes('western')) {
      continue;
    }

    if (qCanon.includes(item.canonicalName) || qNorm.includes(item.normalizedName) || qLower.includes(item.name.toLowerCase())) {
      candidates.push(item);
    }
  }

  if (candidates.length === 0) return [];

  // Sort and retain only longest/most specific canonical match
  const maxLen = Math.max(...candidates.map(m => m.canonicalName.length));
  const bestCandidates = candidates.filter(m => m.canonicalName.length === maxLen);

  // If there are exact name matches among best candidates, prioritize them over loose canonical matches
  const exactNameMatches = bestCandidates.filter(it => 
    qLower.includes(it.name.toLowerCase()) || qNorm.includes(it.normalizedName)
  );
  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  return bestCandidates;
}

/**
 * Checks if customer's response is changing topics or asking another question
 */
function isTopicChangeOrNewQuestion(raw, normalized, currentProductName) {
  // Greetings
  if (/^(?:hi|hello|hey|namaste|good\s+morning|good\s+afternoon|good\s+evening)\b/i.test(normalized)) return true;

  // Support, Help Centre, or admin contact
  if (/\b(?:help|support|admin|issue|problem|complaint|ticket|browse|order|how\s+to)\b/i.test(normalized)) return true;

  // Policies
  if (/\b(?:cancel|cancellation|deliver|delivery|shipping|payment|pay|cod|customis|customiz|tailor|stitch)\b/i.test(normalized)) return true;

  // Contact
  if (/\b(?:phone|call|mobile|number|email|gmail|instagram|insta|ig|contact|reach)\b/i.test(normalized)) return true;

  // Sizes
  if (isSizeQuestion(normalized)) return true;

  // Unavailable domains
  if (/\b(?:men|mens|men's|shoes|footwear|heels|jewellery|jewelry|coupon|discount|boutique\s+address|walk-in)\b/i.test(normalized)) return true;

  // Another distinct catalogue item
  const otherMatches = findProductMatches(raw);
  if (otherMatches.length > 0 && !otherMatches.some(m => m.name.toLowerCase() === currentProductName.toLowerCase())) {
    return true;
  }

  // Price or new question pattern inquiry
  if (isPriceQuestion(normalized) || /\b(?:what\s+is|what\s+are|how\s+much)\b/i.test(normalized)) return true;

  return false;
}

/**
 * Main Rule Evaluation Engine
 * Returns an object: { answer: string, intent: string, suggestedChips?: string[] }
 */
export function evaluateRuleChatbot(userInput) {
  if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
    return {
      answer: "Welcome to Jayashree! How can I help you today?",
      intent: "empty_query",
      suggestedChips: [
        "What are your product prices?",
        "What sizes are available?",
        "What is your cancellation policy?",
        "What types of bridal wear do you offer?",
        "How can I contact Jayashree?"
      ]
    };
  }

  const raw = userInput.trim();
  const normalized = normalizeQuestion(raw);

  // --------------------------------------------------------------------------
  // RULE 1: STRICT SECURITY, ADMIN & DATA PRIVACY BOUNDARY
  // Never access or reveal admin dashboard, private customer orders, credentials, private tables
  // --------------------------------------------------------------------------

  // Detect legitimate customer support / Help Centre contact inquiries directed to admin/team
  const isAdminSupportInquiry = /\b(?:contact|reach|send\b.*?\b(?:to|for)|ask|talk\s+to|speak\s+with|report\b.*?\bto|message|write\s+to)\s+(?:the\s+)?admin\b/i.test(raw) ||
    /\badmin\s+(?:support|contact|help|assistance)\b/i.test(normalized) ||
    /\b(?:issue|problem|complaint|question|query|help)\b.*?\b(?:with|for|to)\s+(?:the\s+)?admin\b/i.test(raw) ||
    /\bhow\s+(?:can|do)\s+i\s+(?:ask|contact|reach|send\b.*?\bto)\s+(?:the\s+)?admin\b/i.test(raw);

  // Probes for admin dashboard, panel, credentials, passwords, login, or internal admin systems
  const adminProbeRegex = /\b(?:admin\s+(?:dashboard|panel|portal|login|screen|view|credentials?|passwords?|access|records?|data|table|console|privileges?|token|secret|system|orders?|account|role|override|auth)|dashboard)\b/i;

  // Probes for other customers' data, orders database dumps, or backend injection attacks
  const privateDataProbeRegex = /\b(?:another\s+customers?|other\s+customers?|someone\s+else|all\s+orders|customer\s+data|customers?\s+data|customer\s+phones?|customers?\s+phones?|customer\s+emails?|customers?\s+emails?|customers?\s+orders?|customer\s+address|customers?\s+address|customer\s+records?|user\s+list|users\s+collection|orders\s+collection|all\s+users|\borders\b.*?\b(?:from|where|status|table|list)|select\b.*?\bfrom|insert\b.*?\binto|update\b.*?\bset|delete\b.*?\bfrom|drop\b\s+table|where\b\s+\w+\s*=|passwords?|secrets?|credentials?|firebase|firestore|database|databases|revenue|profit|tokens?|env|private\s+key|api\s+keys?|hack|bypass|system\s+prompt|roleplay|ignore\s+all|override)\b/i;

  // Block unauthorized admin probes that are not support inquiries (e.g. "admin", "show admin", etc.)
  const isUnauthorizedAdminProbe = /\badmin\b/i.test(raw) && !isAdminSupportInquiry;

  if (adminProbeRegex.test(raw) || adminProbeRegex.test(normalized) ||
      privateDataProbeRegex.test(raw) || privateDataProbeRegex.test(normalized) ||
      isUnauthorizedAdminProbe) {
    conversationState.pendingClarification = null;
    return {
      answer: REFUSAL_OFF_TOPIC,
      intent: "security_boundary_refusal"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 2: STRICT OFF-TOPIC CHECK
  // Refuses general knowledge, coding, homework, politics, weather, recipes, etc.
  // --------------------------------------------------------------------------
  const offTopicRegex = /\b(?:python|javascript|java|c\+\+|coding|write\s+code|source\s+code|programming|algorithm|homework|solve|math|weather|temperature|climate|politics|political|president|prime\s+minister|election|crypto|bitcoin|recipe|cooking|food|cricket|football|sports|score|news|movie|actor|actress|chatgpt|openai|gemini|deepseek|claude|who\s+are\s+you|who\s+made\s+you|tell\s+me\s+a\s+joke|capital\s+of\b)\b/i;
  if (offTopicRegex.test(raw) || offTopicRegex.test(normalized)) {
    conversationState.pendingClarification = null;
    return {
      answer: REFUSAL_OFF_TOPIC,
      intent: "off_topic_refusal"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 0: RESOLVE PENDING CLARIFICATION CONTEXT
  // When the chatbot previously asked which collection the customer meant
  // --------------------------------------------------------------------------
  if (conversationState.pendingClarification) {
    const pending = conversationState.pendingClarification;

    // Check if customer selected one of the matching collections
    const resolvedItem = resolveCategorySelection(raw, pending.matchedItems);
    if (resolvedItem) {
      conversationState.pendingClarification = null;
      const verb = resolvedItem.name.endsWith('s') && !resolvedItem.name.endsWith('ss') && !resolvedItem.name.endsWith('Set') ? 'cost' : 'costs';
      return {
        answer: `${resolvedItem.categoryLabel} ${resolvedItem.name} ${verb} ${resolvedItem.formattedPrice}.`,
        intent: "product_price_clarified"
      };
    }

    // Check if customer changed topics or asked a new distinct question
    if (isTopicChangeOrNewQuestion(raw, normalized, pending.productName)) {
      conversationState.pendingClarification = null;
      // Fall through to evaluate the new question below
    } else {
      // Check if customer asked for a known general collection that isn't available for this product
      const generalCollections = [
        { key: 'women', label: "Women's Wear", pattern: /\b(?:women|womens|women's)\b/i },
        { key: 'western', label: "Western Wear", pattern: /\bwestern\b/i },
        { key: 'kids', label: "Kids' Wear", pattern: /\b(?:kid|kids|kids'|child|children)\b/i },
        { key: 'bridal', label: "Bridal Wear", pattern: /\b(?:bridal|bride)\b/i },
        { key: 'ethnic', label: "Ethnic Wear", pattern: /\bethnic\b/i }
      ];

      const requestedInvalidCat = generalCollections.find(gc => 
        gc.pattern.test(raw) && !pending.matchedItems.some(it => it.categoryKey === gc.key)
      );

      if (requestedInvalidCat) {
        const availableOptions = pending.matchedItems.map(it => `${it.categoryLabel} (${it.formattedPrice})`).join(' and ');
        return {
          answer: `${pending.productName} is only available in ${availableOptions}. Which collection are you looking for?`,
          intent: "invalid_collection_clarification",
          suggestedChips: pending.matchedItems.map(it => it.categoryLabel)
        };
      }

      // Unrecognized response: politely re-prompt for clarification without dropping context
      const availableOptions = pending.matchedItems.map(it => `${it.categoryLabel} (${it.formattedPrice})`).join(' and ');
      return {
        answer: `We have ${pending.productName} in ${availableOptions}. Which collection are you looking for?`,
        intent: "pending_clarification_reminder",
        suggestedChips: pending.matchedItems.map(it => it.categoryLabel)
      };
    }
  }

  // --------------------------------------------------------------------------
  // RULE 3: PERMITTED DOMAIN BUT INFORMATION UNAVAILABLE ON WEBSITE
  // Items/services in general fashion/shopping but not published on Jayashree website
  // --------------------------------------------------------------------------
  const unavailableDomainRegex = /\b(?:men|mens|men's|male|boys?|shoes|footwear|sandals|heels|slippers|sneakers|boots|jewellery|jewelry|earrings|necklace|bangles|physical\s+store|walk-in|boutique\s+address|shop\s+address|visit\s+store|store\s+location|discount\s+coupon|promo\s+code|coupon\s+code|coupon|voucher|50%\s+off|sale\s+offer|winter\s+coat|leather\s+jacket)\b/i;
  if (unavailableDomainRegex.test(raw) || unavailableDomainRegex.test(normalized)) {
    return {
      answer: REFUSAL_UNAVAILABLE,
      intent: "unavailable_on_website"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 4: GREETINGS
  // --------------------------------------------------------------------------
  const greetingRegex = /^(?:hi|hello|hey|namaste|good\s+morning|good\s+afternoon|good\s+evening|greetings)(?:\s+there|\s+jayashree)?$/i;
  if (greetingRegex.test(normalized)) {
    return {
      answer: "Welcome to Jayashree! How can I help you today?",
      intent: "greeting",
      suggestedChips: [
        "What are your product prices?",
        "What sizes are available?",
        "What is your cancellation policy?",
        "What types of bridal wear do you offer?",
        "How can I contact Jayashree?"
      ]
    };
  }

  // --------------------------------------------------------------------------
  // RULE 4.5: CUSTOMER SUPPORT & HELP CENTRE GUIDANCE
  // Directs customer issues, complaints, and requests to the existing Help Centre
  // --------------------------------------------------------------------------

  // A. How to submit and follow up on a support request / complaint
  if (/\b(?:submit|file|lodge|track|follow\s*up)\b.*?\b(?:support|complaint|ticket|request|issue)\b/i.test(normalized) ||
      /\bhow\s+(?:do|can)\s+i\s+(?:submit|track|follow\s*up\s+on)\s+(?:a\s+)?(?:support\s+request|complaint|issue|ticket)\b/i.test(normalized)) {
    return {
      answer: "To submit a support request, go to our [Help Centre](#/help), enter your query, and click Submit. Our team reviews all requests and will follow up with you via your registered email address.",
      intent: "submit_followup_support",
      suggestedChips: ["Help Centre", "Cancellation Policy", "How to place an order", "Delivery Information"]
    };
  }

  // B. Payment failed or payment deduction issues
  if (/\b(?:payment|pay|money|amount|transaction)\b.*?\b(?:fail\w*|debit\w*|deduct\w*|error|declined|stuck|problem|issue)\b/i.test(normalized) ||
      /\b(?:failed|deducted|debited)\b.*?\b(?:payment|money|amount)\b/i.test(normalized) ||
      /\b(?:report|problem\s+with|issue\s+with)\b.*?\b(?:payment|transaction)\b/i.test(normalized)) {
    return {
      answer: "If your payment failed or was debited without order confirmation, please check your bank account or UPI app (failed payments are usually refunded by your bank within 3–5 working days). To report the issue, please visit our [Help Centre](#/help) or contact us at +91 9177976293.",
      intent: "payment_issue_support",
      suggestedChips: ["Help Centre", "Payment Methods", "Contact Jayashree"]
    };
  }

  // C. Customisation request problem or issue
  if (/\b(?:issue|problem|delay\w*|help|status|complaint)\b.*?\b(?:customis\w*|customiz\w*|tailor\w*)\b/i.test(normalized) ||
      /\b(?:customis\w*|customiz\w*|tailor\w*)\b.*?\b(?:issue|problem|delay\w*|complaint)\b/i.test(normalized)) {
    return {
      answer: "For issues with a customisation request, please visit our [Help Centre](#/help) and submit your details, or contact our design team directly via WhatsApp or phone at +91 9177976293.",
      intent: "customisation_issue_support",
      suggestedChips: ["Help Centre", "Customisation Process", "Contact Jayashree"]
    };
  }

  // D. Order assistance, order tracking, or order problem
  if (/\b(?:where\s+is|track|status\s+of)\b.*?\b(?:order|delivery|package)\b/i.test(normalized) ||
      /\b(?:order|delivery|package)\s+status\b/i.test(normalized) ||
      /\b(?:issue|problem|help|assistance|complaint|delay\w*|status|trouble)\b.*?\b(?:order|delivery|shipment|package)\b/i.test(normalized) ||
      /\b(?:order|delivery|package)\b.*?\b(?:issue|problem|complaint|delayed|wrong|damaged|missing|help|assistance)\b/i.test(normalized)) {
    return {
      answer: "To check the status of your order, please visit [Your Account → My Orders](#/account). For any issues or tracking support, you can also submit a request in our [Help Centre](#/help) or contact us via WhatsApp/call at +91 9177976293.",
      intent: "order_issue_support",
      suggestedChips: ["Help Centre", "Cancellation Policy", "Delivery Information"]
    };
  }

  // E. General Help Centre, Admin Contact, or Support Inquiries
  if (isAdminSupportInquiry ||
      /\b(?:help\s+centre|help\s+center|customer\s+support|customer\s+care|support\s+request|contact\s+support|support\s+team)\b/i.test(normalized) ||
      /\b(?:report\s+(?:a\s+)?(?:problem|issue|bug)|submit\s+(?:a\s+)?(?:complaint|issue|ticket|request)|file\s+(?:a\s+)?complaint)\b/i.test(normalized) ||
      /\b(?:where|how)\s+(?:can|do)\s+i\s+(?:ask\s+for\s+assistance|get\s+help|contact\s+support|submit\s+a\s+support\s+request|reach\s+support)\b/i.test(normalized) ||
      /\bi\s+have\s+an?\s+issue\b/i.test(normalized) ||
      /\bi\s+need\s+help\b/i.test(normalized)) {
    return {
      answer: "You can contact the Jayashree team through the [Help Centre](#/help) on our website. Open the Help Centre and submit your issue there, and our team will get back to you soon. You can also reach us directly by phone or WhatsApp at +91 9177976293.",
      intent: "help_centre_support",
      suggestedChips: ["Help Centre", "Contact Details", "Cancellation Policy", "How to place an order"]
    };
  }

  // --------------------------------------------------------------------------
  // RULE 4.6: WEBSITE HOW-TO & NAVIGATION GUIDANCE
  // Guides customer through browsing, ordering, and understanding site features
  // --------------------------------------------------------------------------

  // A. How to browse product categories
  if (/\bhow\s+(?:do|can)\s+i\s+browse\b/i.test(normalized) ||
      /\bhow\s+to\s+browse\b.*?\b(?:categor\w*|collection\w*|product\w*|item\w*|design\w*)\b/i.test(normalized) ||
      /\bbrowse\s+(?:product\s+)?categor\w*\b/i.test(normalized) ||
      /\bbrowse\s+collections?\b/i.test(normalized)) {
    return {
      answer: "You can browse our collections—Women's Wear, Kids' Wear, Bridal Wear, Ethnic Wear, and Western Wear—by selecting any category from the top navigation bar or mobile menu.",
      intent: "how_to_browse_categories",
      suggestedChips: ["Product Prices", "Available Sizes", "How to place an order"]
    };
  }

  // B. How to find product prices and available sizes
  if (/\b(?:how\s+to\s+find|how\s+(?:do|can)\s+i\s+find|where\s+(?:can\s+i\s+find|are))\b.*?\b(?:prices?|costs?|sizes?)\b.*?\b(?:sizes?|prices?)\b/i.test(normalized) ||
      /\b(?:find|check|see)\b.*?\b(?:prices?\s+and\s+sizes?|sizes?\s+and\s+prices?)\b/i.test(normalized) ||
      /\bhow\s+(?:to\s+find|do\s+i\s+find|can\s+i\s+find)\s+(?:product\s+)?(?:prices?|sizes?)\b/i.test(normalized)) {
    return {
      answer: "Product prices and available sizes are listed on each product card in the catalogue. You can also ask me directly for the price and sizes of any design.",
      intent: "how_to_find_prices_and_sizes",
      suggestedChips: ["Product Prices", "Available Sizes", "How to place an order"]
    };
  }

  // C. How to place an order
  if (/\bhow\s+(?:do|can)\s+i\s+(?:place\s+an\s+order|buy|order|purchase)\b/i.test(normalized) ||
      /\bhow\s+to\s+(?:place\s+an\s+order|order|buy|purchase)\b/i.test(normalized) ||
      /\bsteps\s+to\s+order\b/i.test(normalized)) {
    return {
      answer: "To place an order, select your item and size, click Add to Bag, go to your Bag, enter your delivery address, and proceed to checkout using Cash on Delivery (COD) or Online Payment.",
      intent: "how_to_place_order",
      suggestedChips: ["Payment Methods", "Delivery Information", "Cancellation Policy"]
    };
  }

  // D. How to request customisation
  if (/\bhow\s+(?:do|can)\s+i\s+(?:request\s+customis\w*|request\s+customiz\w*|get\s+customis\w*|customize|customise)\b/i.test(normalized) ||
      /\bhow\s+to\s+(?:request\s+customis\w*|request\s+customiz\w*|customise|customize)\b/i.test(normalized) ||
      /\bsteps\s+(?:for|to)\s+customis\w*\b/i.test(normalized)) {
    return {
      answer: "To request customisation, visit our [Customisation](#/customisation) page, select your category, enter your design requirements and measurements, and submit your request. Our team will contact you within 24–48 hours.",
      intent: "how_to_request_customisation",
      suggestedChips: ["Customisation Timeline", "Available Sizes", "Contact Jayashree"]
    };
  }

  // E. How to find delivery information
  if (/\b(?:how|where)\s+(?:can|do)\s+i\s+find\s+delivery\b/i.test(normalized) ||
      /\bhow\s+to\s+find\s+delivery\b/i.test(normalized) ||
      /\bdelivery\s+information\b/i.test(normalized) ||
      /\bshipping\s+information\b/i.test(normalized)) {
    return {
      answer: "Standard delivery takes 5–7 business days across India with free shipping on all orders. You can track your order status in Your Account → My Orders.",
      intent: "how_to_find_delivery_info",
      suggestedChips: ["Cancellation Policy", "How to place an order", "Payment Methods"]
    };
  }

  // F. Where can I find cancellation policy / How to understand cancellation policy
  if (/\b(?:where\s+can\s+i\s+find|where\s+is|how\s+to\s+understand)\b.*?\bcancell\w*\b/i.test(normalized) ||
      /\bwhere\s+is\s+the\s+cancellation\b/i.test(normalized)) {
    return {
      answer: "You can cancel your order within 24 hours of placing it from Your Account → My Orders using the Hold to Cancel button.",
      intent: "cancellation_policy",
      suggestedChips: ["Delivery Information", "How to place an order", "Help Centre"]
    };
  }

  // G. How to use available payment methods / Available payment options / COD
  if (/\bhow\s+(?:do|can)\s+i\s+use\s+(?:available\s+)?payment\b/i.test(normalized) ||
      /\bavailable\s+payment\s+methods\b/i.test(normalized) ||
      /\bpayment\s+methods\b/i.test(normalized)) {
    return {
      answer: "We accept Cash on Delivery (COD) as well as online payments via Razorpay (UPI, Credit/Debit Cards, NetBanking) at checkout.",
      intent: "payment_policy",
      suggestedChips: ["How to place an order", "Delivery Information", "Help Centre"]
    };
  }

  // --------------------------------------------------------------------------
  // RULE 5: PUBLIC BUSINESS CONTACT INFORMATION (Direct & Specific)
  // --------------------------------------------------------------------------
  // Specific Instagram ID query
  if (/\b(?:instagram|insta|ig)\b/i.test(normalized)) {
    return {
      answer: `Our Instagram ID is @${PUBLIC_BUSINESS_INFO.instagramHandle}.`,
      intent: "instagram_info"
    };
  }

  // Specific Phone / Contact Number query
  if (/\b(?:phone|call|mobile|number|whatsapp)\b/i.test(normalized) && !normalized.includes('catalogue')) {
    return {
      answer: `Our contact number is ${PUBLIC_BUSINESS_INFO.phoneFormatted}.`,
      intent: "phone_info"
    };
  }

  // Specific Email query
  if (/\b(?:email|gmail|mail)\b/i.test(normalized)) {
    return {
      answer: `Our email address is ${PUBLIC_BUSINESS_INFO.email}.`,
      intent: "email_info"
    };
  }

  // General contact query
  if (/\b(?:contact|reach|get\s+in\s+touch|how\s+can\s+i\s+contact)\b/i.test(normalized)) {
    return {
      answer: `You can reach us by phone/WhatsApp at ${PUBLIC_BUSINESS_INFO.phoneFormatted}, email at ${PUBLIC_BUSINESS_INFO.email}, or Instagram @${PUBLIC_BUSINESS_INFO.instagramHandle}.`,
      intent: "general_contact_info"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 6: STORE POLICIES (Brief, accurate summaries)
  // --------------------------------------------------------------------------
  // Cancellation policy
  if (/\b(?:cancel|cancellation)\b/i.test(normalized)) {
    return {
      answer: `You can cancel your order within 24 hours of placing it from Your Account → My Orders using the Hold to Cancel button.`,
      intent: "cancellation_policy"
    };
  }

  // Customisation time inquiry
  if (/how\s+long.*(?:customis|customiz|stitch|tailor)/i.test(normalized) || /how\s+much\s+time.*(?:customis|customiz)/i.test(normalized)) {
    return {
      answer: `Our team will contact you within ${PUBLIC_BUSINESS_INFO.customisationResponseTime}.`,
      intent: "customisation_time"
    };
  }

  // Customisation process inquiry
  if (!isPriceQuestion(normalized) && findProductMatches(raw).length === 0 && /\b(?:customis\w*|customiz\w*|tailor\w*|bespoke|stitch\w*)\b/i.test(normalized)) {
    return {
      answer: `Submit your measurements and design requirements through our Customisation page, and our team will contact you within ${PUBLIC_BUSINESS_INFO.customisationResponseTime}.`,
      intent: "customisation_process"
    };
  }

  // Payment / COD inquiry
  if (/\b(?:payment|pay|cod|cash\s+on\s+delivery|razorpay|upi|card|netbanking)\b/i.test(normalized)) {
    return {
      answer: `We accept Cash on Delivery (COD) as well as online payments via Razorpay (UPI, Credit/Debit Cards, NetBanking).`,
      intent: "payment_policy"
    };
  }

  // Delivery / Shipping inquiry
  if (/\b(?:delivery|deliver|shipping|transit|how\s+long.*deliver|when\s+will.*order|arrive)\b/i.test(normalized)) {
    return {
      answer: `Standard delivery takes ${PUBLIC_BUSINESS_INFO.deliveryTimeline}.`,
      intent: "delivery_policy"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 7: SIZES (Only relevant sizes without unsolicited additions)
  // --------------------------------------------------------------------------
  if (isSizeQuestion(normalized) && !isPriceQuestion(normalized)) {
    // Women's Wear sizes
    if (/\b(?:women|womens|women's|female|adult)\b/i.test(normalized)) {
      return {
        answer: `Women's Wear is available in sizes ${PUBLIC_BUSINESS_INFO.standardSizes.join(', ')}.`,
        intent: "women_sizes"
      };
    }
    // Kids' Wear sizes
    if (/\b(?:kid|kids|kids'|child|children)\b/i.test(normalized)) {
      return {
        answer: `Kids' Wear is available in sizes ${PUBLIC_BUSINESS_INFO.kidsSizes.join(', ')}.`,
        intent: "kids_sizes"
      };
    }
    // Bridal accessories sizes
    if (/\b(?:accessories|veil|dupatta|belt)\b/i.test(normalized)) {
      return {
        answer: `Bridal Accessories are available in Free Size.`,
        intent: "accessories_sizes"
      };
    }
    // Check if question asks size for a specific product
    const productMatches = findProductMatches(raw);
    if (productMatches.length > 0) {
      const item = productMatches[0];
      const sizeStr = Array.isArray(item.sizes) ? item.sizes.join(', ') : item.sizes;
      return {
        answer: `${item.name} is available in sizes ${sizeStr}.`,
        intent: "product_sizes"
      };
    }
    // General sizes
    return {
      answer: `Available sizes are XS to XXL for adult wear, 2-3Y to 12-13Y for kids' wear, and Free Size for accessories.`,
      intent: "general_sizes"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 8: CATEGORY & SUBCATEGORY OFFERINGS (Concise category lists)
  // Only trigger when customer is asking what categories exist, NOT when asking about a specific product or price
  // --------------------------------------------------------------------------
  if (!isPriceQuestion(normalized) && findProductMatches(raw).length === 0 &&
      (/\b(?:types|offer|categories|collections|designs|what\s+do\s+you\s+sell)\b/i.test(normalized) || /what.*(?:bridal|ethnic|western|kids|women).*wear/i.test(normalized))) {
    if (normalized.includes('bridal')) {
      return {
        answer: `Our Bridal Wear includes Bridal Lehengas, Bridal Gowns, Bridal Blouses, Bridesmaid Wear, Engagement Wear, Reception Wear, and Bridal Accessories.`,
        intent: "bridal_categories"
      };
    }
    if (normalized.includes('ethnic')) {
      return {
        answer: `Our Ethnic Wear includes Anarkalis, Kurta Sets, Lehengas, Salwar Suits, Saree Blouses, Sharara Sets, and Traditional Dresses.`,
        intent: "ethnic_categories"
      };
    }
    if (normalized.includes('western')) {
      return {
        answer: `Our Western Wear includes Bodycon Dresses, Co-Ord Sets, Jumpsuits, Skirts, Tops, Trousers, and Western Dresses.`,
        intent: "western_categories"
      };
    }
    if (normalized.includes('kids') || normalized.includes('child')) {
      return {
        answer: `Our Kids' Wear includes Casual Wear, Customized Kids' Wear, Ethnic Kids' Wear, Girls' Dresses, and Party Wear.`,
        intent: "kids_categories"
      };
    }
    if (normalized.includes('women')) {
      return {
        answer: `Our Women's Wear includes Co-Ords, Dresses, Kurtis, Party Wear, Skirts, Tops & Blouses, and Trousers & Pants.`,
        intent: "women_categories"
      };
    }
    if (/\b(?:categories|collections|what\s+do\s+you\s+sell)\b/i.test(normalized)) {
      return {
        answer: `We offer five main collections: Women's Wear, Kids' Wear, Bridal Wear, Ethnic Wear, and Western Wear.`,
        intent: "main_collections"
      };
    }
  }

  // --------------------------------------------------------------------------
  // RULE 8.5: DETERMINISTIC PRICE EXTREMES & COMPARISONS
  // Answers "Which outfit is the cheapest?", "Which outfit is the most expensive?",
  // "Which outfit is more costly?", and pairwise price comparisons
  // --------------------------------------------------------------------------
  if (/\b(?:cheapest|lowest\s+price|least\s+expensive|minimum\s+price|most\s+affordable|lowest\s+cost)\b/i.test(normalized)) {
    if (normalized.includes('kid') || normalized.includes('child')) {
      return {
        answer: "Kids' Casual Dresses are our cheapest kids' outfit starting at ₹299.",
        intent: "cheapest_outfit"
      };
    }
    if (normalized.includes('bridal')) {
      return {
        answer: "Bridal Belts are our most affordable bridal items at ₹399.",
        intent: "cheapest_outfit"
      };
    }
    return {
      answer: "The cheapest outfit in our catalogue is Kids' Casual Dresses starting at ₹299 (in Kids' Wear). For adult wear, our most affordable outfits start at ₹399 (including Bridal Belts, Saree Blouses, and Co-Ord Sets).",
      intent: "cheapest_outfit"
    };
  }

  if (/\b(?:most\s+expensive|costliest|highest\s+price|maximum\s+price|highest\s+cost)\b/i.test(normalized)) {
    return {
      answer: "The most expensive outfit in our catalogue is Traditional Bridal Lehengas in Bridal Wear, ranging up to ₹69,999 (starting from ₹9,999).",
      intent: "most_expensive_outfit"
    };
  }

  if (/\b(?:more\s+costly|more\s+expensive|costlier|costs\s+more|higher\s+priced?)\b/i.test(normalized)) {
    const candidates = [];
    for (const item of CATALOGUE_INDEX) {
      if (raw.toLowerCase().includes(item.name.toLowerCase()) || canonicalize(raw).includes(item.canonicalName)) {
        if (!candidates.some(c => c.name.toLowerCase() === item.name.toLowerCase())) {
          candidates.push(item);
        }
      }
    }
    if (candidates.length >= 2) {
      const p1 = Number((candidates[0].rawPrice.match(/\d+/g) || [0]).pop());
      const p2 = Number((candidates[1].rawPrice.match(/\d+/g) || [0]).pop());
      if (p1 > p2) {
        return {
          answer: `${candidates[0].name} (${candidates[0].formattedPrice}) is more costly than ${candidates[1].name} (${candidates[1].formattedPrice}).`,
          intent: "comparison_price"
        };
      } else if (p2 > p1) {
        return {
          answer: `${candidates[1].name} (${candidates[1].formattedPrice}) is more costly than ${candidates[0].name} (${candidates[0].formattedPrice}).`,
          intent: "comparison_price"
        };
      } else {
        return {
          answer: `Both ${candidates[0].name} and ${candidates[1].name} have the same price of ${candidates[0].formattedPrice}.`,
          intent: "comparison_price"
        };
      }
    }
    return {
      answer: "Traditional Bridal Lehengas (up to ₹69,999) are our most costly designs. If you would like to compare two specific outfits, please let me know their names (for example, Evening Dresses vs Casual Dresses).",
      intent: "comparison_price"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 9: SPECIFIC PRODUCT LOOKUPS (Exact matches from the 141 catalogue items)
  // --------------------------------------------------------------------------

  // A. Evening Dresses (Prompt required examples)
  if (canonicalize(raw).includes('evening dress')) {
    if (normalized.includes('western')) {
      return {
        answer: `Western Evening Dresses cost ₹1,699.`,
        intent: "product_price"
      };
    }
    return {
      answer: `Evening Dresses cost ₹1,299.`,
      intent: "product_price"
    };
  }

  // B. Casual Dresses (Prompt required examples)
  if (canonicalize(raw).includes('casual dress')) {
    if (normalized.includes('kid') || normalized.includes('child')) {
      if (normalized.includes('girl')) {
        return {
          answer: `Kids' Casual Dresses cost ₹999.`,
          intent: "product_price"
        };
      }
      return {
        answer: `Kids' Casual Dresses cost ₹299.`,
        intent: "product_price"
      };
    }
    return {
      answer: `Casual Dresses cost ₹1,599.`,
      intent: "product_price"
    };
  }

  // C. Suggested chip: "What bridal lehengas do you have?"
  if (normalized.includes('what bridal lehenga') || (normalized.includes('bridal lehenga') && normalized.includes('have'))) {
    return {
      answer: `Our Bridal Lehengas include Designer Lehengas (₹9,999–₹59,999), Traditional Bridal Lehengas (₹9,999–₹69,999), Embroidered Lehengas (₹9,999–₹29,999), and Reception Lehengas (₹9,999–₹39,999).`,
      intent: "bridal_lehengas_list"
    };
  }

  // D. Full Catalogue Item Lookup across all 141 published items
  const matchedItems = findProductMatches(raw);

  if (matchedItems.length > 0) {
    // If only one exact item matched, return its exact price
    if (matchedItems.length === 1) {
      const match = matchedItems[0];
      const verb = match.name.endsWith('s') && !match.name.endsWith('ss') && !match.name.endsWith('Set') ? 'cost' : 'costs';
      return {
        answer: `${match.name} ${verb} ${match.formattedPrice}.`,
        intent: "product_price"
      };
    }

    // Filter by customer-specified category first if present in the question
    let pool = matchedItems;
    const catCandidates = matchedItems.filter(it => {
      if (normalized.includes(it.categoryKey)) return true;
      if (it.categoryKey === 'women' && /\b(?:women|womens|women's)\b/i.test(normalized)) return true;
      if (it.categoryKey === 'western' && /\bwestern\b/i.test(normalized)) return true;
      if (it.categoryKey === 'kids' && /\b(?:kid|kids|kids'|child)\b/i.test(normalized)) return true;
      if (it.categoryKey === 'bridal' && /\b(?:bridal|bride)\b/i.test(normalized)) return true;
      if (it.categoryKey === 'ethnic' && /\bethnic\b/i.test(normalized)) return true;
      return false;
    });

    if (catCandidates.length > 0) {
      pool = catCandidates;
    }

    // If no category specified and identical prices across occurrences (e.g. Crop Tops in Women/Western = ₹499)
    const uniquePrices = [...new Set(matchedItems.map(it => it.formattedPrice))];
    if (catCandidates.length === 0 && uniquePrices.length === 1) {
      const verb = matchedItems[0].name.endsWith('s') && !matchedItems[0].name.endsWith('ss') && !matchedItems[0].name.endsWith('Set') ? 'cost' : 'costs';
      return {
        answer: `${matchedItems[0].name} ${verb} ${uniquePrices[0]}.`,
        intent: "product_price"
      };
    }

    // Next check if subcategory is specified in question
    const subMatch = pool.find(it => 
      raw.toLowerCase().includes(it.subCategoryLabel.toLowerCase()) ||
      canonicalize(raw).includes(canonicalize(it.subCategoryLabel))
    );

    if (subMatch) {
      const verb = subMatch.name.endsWith('s') && !subMatch.name.endsWith('ss') && !subMatch.name.endsWith('Set') ? 'cost' : 'costs';
      return {
        answer: `${subMatch.categoryLabel} ${subMatch.name} ${verb} ${subMatch.formattedPrice}.`,
        intent: "product_price"
      };
    }

    if (catCandidates.length === 1) {
      const item = catCandidates[0];
      const verb = item.name.endsWith('s') && !item.name.endsWith('ss') && !item.name.endsWith('Set') ? 'cost' : 'costs';
      return {
        answer: `${item.categoryLabel} ${item.name} ${verb} ${item.formattedPrice}.`,
        intent: "product_price"
      };
    }

    if (uniquePrices.length === 1) {
      const verb = matchedItems[0].name.endsWith('s') && !matchedItems[0].name.endsWith('ss') && !matchedItems[0].name.endsWith('Set') ? 'cost' : 'costs';
      return {
        answer: `${matchedItems[0].name} ${verb} ${uniquePrices[0]}.`,
        intent: "product_price"
      };
    }

    // Ambiguous product with multiple distinct collections and prices:
    // Remember clarification context so customer's follow-up can be resolved accurately!
    conversationState.pendingClarification = {
      type: "collection_disambiguation",
      productName: matchedItems[0].name,
      originalQuery: raw,
      matchedItems: matchedItems
    };

    const options = matchedItems.map(it => `${it.categoryLabel} (${it.formattedPrice})`).join(' and ');
    return {
      answer: `We have ${matchedItems[0].name} in ${options}. Which collection are you looking for?`,
      intent: "ambiguous_product",
      suggestedChips: matchedItems.map(it => it.categoryLabel)
    };
  }

  // --------------------------------------------------------------------------
  // RULE 10: SUBCATEGORY SPECIFIC PRICE RANGES
  // e.g. "What is the price of Bridal Lehengas?", "What is the price of Salwar Suits?"
  // --------------------------------------------------------------------------
  if (isPriceQuestion(normalized) || normalized.includes('price of') || normalized.includes('cost of')) {
    if (normalized.includes('bridal lehenga') || (normalized.includes('lehenga') && normalized.includes('bridal'))) {
      return {
        answer: `Bridal Lehengas range from ₹9,999 to ₹69,999.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('ethnic lehenga') || (normalized.includes('lehenga') && normalized.includes('ethnic'))) {
      return {
        answer: `Ethnic Lehengas range from ₹3,999 to ₹5,999.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('kurti') || normalized.includes('kurta')) {
      return {
        answer: `Women's Kurtis range from ₹499 to ₹1,299.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('anarkali')) {
      return {
        answer: `Anarkalis range from ₹999 to ₹2,999.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('salwar') || /\bsuits?\b/i.test(normalized)) {
      return {
        answer: `Salwar Suits range from ₹999 to ₹1,599.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('jumpsuit')) {
      return {
        answer: `Jumpsuits range from ₹999 to ₹2,499.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('sharara')) {
      return {
        answer: `Sharara Sets range from ₹1,599 to ₹3,999.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('blouse')) {
      return {
        answer: `Saree Blouses range from ₹399 to ₹5,999.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('co-ord') || normalized.includes('coord')) {
      return {
        answer: `Co-Ord Sets range from ₹399 to ₹1,999.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('skirt')) {
      return {
        answer: `Skirts range from ₹499 to ₹899.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('trouser') || normalized.includes('pants')) {
      return {
        answer: `Trousers & Pants range from ₹799 to ₹1,299.`,
        intent: "subcategory_price"
      };
    }
    if (normalized.includes('gown')) {
      return {
        answer: `Gowns range from ₹2,999 to ₹29,999.`,
        intent: "subcategory_price"
      };
    }
  }

  // --------------------------------------------------------------------------
  // RULE 11: AMBIGUOUS GENERAL TERMS
  // Ask customer which collection they mean
  // --------------------------------------------------------------------------
  if (normalized.includes('lehenga')) {
    return {
      answer: `We offer Ethnic Lehengas (from ₹3,999), Bridal Lehengas (from ₹9,999), and Kids' Lehengas (from ₹999). Which collection would you like to know about?`,
      intent: "ambiguous_category"
    };
  }

  if (normalized.includes('blouse')) {
    return {
      answer: `We offer Saree Blouses (from ₹399), Ethnic Blouses (from ₹499), and Bridal Blouses (from ₹999). Which collection do you mean?`,
      intent: "ambiguous_category"
    };
  }

  if (normalized.includes('co-ord') || normalized.includes('coord')) {
    return {
      answer: `We offer Co-Ord Sets in Kids' Wear (₹399), Women's Wear (from ₹899), and Western Wear (from ₹1,499). Which collection do you mean?`,
      intent: "ambiguous_category"
    };
  }

  if (normalized === 'dress' || normalized === 'dresses') {
    return {
      answer: `We offer Dresses in Women's Wear (from ₹1,299), Western Wear (from ₹999), and Kids' Wear (from ₹299). Which collection do you mean?`,
      intent: "ambiguous_category"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 12: GENERAL PRICE SUMMARY (Suggested chip & broad price question)
  // "What are your product prices?"
  // --------------------------------------------------------------------------
  if (isPriceQuestion(normalized)) {
    return {
      answer: `Our catalogue prices range from ₹299 for Kids' Wear, ₹399 for Women's Wear, ₹499 for Ethnic & Western Wear, up to ₹69,999 for Bridal Couture.`,
      intent: "general_price_summary"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 13: FASHION QUERY FALLBACK
  // If the query contains fashion keywords but couldn't be resolved to public catalogue
  // --------------------------------------------------------------------------
  const fashionKeywords = /\b(?:dress|cloth|fabric|outfit|colour|color|pattern|wear|stitch|design|order|buy|shop|store)\b/i;
  if (fashionKeywords.test(normalized)) {
    return {
      answer: REFUSAL_UNAVAILABLE,
      intent: "fashion_query_unavailable"
    };
  }

  // --------------------------------------------------------------------------
  // RULE 14: DEFAULT POLITE REFUSAL FOR UNRECOGNIZED TOPICS
  // --------------------------------------------------------------------------
  return {
    answer: REFUSAL_OFF_TOPIC,
    intent: "unrecognized_refusal"
  };
}
