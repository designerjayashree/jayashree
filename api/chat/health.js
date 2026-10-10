import { verifyOrSelectModel } from '../../server/chatbotService.js';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');
    let activeModel = process.env.OPENAI_MODEL || 'gpt-6-luna';
    if (hasKey) {
      try {
        activeModel = await verifyOrSelectModel();
      } catch {
        // ignore
      }
    }

    res.status(200).json({
      status: 'ok',
      aiConfigured: hasKey,
      activeModel
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
}
