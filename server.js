import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { handleChatMessage, verifyOrSelectModel } from './server/chatbotService.js';
import { resolveRazorpayPaymentMethod } from './server/cancellationService.js';

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

// Verify Payment Signature Endpoint with Timing-Safe HMAC Verification and Method Resolution
app.post('/api/payment/verify', async (req, res) => {
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

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      verified: false,
      error: 'Payment signature verification failed'
    });
  }

  // Fetch actual payment details from Razorpay if credentials exist
  let paymentDetails = null;
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (keyId && keySecret) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const pRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`, {
        headers: { 'Authorization': authHeader }
      });
      if (pRes.ok) {
        paymentDetails = await pRes.json();
      }
    } catch (pErr) {
      console.warn('Could not fetch Razorpay payment details:', pErr.message);
    }
  }

  // Resolve payment method using verified transaction details or trusted request parameters
  const methodInput = paymentDetails || req.body.paymentDetails || req.body.paymentMethod || req.body.method;
  const resolved = resolveRazorpayPaymentMethod(methodInput);

  return res.json({
    success: true,
    verified: true,
    paymentMethod: resolved.label,
    methodCategory: resolved.category,
    rawMethod: paymentDetails?.method || req.body.method || (resolved.isIdentified ? resolved.category : null),
    refundTimeframe: resolved.timeline,
    refundMessage: resolved.refundMessage,
    isIdentified: resolved.isIdentified,
    payment: paymentDetails ? {
      id: paymentDetails.id,
      method: paymentDetails.method,
      card: paymentDetails.card,
      bank: paymentDetails.bank,
      wallet: paymentDetails.wallet,
      vpa: paymentDetails.vpa
    } : null
  });
});

// Admin Order Cancellation with Gmail API Notification Endpoint
app.post('/api/admin/cancel-order', async (req, res) => {
  const { default: handler } = await import('./api/admin/cancel-order.js');
  return handler(req, res);
});

// Order Cancellation Eligibility & Refund Information Endpoint
app.post('/api/orders/eligibility', async (req, res) => {
  const { default: handler } = await import('./api/orders/eligibility.js');
  return handler(req, res);
});

// Order Confirmation Email Notification Endpoint
app.post('/api/orders/confirmation-email', async (req, res) => {
  const { default: handler } = await import('./api/orders/confirmation-email.js');
  return handler(req, res);
});

// OAuth2 Callback Handler for 1-Click Authorisation
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.status(400).send(`<h3>❌ Google Authorisation Error</h3><p>${error}</p>`);
  }
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = `${req.protocol}://${req.get('host')}/oauth2callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'No refresh token returned');
    }

    const targetPaths = Array.from(new Set(['/Users/apple/Desktop/key/.env', path.join(__dirname, '.env')]));
    for (const envFilePath of targetPaths) {
      if (fs.existsSync(path.dirname(envFilePath))) {
        let envContent = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf8') : '';
        if (/GMAIL_REFRESH_TOKEN\s*=/i.test(envContent)) {
          envContent = envContent.replace(/GMAIL_REFRESH_TOKEN\s*=.*$/m, `GMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`);
        } else {
          envContent += `\nGMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`;
        }
        if (!/GMAIL_SENDER_EMAIL\s*=/i.test(envContent)) {
          envContent += `\nGMAIL_SENDER_EMAIL=designerjayashree9@gmail.com`;
        }
        fs.writeFileSync(envFilePath, envContent.trim() + '\n', 'utf8');
      }
    }
    process.env.GMAIL_REFRESH_TOKEN = tokenData.refresh_token;

    return res.send(`
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:60px;text-align:center;max-width:500px;margin:40px auto;border:1px solid #e5d9c5;border-radius:16px;background:#FAF7F2;color:#4A382A;">
        <div style="font-size:48px;margin-bottom:16px;">✨</div>
        <h2 style="margin:0 0 10px;color:#4A382A;">Gmail Authorisation Successful!</h2>
        <p style="color:#6B5D52;font-size:15px;line-height:1.5;">Your refresh token has been securely saved to your local <code>.env</code> file. The Jayashree website is now configured to send cancellation emails from <strong>designerjayashree9@gmail.com</strong>.</p>
        <div style="margin-top:24px;padding:12px;background:#EEF8F1;border:1px solid #BBF7D0;border-radius:8px;color:#15803D;font-weight:600;font-size:13px;">
          ✓ Safe to close this tab
        </div>
      </div>
    `);
  } catch (err) {
    return res.status(500).send(`<h3>❌ Token Exchange Failed</h3><p>${err.message}</p>`);
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
