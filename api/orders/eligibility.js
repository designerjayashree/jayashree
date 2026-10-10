import { checkCancellationEligibility, getRefundDetails } from '../../server/cancellationService.js';

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

    const { order } = body;
    if (!order) {
      return res.status(400).json({ success: false, error: 'Order object is required' });
    }

    const serverNow = Date.now();
    const eligibility = checkCancellationEligibility(order, serverNow);
    const refundInfo = getRefundDetails(order);

    return res.status(200).json({
      success: true,
      serverTime: serverNow,
      eligibility,
      refundInfo
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
