import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 JAYASHREE ORDER CANCELLATION, GMAIL API & REFUND SUITE');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}\n     Error: ${err.message}`);
    failCount++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}\n     Error: ${err.message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: Customer My Orders Display Rules
// -----------------------------------------------------------------------------
console.log('▶️ TEST SUITE 1: Customer My Orders Display Rules');

const ROOT_DIR = process.cwd();
const scriptContent = fs.readFileSync(path.resolve(ROOT_DIR, 'js/script.js'), 'utf8');

it('Hides estimated delivery item when isCancelled is true', () => {
  assert(
    scriptContent.includes('${!isCancelled ? `') && scriptContent.includes('my-order-delivery-item'),
    'Expected delivery item to be wrapped in !isCancelled conditional'
  );
});

it('Hides payment method and payment status badge when isCancelled is true', () => {
  assert(
    scriptContent.includes('my-order-payment-item') &&
    scriptContent.includes('${formatPaymentStatusBadge(order.paymentStatus)}') &&
    scriptContent.includes('${!isCancelled ? `'),
    'Expected payment item and status badge to be hidden when order is cancelled'
  );
});

it('Preserves order number, product name, size, quantity and price on cancelled orders', () => {
  assert(scriptContent.includes('ORDER #${escapeHtml(displayNum)}'), 'Order number should remain visible');
  assert(scriptContent.includes('my-order-product-name'), 'Product name should remain visible');
  assert(scriptContent.includes('my-order-amount'), 'Amount should remain visible');
  assert(scriptContent.includes('my-order-meta'), 'Size and quantity should remain visible');
});

it('Renders cancellation status clearly for admin and customer cancellations', () => {
  assert(scriptContent.includes('Cancelled by Jayashree'), 'Expected label for admin cancellation');
  assert(scriptContent.includes('Cancelled by you'), 'Expected label for customer cancellation');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Admin Cancellation Confirmation Popup
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 2: Admin Cancellation Confirmation Popup');

const htmlContent = fs.readFileSync(path.resolve(ROOT_DIR, 'index.html'), 'utf8');

it('Index.html contains admin cancel modal overlay with all required elements', () => {
  assert(htmlContent.includes('id="adminCancelModalOverlay"'), 'Modal overlay exists');
  assert(htmlContent.includes('id="adminCancelOrderNum"'), 'Order number placeholder exists');
  assert(htmlContent.includes('id="adminCancelCustName"'), 'Customer name placeholder exists');
  assert(htmlContent.includes('id="adminCancelCustEmail"'), 'Customer email placeholder exists');
  assert(htmlContent.includes('id="adminCancelProduct"'), 'Product placeholder exists');
});

it('Modal provides Keep Order, Cancel Order, and Cancel Order & Send Email buttons', () => {
  assert(htmlContent.includes('id="btnAdminKeepOrder"'), 'Keep Order button exists');
  assert(htmlContent.includes('id="btnAdminCancelOnly"'), 'Cancel Order button exists');
  assert(htmlContent.includes('id="btnAdminCancelAndEmail"'), 'Cancel Order & Send Email button exists');
});

it('Intercepts status change to "Cancelled" in admin orders to trigger modal', () => {
  assert(scriptContent.includes("if (newStatus === 'Cancelled') {"), 'Status change checks for Cancelled');
  assert(scriptContent.includes('openAdminCancelModal(order)'), 'Opens confirmation modal before modifying Firestore');
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Gmail API Email Template & Formatting
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 3: Gmail API Email Template & Formatting');

import { isGmailConfigured, sendCancellationEmail } from './server/emailService.js';

it('isGmailConfigured detects presence/absence of OAuth keys', () => {
  const configured = isGmailConfigured();
  assert(typeof configured === 'boolean', 'isGmailConfigured must return boolean');
});

it('Validates recipient email before calling Gmail API', async () => {
  try {
    await sendCancellationEmail({
      to: 'invalid-email',
      customerName: 'Test Customer',
      orderNumber: '1099',
      productName: 'Silk Saree'
    });
    assert.fail('Should reject invalid email');
  } catch (err) {
    assert(err.message.includes('Invalid recipient email address'), 'Expected email validation error');
  }
});

it('Template matches required wording and sender', () => {
  const emailServiceContent = fs.readFileSync(path.resolve(ROOT_DIR, 'server/emailService.js'), 'utf8');
  assert(emailServiceContent.includes('Your Jayashree Order #${cleanOrderNum} Has Been Cancelled'), 'Subject matches specification');
  assert(emailServiceContent.includes('Dear ${cleanCustomerName},'), 'Salutation matches specification');
  assert(emailServiceContent.includes('We regret to inform you that your order #${cleanOrderNum} for ${cleanProduct} has been cancelled by Jayashree.'), 'Body text matches specification');
  assert(emailServiceContent.includes('We apologise for any inconvenience caused. If you have any questions or need assistance, please contact our Help Centre.'), 'Policy note matches specification');
  assert(emailServiceContent.includes('designerjayashree9@gmail.com'), 'Sender matches designerjayashree9@gmail.com');
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: Backend Endpoint Security & Idempotency
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 4: Backend Endpoint Security & Idempotency');

import cancelOrderHandler from './api/admin/cancel-order.js';

itAsync('Rejects unauthenticated requests with 403 Forbidden', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: {},
    body: { orderId: 'JAY-1051', sendEmail: true }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (data) => { responseData = data; }
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 403, 'Expected 403 Forbidden for unauthenticated request');
  assert.strictEqual(responseData.success, false);
});

itAsync('Rejects non-POST methods with 405 Method Not Allowed', async () => {
  let statusCode = 0;
  const mockReq = { method: 'GET', headers: {} };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: () => {}
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 405, 'Expected 405 for non-POST method');
});

itAsync('Requires orderId parameter', async () => {
  let statusCode = 0;
  const mockReq = {
    method: 'POST',
    headers: { 'x-admin-verified': 'true' },
    body: {}
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: () => {}
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 400, 'Expected 400 when orderId is missing');
});

itAsync('Handles cancellation without email cleanly when sendEmail is false', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: { 'x-admin-verified': 'true' },
    body: {
      orderId: 'JAY-1051',
      sendEmail: false,
      orderData: {
        orderNumber: '1051',
        customerName: 'Priya Sharma',
        customerEmail: 'priya.sharma@example.com',
        product: 'Handwoven Silk Anarkali Suit'
      }
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (data) => { responseData = data; }
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200, 'Expected 200 OK');
  assert.strictEqual(responseData.cancelled, true);
  assert.strictEqual(responseData.emailSent, false);
});

// -----------------------------------------------------------------------------
// TEST SUITE 5: 10 Core User Requirements (Cancellation Window & Refunds)
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 5: 10 Core User Requirements (Cancellation Window & Refunds)');

import { checkCancellationEligibility, getRefundDetails, resolveRazorpayPaymentMethod } from './server/cancellationService.js';
import eligibilityHandler from './api/orders/eligibility.js';

const nowMs = 1791655000000; // Fixed baseline for reproducible deterministic tests

// Req 1: Order cancellable within 24 hours
it('1. Order within 24 hours is eligible for cancellation and keeps control enabled', () => {
  const order = {
    id: 'ORD-1',
    status: 'Processing',
    createdAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString() // 2 hours old
  };
  const result = checkCancellationEligibility(order, nowMs);
  assert.strictEqual(result.eligible, true);
  assert.strictEqual(result.expired, false);
  assert(result.remainingMs > 0);
});

// Req 2: Order older than 24 hours
it('2. Order older than 24 hours shows "Cancellation period ended" and disables cancellation', () => {
  const order = {
    id: 'ORD-2',
    status: 'Processing',
    createdAt: new Date(nowMs - 26 * 60 * 60 * 1000).toISOString() // 26 hours old
  };
  const result = checkCancellationEligibility(order, nowMs);
  assert.strictEqual(result.eligible, false);
  assert.strictEqual(result.expired, true);
  assert(result.reason.includes('Orders can only be cancelled within 24 hours of placing them'));
  // Verify frontend does not show contradictory instructions
  assert(scriptContent.includes('Orders can only be cancelled within 24 hours of placing them.'));
  assert(scriptContent.includes('Cancellation Closed'));
});

// Req 3: Already-cancelled order
it('3. Already-cancelled order is not cancellable and hides cancellation panel and button', () => {
  const order = {
    id: 'ORD-3',
    status: 'Cancelled',
    createdAt: new Date(nowMs - 1 * 60 * 60 * 1000).toISOString()
  };
  const result = checkCancellationEligibility(order, nowMs);
  assert.strictEqual(result.eligible, false);
  assert.strictEqual(result.isCancelled, true);
});

// Req 4: Otherwise ineligible orders (Shipped / Out for Delivery / Delivered)
it('4. Orders that are Shipped, Out for Delivery, or Delivered are ineligible for cancellation', () => {
  const statuses = ['Shipped', 'Out for Delivery', 'Delivered'];
  for (const st of statuses) {
    const order = {
      id: `ORD-INELIGIBLE-${st}`,
      status: st,
      createdAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString()
    };
    const result = checkCancellationEligibility(order, nowMs);
    assert.strictEqual(result.eligible, false, `Order in status ${st} must not be cancellable`);
    assert(result.code === 'STATUS_INELIGIBLE');
  }
});

// Req 5: Cancelled UPI-paid order
it('5. Cancelled UPI-paid order shows expected refund timeline: 2 to 7 days', () => {
  const order = {
    id: 'ORD-UPI',
    status: 'Cancelled',
    paymentMethod: 'Prepaid (UPI)',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated'
  };
  const refund = getRefundDetails(order);
  assert(refund !== null);
  assert.strictEqual(refund.timeline, '2 to 7 days');
  assert.strictEqual(refund.refundMessage, 'UPI: Refunds typically take 2 to 7 days.');
  assert.strictEqual(refund.expectedTimelineText, 'Expected refund timeline: 2 to 7 days');
  assert.strictEqual(refund.methodCategory, 'upi');
});

// Req 6: Cancelled net-banking-paid order
it('6. Cancelled Net Banking-paid order shows expected refund timeline: 2 to 10 days', () => {
  const order = {
    id: 'ORD-NB',
    status: 'Cancelled',
    paymentMethod: 'Net Banking',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated'
  };
  const refund = getRefundDetails(order);
  assert(refund !== null);
  assert.strictEqual(refund.timeline, '2 to 10 days');
  assert.strictEqual(refund.refundMessage, 'Net Banking: Refunds typically take 2 to 10 days.');
  assert.strictEqual(refund.expectedTimelineText, 'Expected refund timeline: 2 to 10 days');
  assert.strictEqual(refund.methodCategory, 'netbanking');
});

// Req 7: Cancelled credit/debit-card-paid order
it('7. Cancelled Credit/Debit Card-paid order shows expected refund timeline: 5 to 10 days', () => {
  const order = {
    id: 'ORD-CARD',
    status: 'Cancelled',
    paymentMethod: 'Prepaid (Card)',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated'
  };
  const refund = getRefundDetails(order);
  assert(refund !== null);
  assert.strictEqual(refund.timeline, '5 to 10 days');
  assert.strictEqual(refund.refundMessage, 'Credit / Debit Cards: Refunds typically take 5 to 10 days.');
  assert.strictEqual(refund.expectedTimelineText, 'Expected refund timeline: 5 to 10 days');
  assert.strictEqual(refund.methodCategory, 'card');
});

// Req 8: Cancelled unpaid Cash on Delivery order
it('8. Cancelled unpaid Cash on Delivery order displays NO refund timeline', () => {
  const order = {
    id: 'ORD-COD',
    status: 'Cancelled',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Pending',
    isPaid: false
  };
  const refund = getRefundDetails(order);
  assert.strictEqual(refund, null, 'Unpaid COD order must not return any refund timeline');
});

// Req 9: Paid order where refund initiation is pending
it('9. Paid order where refund initiation is pending explains status without implying countdown started', () => {
  const order = {
    id: 'ORD-PENDING-REFUND',
    status: 'Cancelled',
    paymentMethod: 'Prepaid (UPI)',
    paymentStatus: 'Paid',
    refundStatus: 'Pending'
  };
  const refund = getRefundDetails(order);
  assert(refund !== null);
  assert.strictEqual(refund.isInitiated, false);
  assert(scriptContent.includes('Refund has not yet been initiated. Once approved and initiated by Jayashree'));
  assert(scriptContent.includes('Pending Initiation'));
});

// Req 10: Paid order where refund has been initiated
it('10. Paid order where refund has been initiated displays initiation date and applicable timeline', () => {
  const order = {
    id: 'ORD-INITIATED-REFUND',
    status: 'Cancelled',
    paymentMethod: 'Prepaid (UPI)',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated',
    refundInitiatedAt: '2026-10-10T12:00:00.000Z'
  };
  const refund = getRefundDetails(order);
  assert(refund !== null);
  assert.strictEqual(refund.isInitiated, true);
  assert(refund.initiationDate.includes('Oct 2026') || refund.initiationDate.includes('10'));
  assert.strictEqual(refund.timeline, '2 to 7 days');
});

// Req 11: Cancelled Wallet-paid order
it('11. Cancelled Wallet-paid order shows expected refund timeline: 0 to 3 days', () => {
  const order = {
    id: 'ORD-WALLET',
    status: 'Cancelled',
    paymentMethod: 'Wallets',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated'
  };
  const refund = getRefundDetails(order);
  assert(refund !== null);
  assert.strictEqual(refund.timeline, '0 to 3 days');
  assert.strictEqual(refund.refundMessage, 'Wallets: Refunds typically take 0 to 3 days.');
  assert.strictEqual(refund.methodCategory, 'wallet');
});

// -----------------------------------------------------------------------------
// TEST SUITE 6: Backend Eligibility & Refund API Handler (/api/orders/eligibility)
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 6: Backend Eligibility & Refund API Handler');

itAsync('API handler calculates cancellation eligibility and refund details via POST', async () => {
  let statusCode = 0;
  let payload = null;
  const mockReq = {
    method: 'POST',
    headers: {},
    body: {
      order: {
        id: 'API-TEST-1',
        status: 'Cancelled',
        paymentMethod: 'Prepaid (Card)',
        paymentStatus: 'Paid',
        refundStatus: 'Initiated',
        refundInitiatedAt: '2026-10-10T14:00:00.000Z'
      }
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (c) => { statusCode = c; return mockRes; },
    json: (p) => { payload = p; }
  };

  await eligibilityHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(payload.success, true);
  assert.strictEqual(payload.refundInfo.timeline, '5 to 10 days');
  assert.strictEqual(payload.refundInfo.refundMessage, 'Credit / Debit Cards: Refunds typically take 5 to 10 days.');
  assert.strictEqual(payload.eligibility.eligible, false); // Cancelled order is not eligible to cancel again
});

// -----------------------------------------------------------------------------
// TEST SUITE 7: Razorpay Payment Method Verification & Order Confirmation Page
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 7: Razorpay Payment Method & Confirmation Page Refunds');

it('Resolves UPI payment method correctly (2 to 7 days)', () => {
  const res1 = resolveRazorpayPaymentMethod('upi');
  assert.strictEqual(res1.category, 'upi');
  assert.strictEqual(res1.timeline, '2 to 7 days');
  assert.strictEqual(res1.refundMessage, 'UPI: Refunds typically take 2 to 7 days.');
  assert.strictEqual(res1.isIdentified, true);

  const res2 = resolveRazorpayPaymentMethod({ method: 'upi', vpa: 'jayashree@okhdfcbank' });
  assert.strictEqual(res2.category, 'upi');
  assert.strictEqual(res2.timeline, '2 to 7 days');
  assert.strictEqual(res2.refundMessage, 'UPI: Refunds typically take 2 to 7 days.');
});

it('Resolves Credit / Debit Cards correctly (5 to 10 days)', () => {
  const res1 = resolveRazorpayPaymentMethod('card');
  assert.strictEqual(res1.category, 'card');
  assert.strictEqual(res1.timeline, '5 to 10 days');
  assert.strictEqual(res1.refundMessage, 'Credit / Debit Cards: Refunds typically take 5 to 10 days.');
  assert.strictEqual(res1.isIdentified, true);

  const res2 = resolveRazorpayPaymentMethod({ method: 'card', card: { type: 'credit', network: 'Visa' } });
  assert.strictEqual(res2.category, 'card');
  assert.strictEqual(res2.timeline, '5 to 10 days');
  assert.strictEqual(res2.refundMessage, 'Credit / Debit Cards: Refunds typically take 5 to 10 days.');
});

it('Resolves Net Banking correctly (2 to 10 days)', () => {
  const res1 = resolveRazorpayPaymentMethod('netbanking');
  assert.strictEqual(res1.category, 'netbanking');
  assert.strictEqual(res1.timeline, '2 to 10 days');
  assert.strictEqual(res1.refundMessage, 'Net Banking: Refunds typically take 2 to 10 days.');
  assert.strictEqual(res1.isIdentified, true);

  const res2 = resolveRazorpayPaymentMethod({ method: 'netbanking', bank: 'HDFC' });
  assert.strictEqual(res2.category, 'netbanking');
  assert.strictEqual(res2.timeline, '2 to 10 days');
  assert.strictEqual(res2.refundMessage, 'Net Banking: Refunds typically take 2 to 10 days.');
});

it('Resolves Wallets correctly (0 to 3 days)', () => {
  const res1 = resolveRazorpayPaymentMethod('wallet');
  assert.strictEqual(res1.category, 'wallet');
  assert.strictEqual(res1.timeline, '0 to 3 days');
  assert.strictEqual(res1.refundMessage, 'Wallets: Refunds typically take 0 to 3 days.');
  assert.strictEqual(res1.isIdentified, true);

  const res2 = resolveRazorpayPaymentMethod({ method: 'wallet', wallet: 'paytm' });
  assert.strictEqual(res2.category, 'wallet');
  assert.strictEqual(res2.timeline, '0 to 3 days');
  assert.strictEqual(res2.refundMessage, 'Wallets: Refunds typically take 0 to 3 days.');

  const res3 = resolveRazorpayPaymentMethod('amazonpay');
  assert.strictEqual(res3.category, 'wallet');
  assert.strictEqual(res3.timeline, '0 to 3 days');
});

it('Returns neutral support message when payment method cannot be identified', () => {
  const res = resolveRazorpayPaymentMethod('unrecognized_custom_token');
  assert.strictEqual(res.category, 'unknown');
  assert.strictEqual(res.timeline, null);
  assert.strictEqual(res.refundMessage, 'Refunds: Please contact support for refund timeframe assistance.');
  assert.strictEqual(res.isIdentified, false);
});

it('Returns no refund timeline for Cash on Delivery', () => {
  const res = resolveRazorpayPaymentMethod('cod');
  assert.strictEqual(res.category, 'cod');
  assert.strictEqual(res.timeline, null);
  assert.strictEqual(res.refundMessage, null);
});

it('Order confirmation page HTML includes payment row and refund timeframe notice elements', () => {
  assert(htmlContent.includes('id="confirmPaymentRow"'), 'Must have #confirmPaymentRow');
  assert(htmlContent.includes('id="confirmPaymentMethod"'), 'Must have #confirmPaymentMethod');
  assert(htmlContent.includes('id="confirmRefundTimeframeBox"'), 'Must have #confirmRefundTimeframeBox');
  assert(htmlContent.includes('id="confirmRefundTimeframeText"'), 'Must have #confirmRefundTimeframeText');
});

it('Client-side script.js implements resolveRazorpayPaymentMethod and handles refund display', () => {
  assert(scriptContent.includes('function resolveRazorpayPaymentMethod'), 'Must define resolveRazorpayPaymentMethod');
  assert(scriptContent.includes('confirmRefundTimeframeBox'), 'Must interact with confirmRefundTimeframeBox');
  assert(scriptContent.includes('confirmRefundTimeframeText'), 'Must interact with confirmRefundTimeframeText');
  assert(scriptContent.includes('Wallets: Refunds typically take 0 to 3 days.'), 'Must handle wallets refund message');
});

// -----------------------------------------------------------------------------
// TEST SUITE 8: Customisation Order Cancellation & Email Notification
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 8: Customisation Order Cancellation & Email Notification');

it('Intercepts status change to "Cancelled" in admin customisation requests', () => {
  const freshScript = fs.readFileSync(path.resolve(ROOT_DIR, 'js/script.js'), 'utf8');
  assert(freshScript.includes("openAdminCancelModal(req, 'customisation')"), 'Customisation status change triggers cancellation modal with customisation context');
  assert(freshScript.includes('data-req-id='), 'Customisation status dropdowns include data-req-id for robust tracking');
});

it('Customisation cancellation email template matches required wording and subject', () => {
  const emailServiceContent = fs.readFileSync(path.resolve(ROOT_DIR, 'server/emailService.js'), 'utf8');
  assert(emailServiceContent.includes('Your Jayashree Customisation Request #${cleanOrderNum} Has Been Cancelled'), 'Subject matches customisation specification');
  assert(emailServiceContent.includes('We regret to inform you that your customisation request #${cleanOrderNum} for ${cleanProduct} has been cancelled by Jayashree.'), 'Body text matches customisation specification');
  assert(emailServiceContent.includes('itemType = \'order\''), 'sendCancellationEmail supports itemType parameter');
});

it('Customisation cancellation commits status change and dispatches adminCustomisationStatusChanged event', () => {
  const freshScript = fs.readFileSync(path.resolve(ROOT_DIR, 'js/script.js'), 'utf8');
  assert(freshScript.includes('commitAdminCustomisationStatusChange'), 'Defines commitAdminCustomisationStatusChange');
  assert(freshScript.includes('adminCustomisationStatusChanged'), 'Dispatches adminCustomisationStatusChanged event');
});

itAsync('API handles customisation cancellation without email cleanly', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: { 'x-admin-verified': 'true' },
    body: {
      orderId: 'CUST-304',
      itemType: 'customisation',
      sendEmail: false,
      orderData: {
        customerName: 'Kavitha Sundaram',
        email: 'kavitha.sundaram@example.com',
        design: 'Handcrafted lehenga'
      }
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (payload) => { responseData = payload; }
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200, 'Expected HTTP 200');
  assert.strictEqual(responseData.success, true, 'Cancellation should succeed');
  assert.strictEqual(responseData.itemType, 'customisation', 'Item type should be customisation');
  assert(responseData.message.includes('Customisation request #CUST-304 cancelled successfully'), 'Expected customisation success message');
});

itAsync('API rejects customisation cancellation email when email address is missing', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: { 'x-admin-verified': 'true' },
    body: {
      orderId: 'CUST-305',
      itemType: 'customisation',
      sendEmail: true,
      orderData: {
        customerName: 'Guest Customer',
        email: '',
        design: 'Bespoke Saree'
      }
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (payload) => { responseData = payload; }
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 400, 'Expected HTTP 400 for missing customer email');
  assert.strictEqual(responseData.success, false);
  assert(responseData.error.includes('No registered customer email address found on this customisation request'));
});

// -----------------------------------------------------------------------------
// TEST SUITE 9: Razorpay Payment Customer Order Confirmation Email
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 9: Razorpay Payment Customer Order Confirmation Email');

import confirmationEmailHandler from './api/orders/confirmation-email.js';
import { sendOrderConfirmationEmail } from './server/emailService.js';

it('sendOrderConfirmationEmail template matches required wording, structure, and sender', () => {
  const emailServiceContent = fs.readFileSync(path.resolve(ROOT_DIR, 'server/emailService.js'), 'utf8');
  assert(emailServiceContent.includes('Your Jayashree Order #${cleanOrderNum} Has Been Confirmed!'), 'Subject matches order confirmation specification');
  assert(emailServiceContent.includes('Thank you for your purchase with Jayashree!'), 'Body greeting matches specification');
  assert(emailServiceContent.includes('designerjayashree9@gmail.com'), 'Sender matches designerjayashree9@gmail.com');
});

itAsync('Validates recipient email before sending order confirmation email', async () => {
  try {
    await sendOrderConfirmationEmail({
      to: 'invalid-email',
      customerName: 'Pooja',
      orderNumber: '2026',
      productName: 'Silk Lehenga'
    });
    assert.fail('Should reject invalid email');
  } catch (err) {
    assert(err.message.includes('Invalid recipient email address'), 'Expected email validation error');
  }
});

itAsync('API rejects non-POST requests to /api/orders/confirmation-email', async () => {
  let statusCode = 0;
  const mockReq = { method: 'GET', headers: {} };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: () => {}
  };
  await confirmationEmailHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 405, 'Expected 405 Method Not Allowed');
});

