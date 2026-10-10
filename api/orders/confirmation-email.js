import { sendOrderConfirmationEmail, isGmailConfigured } from '../../server/emailService.js';

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

    const recipientEmail = (body.customerEmail || body.email || body.to || '').trim();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        emailSent: false,
        error: 'Valid recipient email address is required'
      });
    }

    const orderNumber = String(body.orderNumber || body.orderId || '').replace(/^#/, '');
    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        emailSent: false,
        error: 'Order number is required'
      });
    }

    if (!isGmailConfigured()) {
      return res.status(503).json({
        success: false,
        emailSent: false,
        error: 'Gmail API is not fully authorised on the server. Please check .env credentials.'
      });
    }

    const customerName = (body.customerName || body.name || 'Valued Customer').trim();
    const productName = (body.product || body.productName || 'Designer Outfit').trim();
    const size = (body.size || 'Standard').trim();
    const amount = (body.amount || body.price || '₹1,999').trim();
    const paymentMethod = (body.paymentMethod || 'Online Payment (Razorpay)').trim();
    const deliveryAddress = (body.deliveryAddress || body.address || 'Registered Delivery Address').trim();
    const estimatedDelivery = (body.estimatedDelivery || '4–7 Business Days').trim();

    try {
      const sendRes = await sendOrderConfirmationEmail({
        to: recipientEmail,
        customerName,
        orderNumber,
        productName,
        size,
        amount,
        paymentMethod,
        deliveryAddress,
        estimatedDelivery
      });

      return res.status(200).json({
        success: true,
        emailSent: true,
        orderNumber,
        recipient: recipientEmail,
        messageId: sendRes.messageId || null,
        message: `Order #${orderNumber} confirmation email sent to ${recipientEmail}`
      });
    } catch (sendErr) {
      console.error('Order confirmation email sending error:', sendErr.message);
      return res.status(502).json({
        success: false,
        emailSent: false,
        error: `Order confirmed, but email delivery failed: ${sendErr.message}`
      });
    }
  } catch (err) {
    console.error('Order confirmation email handler error:', err);
    return res.status(500).json({
      success: false,
      emailSent: false,
      error: 'Internal server error sending order confirmation email'
    });
  }
}
