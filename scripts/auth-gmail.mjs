import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

dotenv.config({ path: envPath });

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n❌ Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env.');
  console.error('Please ensure both keys are set in ~/Desktop/key/.env before running this script.\n');
  process.exit(1);
}

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline',
  prompt: 'consent'
}).toString();

console.log('\n=============================================================');
console.log('🔑 JAYASHREE GMAIL API OAUTH AUTHORISATION HELPER');
console.log('=============================================================');
console.log(`\n1. Starting local callback receiver on: ${REDIRECT_URI}`);
console.log(`2. Opening Google Sign-in in your browser...\n`);

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/oauth2callback') {
    const code = parsedUrl.query.code;
    const error = parsedUrl.query.error;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#d93025;">❌ Authorisation Cancelled or Failed</h2>
          <p>${error}</p>
          <p>You can close this tab and try again.</p>
        </div>
      `);
      console.error(`❌ Google returned error: ${error}`);
      server.close();
      process.exit(1);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing authorization code');
      return;
    }

    try {
      console.log('🔄 Authorization code received. Exchanging for refresh token...');
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        }).toString()
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.refresh_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'No refresh token returned. Ensure prompt=consent is used.');
      }

      // Securely save refresh token to .env
      const targetPaths = Array.from(new Set(['/Users/apple/Desktop/key/.env', envPath]));
      for (const targetFile of targetPaths) {
        if (fs.existsSync(path.dirname(targetFile))) {
          let envContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
          if (/GMAIL_REFRESH_TOKEN\s*=/i.test(envContent)) {
            envContent = envContent.replace(/GMAIL_REFRESH_TOKEN\s*=.*$/m, `GMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`);
          } else {
            envContent += `\nGMAIL_REFRESH_TOKEN=${tokenData.refresh_token}`;
          }
          if (!/GMAIL_SENDER_EMAIL\s*=/i.test(envContent)) {
            envContent += `\nGMAIL_SENDER_EMAIL=designerjayashree9@gmail.com`;
          }
          fs.writeFileSync(targetFile, envContent.trim() + '\n', 'utf8');
        }
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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

      console.log('✅ SUCCESS: GMAIL_REFRESH_TOKEN securely saved to .env!');
      console.log('✅ Sender email configured: designerjayashree9@gmail.com');
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    } catch (err) {
      console.error('❌ Token exchange failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#d93025;">❌ Token Exchange Failed</h2>
          <p>${err.message}</p>
        </div>
      `);
      server.close();
      process.exit(1);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('ℹ️ Port 3000 is already in use by the local dev server (which is already configured to handle /oauth2callback).');
    console.log(`👉 Please complete authorisation in your browser:\n\n${authUrl}\n`);
    exec(`open "${authUrl}"`, (openErr) => {
      if (openErr) console.log('Notice: Could not automatically launch browser. Please click the link above.');
    });
  } else {
    console.error('Server error:', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`👉 If your browser does not open automatically, visit this URL:\n\n${authUrl}\n`);
  exec(`open "${authUrl}"`, (err) => {
    if (err) console.log('Notice: Could not automatically launch browser. Please click the link above.');
  });
});