itAsync('API rejects order confirmation email when email address is missing', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: {},
    body: {
      orderNumber: '5566',
      customerName: 'Priya',
      customerEmail: ''
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (payload) => { responseData = payload; }
  };
  await confirmationEmailHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 400, 'Expected 400 for missing email');
  assert.strictEqual(responseData.success, false);
});

itAsync('API rejects order confirmation email when order number is missing', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: {},
    body: {
      customerEmail: 'customer@example.com',
      orderNumber: ''
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (payload) => { responseData = payload; }
  };
  await confirmationEmailHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 400, 'Expected 400 for missing order number');
  assert.strictEqual(responseData.success, false);
});

it('Client-side script.js dispatches /api/orders/confirmation-email on Razorpay payment completion', () => {
  const freshScript = fs.readFileSync(path.resolve(ROOT_DIR, 'js/script.js'), 'utf8');
  assert(freshScript.includes('/api/orders/confirmation-email'), 'Must call /api/orders/confirmation-email in script.js');
  assert(freshScript.includes("paymentStatus === 'Paid' || razorpayData"), 'Must trigger on verified paid / Razorpay order');
});

// -----------------------------------------------------------------------------
// TEST SUITE 10: Automatic Background Email Retry Queue System
// -----------------------------------------------------------------------------
console.log('\n▶️ TEST SUITE 10: Automatic Background Email Retry Queue System');

