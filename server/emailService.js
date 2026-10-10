import fs from 'fs';
import path from 'path';

/**
 * In-memory cache for access tokens
 */
let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid access token using the stored refresh token
 */
export async function getGmailAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail API credentials incomplete. Ensure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN are configured in .env');
  }

  // Return cached token if valid (with 60-second buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to refresh Gmail access token: ${data.error_description || data.error || res.statusText}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
  return cachedAccessToken;
}

/**
 * Format RFC 2822 cancellation email and send via Gmail REST API
 */
export async function sendCancellationEmail({ to, customerName, orderNumber, productName, itemType = 'order' }) {
  if (!to || !to.includes('@')) {
    throw new Error(`Invalid recipient email address: "${to}"`);
  }

  const accessToken = await getGmailAccessToken();
  const senderEmail = process.env.GMAIL_SENDER_EMAIL || 'designerjayashree9@gmail.com';
  const cleanOrderNum = String(orderNumber || '').replace(/^#/, '');
  const cleanCustomerName = customerName && customerName !== '—' && customerName.toLowerCase() !== 'customer'
    ? customerName.trim()
    : 'Customer';
  const cleanProduct = productName || (itemType === 'customisation' ? 'Customised Outfit' : 'Designer Outfit');

  const isCustomisation = itemType === 'customisation';
  const subject = isCustomisation
    ? `Your Jayashree Customisation Request #${cleanOrderNum} Has Been Cancelled`
    : `Your Jayashree Order #${cleanOrderNum} Has Been Cancelled`;

  const body = isCustomisation
    ? `Dear ${cleanCustomerName},

We regret to inform you that your customisation request #${cleanOrderNum} for ${cleanProduct} has been cancelled by Jayashree.

We apologise for any inconvenience caused. If you have any questions or need assistance, please contact our Help Centre.

Regards,
Jayashree Team
${senderEmail}`
    : `Dear ${cleanCustomerName},

We regret to inform you that your order #${cleanOrderNum} for ${cleanProduct} has been cancelled by Jayashree.

We apologise for any inconvenience caused. If you have any questions or need assistance, please contact our Help Centre.

Regards,
Jayashree Team
${senderEmail}`;

  // Build standard RFC 2822 email format
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const rawMessage = [
    `From: "Jayashree Team" <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body
  ].join('\r\n');

  // Base64URL encode for Gmail API
  const base64UrlMessage = Buffer.from(rawMessage, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64UrlMessage })
  });

  const resData = await res.json();
  if (!res.ok) {
    const errMsg = resData.error?.message || `Gmail API error (${res.status})`;
    throw new Error(errMsg);
  }

  return {
    success: true,
    messageId: resData.id,
    threadId: resData.threadId,
    recipient: to
  };
}

/**
 * Check whether Gmail API credentials are ready for sending
 */
export function isGmailConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

/**
 * Format RFC 2822 order confirmation email and send via Gmail REST API
 */
export async function sendOrderConfirmationEmail({
  to,
  customerName,
  orderNumber,
  productName,
  size,
  amount,
  paymentMethod,
  deliveryAddress,
  estimatedDelivery
}) {
  if (!to || !to.includes('@')) {
    throw new Error(`Invalid recipient email address: "${to}"`);
  }

  const accessToken = await getGmailAccessToken();
  const senderEmail = process.env.GMAIL_SENDER_EMAIL || 'designerjayashree9@gmail.com';
  const cleanOrderNum = String(orderNumber || '').replace(/^#/, '');
  const cleanCustomerName = customerName && customerName !== '—' && customerName.toLowerCase() !== 'customer'
    ? customerName.trim()
    : 'Customer';
  const cleanProduct = productName || 'Designer Outfit';
  const cleanSize = size || 'Standard';
  const cleanAmount = amount || '₹1,999';
  const cleanPaymentMethod = paymentMethod || 'Online Payment (Razorpay)';
  const cleanAddress = deliveryAddress || 'Registered Delivery Address';
  const cleanDelivery = estimatedDelivery || '4–7 Business Days';

  const subject = `Your Jayashree Order #${cleanOrderNum} Has Been Confirmed!`;
  const body = `Dear ${cleanCustomerName},

Thank you for your purchase with Jayashree! We are pleased to confirm that your order #${cleanOrderNum} has been received and your payment has been successfully processed via ${cleanPaymentMethod}.

Order Details:
----------------------------------------
Order Number: #${cleanOrderNum}
Product: ${cleanProduct}
Size: ${cleanSize}
Total Amount: ${cleanAmount}
Payment Status: Paid (${cleanPaymentMethod})
Estimated Delivery: ${cleanDelivery}

Delivery Address:
${cleanAddress}
----------------------------------------

You can view and track your order anytime under "My Orders" on our website.

If you have any questions or need styling assistance, please feel free to reach out to us at ${senderEmail} or contact our Help Centre.

Warm regards,
Jayashree Team
${senderEmail}`;

  // Build standard RFC 2822 email format
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const rawMessage = [
    `From: "Jayashree Team" <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body
  ].join('\r\n');

  // Base64URL encode for Gmail API
  const base64UrlMessage = Buffer.from(rawMessage, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64UrlMessage })
  });

  const resData = await res.json();
  if (!res.ok) {
    const errMsg = resData.error?.message || `Gmail API error (${res.status})`;
    throw new Error(errMsg);
  }

  return {
    success: true,
    messageId: resData.id,
    threadId: resData.threadId,
    recipient: to
  };
}
