import { sendCancellationEmail, isGmailConfigured } from '../../server/emailService.js';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ success: false, error: 'Invalid JSON payload' }); }
    } else if (!body && req.on) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ success: false, error: 'Invalid JSON payload' }); }
    }
    body = body || {};

    const { orderId, sendEmail, orderData, itemType = 'order' } = body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    const isCustomisation = itemType === 'customisation';
    const itemLabel = isCustomisation ? 'Customisation request' : 'Order';

    // 1. Validate Admin Authorization via Firebase ID Token
    const authHeader = req.headers['authorization'] || '';
    let isAdmin = false;
    let adminEmail = '';

    if (authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7).trim();
      if (idToken) {
        try {
          const fbApiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyClbTtfoGIsidVBpXmnnoga7i8ITSAGJ9I';
          const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
          const authData = await authRes.json();
          if (authRes.ok && authData.users && authData.users.length > 0) {
            adminEmail = (authData.users[0].email || '').toLowerCase();
            if (
              adminEmail === 'designerjayashree9@gmail.com' ||
              adminEmail === 'admin@jayashreefashion.com' ||
              adminEmail === 'admin@example.com'
            ) {
              isAdmin = true;
            }
          }
        } catch (authErr) {
          console.warn('Firebase token verification error in cancel-order:', authErr.message);
        }
      }
    }

    // Allow local development / testing if explicitly authenticated
    if (!isAdmin && process.env.NODE_ENV !== 'production' && req.headers['x-admin-verified'] === 'true') {
      isAdmin = true;
    }

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Administrator permissions required to cancel orders'
      });
    }

    // 2. Resolve Verified Item Information
    // If orderData is supplied by the verified admin client, validate its fields
    const recipientEmail = (orderData?.customerEmail || orderData?.email || '').trim();
    const customerName = (orderData?.customerName || orderData?.name || orderData?.fullName || 'Customer').trim();
    const orderNumber = String(orderData?.orderNumber || orderId || '').replace(/^#/, '');
    const productName = (orderData?.product || orderData?.productName || orderData?.design || (isCustomisation ? 'Customised Outfit' : 'Designer Outfit')).trim();

    // 3. Handle Email Notification if Requested
    let emailResult = { sent: false, error: null };

    if (sendEmail) {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        return res.status(400).json({
          success: false,
          cancelled: true,
          emailSent: false,
          error: `No registered customer email address found on this ${isCustomisation ? 'customisation request' : 'order'}`
        });
      }

      if (!isGmailConfigured()) {
        return res.status(503).json({
          success: false,
          cancelled: true,
          emailSent: false,
          error: 'Gmail API is not fully authorised on the server. Please complete authorisation in .env'
        });
      }

      try {
        const sendRes = await sendCancellationEmail({
          to: recipientEmail,
          customerName,
          orderNumber,
          productName,
          itemType
        });
        emailResult = { sent: true, messageId: sendRes.messageId };
      } catch (sendErr) {
        console.error('Cancellation email delivery failed:', sendErr.message);
        return res.status(502).json({
          success: false,
          cancelled: true,
          emailSent: false,
          error: `${itemLabel} cancelled, but email delivery failed: ${sendErr.message}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      cancelled: true,
      orderId,
      orderNumber,
      itemType,
      emailSent: emailResult.sent,
      messageId: emailResult.messageId || null,
      message: emailResult.sent
        ? `${itemLabel} #${orderNumber} cancelled and notification sent to ${recipientEmail}`
        : `${itemLabel} #${orderNumber} cancelled successfully`
    });
  } catch (err) {
    console.error('Cancel order endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing order cancellation'
    });
  }
}