import { enqueueEmail, getQueueData, processQueue } from './server/emailQueueService.js';

it('enqueueEmail enqueues cancellation and order confirmation notifications persistently', () => {
  const queued = enqueueEmail({
    type: 'cancellation',
    orderId: 'TEST-Q-101',
    orderNumber: '101',
    customerEmail: 'customer101@example.com',
    customerName: 'Priya',
    productName: 'Silk Anarkali',
    lastError: 'Daily limit exceeded (500 mails/day)'
  });

  assert(queued.id && queued.id.startsWith('email_q_'), 'Expected valid queue ID');
  assert.strictEqual(queued.type, 'cancellation');
  assert.strictEqual(queued.orderId, 'TEST-Q-101');
  assert.strictEqual(queued.status, 'pending');

  const data = getQueueData();
  const found = data.queue.find(item => item.id === queued.id);
  assert(found, 'Item must be stored in persistent email queue');
  assert.strictEqual(found.customerEmail, 'customer101@example.com');
});

it('Deduplicates duplicate enqueue requests for the same order and email type', () => {
  const q1 = enqueueEmail({
    type: 'cancellation',
    orderId: 'TEST-DEDUP-200',
    orderNumber: '200',
    customerEmail: 'dedup@example.com',
    lastError: 'Rate limit error 1'
  });

  const q2 = enqueueEmail({
    type: 'cancellation',
    orderId: 'TEST-DEDUP-200',
    orderNumber: '200',
    customerEmail: 'dedup@example.com',
    lastError: 'Rate limit error 2'
  });

  assert.strictEqual(q1.id, q2.id, 'Deduplication should reuse existing pending queue item');
  assert.strictEqual(q2.lastError, 'Rate limit error 2', 'Updates latest error message');
});

