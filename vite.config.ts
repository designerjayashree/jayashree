import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

dotenv.config();

function paymentApiPlugin(): Plugin {
  return {
    name: 'payment-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/payment/')) {
          return next();
        }

        const parseBody = (callback: (body: any) => void) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => {
            try {
              callback(data ? JSON.parse(data) : {});
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
          });
        };

        if (req.url === '/api/payment/config' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const keyId = process.env.RAZORPAY_KEY_ID || '';
          res.end(JSON.stringify({
            configured: Boolean(keyId),
            keyId: keyId || null
          }));
          return;
        }

        if (req.url === '/api/payment/create-order' && req.method === 'POST') {
          parseBody(async (body) => {
            const keyId = process.env.RAZORPAY_KEY_ID;
            const keySecret = process.env.RAZORPAY_KEY_SECRET;

            if (!keyId || !keySecret) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                configured: false,
                error: 'Online payment gateway is not configured with server credentials. Please use Cash on Delivery.'
              }));
              return;
            }

            try {
              const numAmount = Number(body.amount);
              if (!numAmount || isNaN(numAmount) || numAmount < 100 || numAmount > 200000) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  error: 'Invalid payment amount. Amount must be between ₹100 and ₹2,00,000.'
                }));
                return;
              }

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
                  receipt: String(body.receipt || `rcpt_${Date.now()}`).slice(0, 40)
                })
              });
              const rzpData = (await rzpRes.json()) as any;
              if (!rzpRes.ok) {
                res.statusCode = rzpRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: rzpData.error?.description || 'Failed to create payment order' }));
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, order: rzpData, keyId }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || 'Server error creating payment order' }));
            }
          });
          return;
        }

        if (req.url === '/api/payment/verify' && req.method === 'POST') {
          parseBody((body) => {
            const keySecret = process.env.RAZORPAY_KEY_SECRET;
            if (!keySecret) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                verified: false,
                error: 'Online payment verification credentials not configured on server'
              }));
              return;
            }

            const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;
            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, verified: false, error: 'Missing payment signature verification parameters' }));
              return;
            }

            const expectedSignature = crypto
              .createHmac('sha256', keySecret)
              .update(`${razorpayOrderId}|${razorpayPaymentId}`)
              .digest('hex');

            const expectedBuf = Buffer.from(expectedSignature, 'utf8');
            const sigBuf = Buffer.from(String(razorpaySignature), 'utf8');
            const isMatch = expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);

            res.setHeader('Content-Type', 'application/json');
            if (isMatch) {
              res.end(JSON.stringify({ success: true, verified: true }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, verified: false, error: 'Payment signature verification failed' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

function chatbotApiPlugin(): Plugin {
  return {
    name: 'chatbot-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/chat')) {
          return next();
        }

        const parseBody = (callback: (body: any) => void) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => {
            try {
              callback(data ? JSON.parse(data) : {});
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
          });
        };

        if (req.url === '/api/chat/health' && req.method === 'GET') {
          try {
            const { verifyOrSelectModel } = await import('./server/chatbotService.js');
            const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');
            let activeModel = process.env.OPENAI_MODEL || 'gpt-6-luna';
            if (hasKey) {
              try {
                activeModel = await verifyOrSelectModel();
              } catch {
                // ignore
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'ok',
              aiConfigured: hasKey,
              activeModel: activeModel
            }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'error', error: err.message }));
          }
          return;
        }

        if (req.url === '/api/chat' && req.method === 'POST') {
          parseBody(async (body) => {
            try {
              const { handleChatMessage } = await import('./server/chatbotService.js');
              const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
              const authHeader = req.headers.authorization || '';
              let authUser: any = null;
              if (authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7).trim();
                if (token) {
                  authUser = { token };
                }
              }

              const result = await handleChatMessage({
                message: body.message,
                history: body.history,
                authUser,
                clientIp
              });

              res.statusCode = result.status || 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: 'Internal server error processing chat message',
                answer: "I'm sorry, I'm currently unable to process your request. Please visit our Help Centre or contact us at +91 9177976293."
              }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), paymentApiPlugin(), chatbotApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname ?? '.', '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

