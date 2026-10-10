import { handleChatMessage } from '../../server/chatbotService.js';

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
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
      }
    } else if (!body && req.on) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
      }
    }
    body = body || {};

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const authHeader = req.headers['authorization'] || '';
    let authUser = null;
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

    res.status(result.status || 200).json(result);
  } catch (err) {
    console.error('Vercel api/chat error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error processing chat message',
      answer: "I'm sorry, I'm currently unable to process your request. Please visit our Help Centre or contact us at +91 9177976293."
    });
  }
}