itAsync('cancel-order endpoint automatically queues email on failure and returns queued: true without requiring manual resend', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: { 'x-admin-verified': 'true' },
    body: {
      orderId: 'JAY-QUEUE-999',
      sendEmail: true,
      orderData: {
        orderNumber: '999',
        customerName: 'Test Customer',
        customerEmail: 'test.quota@example.com',
        product: 'Banarasi Brocade Suit'
      }
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (payload) => { responseData = payload; }
  };

  await cancelOrderHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200, 'Expected HTTP 200 with queue confirmation');
  assert.strictEqual(responseData.cancelled, true, 'Order is cancelled');
  assert.strictEqual(responseData.queued, true, 'Email is queued for automatic background retry');
  assert(responseData.queueId, 'Returns queue ID tracking item');

  const queueData = getQueueData();
  const inQueue = queueData.queue.find(item => item.id === responseData.queueId);
  assert(inQueue, 'Item exists in email queue');
  assert.strictEqual(inQueue.customerEmail, 'test.quota@example.com');
});

itAsync('confirmation-email endpoint automatically queues email on failure and returns queued: true', async () => {
  let statusCode = 0;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    headers: {},
    body: {
      orderId: 'JAY-CONF-888',
      orderNumber: '888',
      customerName: 'Aarti',
      customerEmail: 'aarti.confirm@example.com',
      product: 'Georgette Kurti'
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return mockRes; },
    json: (payload) => { responseData = payload; }
  };

  await confirmationEmailHandler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200, 'Expected HTTP 200 with queue confirmation');
  assert.strictEqual(responseData.queued, true, 'Email is queued for automatic background retry');
  assert(responseData.queueId, 'Returns queue ID');
});

it('Client-side script.js removes Retry Email Notification button and uses automatic background queuing', () => {
  const freshScript = fs.readFileSync(path.resolve(ROOT_DIR, 'js/script.js'), 'utf8');
  assert(!freshScript.includes('Retry Email Notification'), 'Retry Email Notification button should be removed from script.js');
  assert(freshScript.includes("const notifStatus = 'queued'"), 'Sets notificationStatus to queued');
  assert(freshScript.includes('syncQueuedEmailNotifications'), 'Includes automatic queue synchronization');
});

it('Admin tables render automatic email status badges without manual retry button', () => {
  const freshScript = fs.readFileSync(path.resolve(ROOT_DIR, 'js/script.js'), 'utf8');
  assert(freshScript.includes('admin-email-badge queued'), 'Orders table renders queued email badge');
  assert(freshScript.includes('admin-cust-email-badge queued'), 'Customisation cards render queued email badge');
  assert(!freshScript.includes('Retry Email Notification'), 'No manual retry email buttons in admin tables');
});

// Summary
console.log('\n================================================================');
console.log(`📊 TEST RESULTS: ${passCount}/${passCount + failCount} Passed (${failCount} Failed)`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All tests passed with 100% success!\n');
}
