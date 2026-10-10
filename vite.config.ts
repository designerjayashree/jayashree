import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
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
          parseBody(async (body) => {
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
            if (!isMatch) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, verified: false, error: 'Payment signature verification failed' }));
              return;
            }

            let paymentDetails: any = null;
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
              } catch (pErr: any) {
                console.warn('Could not fetch Razorpay payment details:', pErr.message);
              }
            }

            const { resolveRazorpayPaymentMethod } = await import('./server/cancellationService.js');
            const methodInput = paymentDetails || body.paymentDetails || body.paymentMethod || body.method;
            const resolved = resolveRazorpayPaymentMethod(methodInput);

            res.end(JSON.stringify({
              success: true,
              verified: true,
              paymentMethod: resolved.label,
              methodCategory: resolved.category,
              rawMethod: paymentDetails?.method || body.method || (resolved.isIdentified ? resolved.category : null),
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
            }));
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

function adminOrderApiPlugin(): Plugin {
  return {
    name: 'admin-order-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/oauth2callback') && req.method === 'GET') {
          const reqUrl = new URL(req.url, 'http://localhost:3000');
          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<h3>❌ Google Authorisation Error</h3><p>${error}</p>`);
            return;
          }
          if (!code) {
            res.statusCode = 400;
            res.end('Missing authorization code');
            return;
          }

          const clientId = process.env.GMAIL_CLIENT_ID;
          const clientSecret = process.env.GMAIL_CLIENT_SECRET;
          const redirectUri = 'http://localhost:3000/oauth2callback';

          try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code: String(code),
                client_id: clientId || '',
                client_secret: clientSecret || '',
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
              }).toString()
            });

            const tokenData = (await tokenRes.json()) as any;
            if (!tokenRes.ok || !tokenData.refresh_token) {
              throw new Error(tokenData.error_description || tokenData.error || 'No refresh token returned');
            }

            const targetPaths = Array.from(new Set(['/Users/apple/Desktop/key/.env', path.join(process.cwd(), '.env')]));
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

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`
              <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:60px;text-align:center;max-width:500px;margin:40px auto;border:1px solid #e5d9c5;border-radius:16px;background:#FAF7F2;color:#4A382A;">
                <div style="font-size:48px;margin-bottom:16px;">✨</div>
                <h2 style="margin:0 0 10px;color:#4A382A;">Gmail Authorisation Successful!</h2>
                <p style="color:#6B5D52;font-size:15px;line-height:1.5;">Your refresh token has been securely saved to your local <code>.env</code> file. The Jayashree website is now configured to send cancellation emails from <strong>designerjayashree9@gmail.com</strong>.</p>
                <div style="margin-top:24px;padding:12px;background:#EEF8F1;border:1px solid #BBF7D0;border-radius:8px;color:#15803D;font-weight:600;font-size:13px;">
                  ✓ Safe to close this tab
                </div>
              </div>
            `);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<h3>❌ Token Exchange Failed</h3><p>${err.message}</p>`);
          }
          return;
        }

        if (req.url === '/api/admin/cancel-order' && req.method === 'POST') {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', async () => {
            try {
              const body = data ? JSON.parse(data) : {};
              const { default: handler } = await import('./api/admin/cancel-order.js');
              const mockReq: any = {
                method: 'POST',
                headers: req.headers,
                body
              };
              const mockRes: any = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => {
                  res.statusCode = code;
                  return mockRes;
                },
                json: (payload: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(payload));
                }
              };
              await handler(mockReq, mockRes);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
            }
          });
          return;
        }

        if (req.url === '/api/orders/eligibility' && req.method === 'POST') {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', async () => {
            try {
              const body = data ? JSON.parse(data) : {};
              const { default: handler } = await import('./api/orders/eligibility.js');
              const mockReq: any = {
                method: 'POST',
                headers: req.headers,
                body
              };
              const mockRes: any = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => {
                  res.statusCode = code;
                  return mockRes;
                },
                json: (payload: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(payload));
                }
              };
              await handler(mockReq, mockRes);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
            }
          });
          return;
        }

        if (req.url === '/api/orders/confirmation-email' && req.method === 'POST') {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', async () => {
            try {
              const body = data ? JSON.parse(data) : {};
              const { default: handler } = await import('./api/orders/confirmation-email.js');
              const mockReq: any = {
                method: 'POST',
                headers: req.headers,
                body
              };
              const mockRes: any = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => {
                  res.statusCode = code;
                  return mockRes;
                },
                json: (payload: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(payload));
                }
              };
              await handler(mockReq, mockRes);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
            }
          });
          return;
        }

        if (req.url === '/api/admin/email-queue' && req.method === 'GET') {
          try {
            const { getQueueData } = await import('./server/emailQueueService.js');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, ...getQueueData() }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
          }
          return;
        }

        if (req.url === '/api/admin/email-queue/process' && req.method === 'POST') {
          try {
            const { processQueue } = await import('./server/emailQueueService.js');
            const result = await processQueue();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, result }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
          }
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), paymentApiPlugin(), chatbotApiPlugin(), adminOrderApiPlugin()],

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

