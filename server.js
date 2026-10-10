import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { handleChatMessage, verifyOrSelectModel } from './server/chatbotService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// JSON body parser with strict size limits
app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Chatbot Health & Model Status Endpoint
app.get('/api/chat/health', async (_req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');
  let activeModel = process.env.OPENAI_MODEL || 'gpt-6-luna';
  if (hasKey) {
    try {
      activeModel = await verifyOrSelectModel();
    } catch {
      // ignore
    }
  }
  res.json({
    status: 'ok',
    aiConfigured: hasKey,
    activeModel: activeModel
  });
});

// Chatbot Message Endpoint with Rate Limiting and Privacy Protection
app.post('/api/chat', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { message, history } = req.body || {};
  
  // Extract Bearer token if customer is authenticated
  const authHeader = req.headers.authorization || '';
  let authUser = null;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      authUser = { token };
    }
  }

  try {
    const result = await handleChatMessage({
      message,
      history,
      authUser,
      clientIp
    });

    res.status(result.status || 200).json(result);
  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error processing chat message',
      answer: "I'm sorry, I'm currently unable to process your request. Please visit our Help Centre or contact us at +91 9177976293."
    });
  }
});

// Payment Configuration Endpoint
app.get('/api/payment/config', (_req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  res.json({
    configured: Boolean(keyId),
    keyId: keyId || null
  });
});

// Create Razorpay Order Endpoint with Server-Side Amount Validation
app.post('/api/payment/create-order', async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(503).json({
      success: false,
      configured: false,
      error: 'Online payment gateway is not configured with server credentials. Please use Cash on Delivery.'
    });
  }

  const { amount, receipt } = req.body;
  const numAmount = Number(amount);

  // Validate amount range and format
  if (!numAmount || isNaN(numAmount) || numAmount < 100 || numAmount > 200000) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment amount. Amount must be between ₹100 and ₹2,00,000.'
    });
  }

  try {
    const amountInPaise = Math.round(numAmount * 100);
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40)
      })
    });

    const rzpData = await rzpRes.json();
    if (!rzpRes.ok) {
      return res.status(rzpRes.status).json({
        success: false,
        error: rzpData.error?.description || 'Failed to create payment order'
      });
    }

    return res.json({ success: true, order: rzpData, keyId });
  } catch (err) {
    console.error('Server error creating payment order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error creating payment order'
    });
  }
});

// Verify Payment Signature Endpoint with Timing-Safe HMAC Verification
app.post('/api/payment/verify', (req, res) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(503).json({
      success: false,
      verified: false,
      error: 'Online payment verification credentials not configured on server'
    });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      success: false,
      verified: false,
      error: 'Missing payment signature verification parameters'
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const sigBuf = Buffer.from(String(razorpaySignature), 'utf8');
  const isMatch = expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);

  if (isMatch) {
    return res.json({ success: true, verified: true });
  } else {
    return res.status(400).json({
      success: false,
      verified: false,
      error: 'Payment signature verification failed'
    });
  }
});

// Serve static production build files if dist/ exists
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// SPA catch-all fallback
app.get('*', (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Jayashree Fashion — Static files build not found. Run `npm run build` first.');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Jayashree Fashion Server running on http://0.0.0.0:${PORT}`);
});
