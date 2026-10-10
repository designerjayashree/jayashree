/**
 * Server-Side Cancellation & Refund Service for Jayashree
 * 
 * Provides secure backend business rules for:
 * 1. 24-hour order cancellation eligibility calculation
 * 2. Order status eligibility checking (shipped, delivered, cancelled)
 * 3. Payment refund timeline and status determination by Razorpay payment method
 */

export function getOrderCreationMs(order) {
  if (!order) return 0;
  if (typeof order.orderTimestamp === 'number' && !isNaN(order.orderTimestamp)) {
    return order.orderTimestamp;
  }
  const c = order.createdAt;
  if (c) {
    if (typeof c.toMillis === 'function') return c.toMillis();
    if (typeof c.toDate === 'function') return c.toDate().getTime();
    if (typeof c === 'object' && typeof c.seconds === 'number') {
      return c.seconds * 1000 + (c.nanoseconds ? Math.floor(c.nanoseconds / 1e6) : 0);
    }
    if (typeof c === 'number') return c;
    if (typeof c === 'string') {
      const parsed = Date.parse(c);
      if (!isNaN(parsed)) return parsed;
    }
  }
  if (order.orderDate && typeof order.orderDate === 'string') {
    const parsed = Date.parse(order.orderDate);
    if (!isNaN(parsed)) return parsed;
  }
  if (order.date && typeof order.date === 'string') {
    const parsed = Date.parse(order.date);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Calculates cancellation eligibility securely using server timestamp
 * 
 * @param {Object} order - The order document
 * @param {number} [serverTimeMs=Date.now()] - Server timestamp in ms
 * @returns {Object} { eligible, reason, expired, isCancelled, remainingMs, deadlineMs }
 */
export function checkCancellationEligibility(order, serverTimeMs = Date.now()) {
  if (!order) {
    return {
      eligible: false,
      reason: 'Order record is missing or invalid',
      code: 'INVALID_ORDER'
    };
  }

  const rawStatus = (order.status || order.orderStatus || 'Processing').trim();
  const statusLower = rawStatus.toLowerCase();

  // 1. Already Cancelled Orders
  if (statusLower === 'cancelled') {
    return {
      eligible: false,
      reason: 'This order has already been cancelled.',
      code: 'ALREADY_CANCELLED',
      isCancelled: true,
      status: rawStatus
    };
  }

  // 2. Dispatched or Delivered Orders
  const nonCancellableStatuses = ['shipped', 'out for delivery', 'delivered'];
  if (nonCancellableStatuses.includes(statusLower)) {
    return {
      eligible: false,
      reason: `Orders in '${rawStatus}' status cannot be cancelled per store policy.`,
      code: 'STATUS_INELIGIBLE',
      status: rawStatus
    };
  }

  // 3. 24-Hour Policy Window Check
  const createdMs = getOrderCreationMs(order);
  if (!createdMs) {
    return {
      eligible: false,
      reason: 'Order creation timestamp could not be verified.',
      code: 'TIMESTAMP_MISSING'
    };
  }

  const deadlineMs = createdMs + (24 * 60 * 60 * 1000);
  const remainingMs = deadlineMs - serverTimeMs;

  if (remainingMs <= 0) {
    return {
      eligible: false,
      reason: 'Orders can only be cancelled within 24 hours of placing them.',
      code: 'CANCELLATION_PERIOD_ENDED',
      expired: true,
      deadlineMs,
      serverTimeMs,
      remainingMs: 0
    };
  }

  return {
    eligible: true,
    reason: 'Order is eligible for cancellation within the 24-hour window.',
    code: 'ELIGIBLE',
    expired: false,
    remainingMs,
    deadlineMs,
    serverTimeMs
  };
}

/**
 * Resolves Razorpay payment method names and variations to official refund timeframes
 * 
 * Supported categories:
 * - UPI: 2 to 7 days ("UPI: Refunds typically take 2 to 7 days.")
 * - Credit / Debit Cards: 5 to 10 days ("Credit / Debit Cards: Refunds typically take 5 to 10 days.")
 * - Net Banking: 2 to 10 days ("Net Banking: Refunds typically take 2 to 10 days.")
 * - Wallets: 0 to 3 days ("Wallets: Refunds typically take 0 to 3 days.")
 * 
 * @param {string|Object} input - Raw method string or Razorpay payment object
 * @returns {Object} { category, label, timeline, refundMessage, isIdentified }
 */
export function resolveRazorpayPaymentMethod(input) {
  if (!input) {
    return {
      category: 'unknown',
      label: 'Online Payment',
      timeline: null,
      refundMessage: 'Refunds: Please contact support for refund timeframe assistance.',
      isIdentified: false
    };
  }

  let methodStr = '';
  if (typeof input === 'string') {
    methodStr = input.trim().toLowerCase();
  } else if (typeof input === 'object') {
    const rzpMethod = (input.method || input.paymentMethod || input.payment_method || '').toLowerCase();
    const cardType = (input.card?.type || input.card_type || '').toLowerCase();
    const walletName = (input.wallet || '').toLowerCase();
    const bankName = (input.bank || '').toLowerCase();
    methodStr = `${rzpMethod} ${cardType} ${walletName} ${bankName}`.trim().toLowerCase();
  }

  // 1. Wallets
  if (
    methodStr.includes('wallet') ||
    methodStr.includes('paytm') ||
    methodStr.includes('mobikwik') ||
    methodStr.includes('freecharge') ||
    methodStr.includes('olamoney') ||
    methodStr.includes('amazonpay') ||
    methodStr.includes('amazon pay') ||
    methodStr.includes('phonepe wallet')
  ) {
    return {
      category: 'wallet',
      label: 'Wallets',
      timeline: '0 to 3 days',
      refundMessage: 'Wallets: Refunds typically take 0 to 3 days.',
      isIdentified: true
    };
  }

  // 2. UPI
  if (
    methodStr.includes('upi') ||
    methodStr.includes('gpay') ||
    methodStr.includes('google pay') ||
    methodStr.includes('phonepe') ||
    methodStr.includes('bhim') ||
    methodStr.includes('@')
  ) {
    return {
      category: 'upi',
      label: 'UPI',
      timeline: '2 to 7 days',
      refundMessage: 'UPI: Refunds typically take 2 to 7 days.',
      isIdentified: true
    };
  }

  // 3. Net Banking
  if (
    methodStr.includes('netbanking') ||
    methodStr.includes('net banking') ||
    methodStr.includes('net_banking') ||
    methodStr.includes('net-banking') ||
    methodStr === 'nb'
  ) {
    return {
      category: 'netbanking',
      label: 'Net Banking',
      timeline: '2 to 10 days',
      refundMessage: 'Net Banking: Refunds typically take 2 to 10 days.',
      isIdentified: true
    };
  }

  // 4. Credit / Debit Cards
  if (
    methodStr.includes('card') ||
    methodStr.includes('credit') ||
    methodStr.includes('debit') ||
    methodStr.includes('visa') ||
    methodStr.includes('mastercard') ||
    methodStr.includes('rupay') ||
    methodStr.includes('amex') ||
    methodStr.includes('diners')
  ) {
    return {
      category: 'card',
      label: 'Credit / Debit Cards',
      timeline: '5 to 10 days',
      refundMessage: 'Credit / Debit Cards: Refunds typically take 5 to 10 days.',
      isIdentified: true
    };
  }

  // 5. Cash on Delivery
  if (
    methodStr === 'cod' ||
    methodStr === 'cash on delivery' ||
    methodStr.includes('cash on delivery') ||
    methodStr.includes('pay on delivery')
  ) {
    return {
      category: 'cod',
      label: 'Cash on Delivery',
      timeline: null,
      refundMessage: null,
      isIdentified: true
    };
  }

  // 6. Unknown / Unidentified method
  return {
    category: 'unknown',
    label: 'Online Payment',
    timeline: null,
    refundMessage: 'Refunds: Please contact support for refund timeframe assistance.',
    isIdentified: false
  };
}

/**
 * Extracts and categorises refund details and timeline for a cancelled order
 * 
 * @param {Object} order - The order document
 * @returns {Object|null} Refund details or null if no refund applies (e.g. unpaid COD)
 */
export function getRefundDetails(order) {
  if (!order) return null;

  const rawStatus = (order.status || order.orderStatus || '').trim().toLowerCase();
  if (rawStatus !== 'cancelled') {
    return null;
  }

  const payMethod = (order.paymentMethod || order.razorpayMethod || '').trim();
  const lowerMethod = payMethod.toLowerCase();

  // Check if Cash on Delivery
  const isCod = lowerMethod === 'cod' ||
                lowerMethod === 'cash on delivery' ||
                lowerMethod.includes('cash on delivery') ||
                lowerMethod.includes('pay on delivery');

  const payStatus = (order.paymentStatus || '').trim().toLowerCase();
  const isPaid = payStatus === 'paid' ||
                 payStatus === 'completed' ||
                 order.isPaid === true ||
                 (lowerMethod.startsWith('prepaid') && payStatus !== 'failed' && payStatus !== 'pending' && payStatus !== 'unpaid') ||
                 (Boolean(order.razorpayPaymentId) && payStatus !== 'failed');

  // Rule: For Cash on Delivery orders that have not been paid, do not display a refund timeline.
  if (isCod && !isPaid) {
    return null;
  }

  // Unpaid online orders (e.g. failed payment) also require no refund timeline
  if (!isPaid) {
    return null;
  }

  // Resolve payment method category and timeline
  const resolved = resolveRazorpayPaymentMethod(order.paymentMethod || order.razorpayMethod || order.paymentDetails);
  const { category, label, timeline, refundMessage, isIdentified } = resolved;

  // Check refund status
  const rawRefundStatus = (order.refundStatus || '').trim().toLowerCase();
  const isInitiated = rawRefundStatus === 'initiated' ||
                      rawRefundStatus === 'processing' ||
                      rawRefundStatus === 'completed' ||
                      rawRefundStatus === 'refunded' ||
                      Boolean(order.refundInitiatedAt || order.refundDate || order.refundInitiationDate);

  // Format initiation date if present
  let initiationDateFormatted = '';
  const dateVal = order.refundInitiatedAt || order.refundDate || order.refundInitiationDate;
  if (dateVal) {
    if (typeof dateVal === 'string') {
      try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          initiationDateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } else {
          initiationDateFormatted = dateVal;
        }
      } catch {
        initiationDateFormatted = dateVal;
      }
    } else if (typeof dateVal === 'object' && dateVal.seconds) {
      const d = new Date(dateVal.seconds * 1000);
      initiationDateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  return {
    isPaid,
    methodCategory: category,
    methodLabel: label,
    timeline, // e.g. "2 to 7 days", "5 to 10 days", "2 to 10 days", "0 to 3 days", or null
    expectedTimelineText: timeline ? `Expected refund timeline: ${timeline}` : '',
    refundMessage, // e.g. "UPI: Refunds typically take 2 to 7 days."
    isIdentified,
    isInitiated,
    rawRefundStatus: order.refundStatus || (isInitiated ? 'Initiated' : 'Pending'),
    initiationDate: initiationDateFormatted
  };
}
