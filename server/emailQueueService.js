import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { sendCancellationEmail, sendOrderConfirmationEmail, isGmailConfigured } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'email-queue.json');

let workerInterval = null;
let isProcessing = false;

/**
 * Ensure the persistent data storage directory and file exist
 */
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(QUEUE_FILE)) {
    const initial = {
      queue: [],
      history: [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

/**
 * Read the current queue from persistent storage
 */
export function getQueueData() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lastUpdated: parsed.lastUpdated || new Date().toISOString()
    };
  } catch (err) {
    console.error('Failed to read email queue file:', err.message);
    return { queue: [], history: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Persist queue data atomically to disk
 */
function saveQueueData(data) {
  ensureStorage();
  try {
    const payload = {
      queue: data.queue || [],
      history: (data.history || []).slice(-100), // Keep last 100 historical logs
      lastUpdated: new Date().toISOString()
    };
    const tmpFile = `${QUEUE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpFile, QUEUE_FILE);
  } catch (err) {
    console.error('Failed to save email queue file:', err.message);
  }
}

/**
 * Enqueue an email notification for automatic background delivery & retries
 */
export function enqueueEmail({
  type = 'cancellation', // 'cancellation' | 'confirmation'
  orderId,
  orderNumber,
  customerEmail,
  customerName = 'Customer',
  productName = 'Designer Outfit',
  itemType = 'order', // 'order' | 'customisation'
  payload = {},
  lastError = null,
  retryDelayMs = 0
}) {
  ensureStorage();
  const data = getQueueData();
  const cleanOrderNum = String(orderNumber || orderId || '').replace(/^#/, '');

  // Deduplicate: if an identical pending request for this order and type exists, update it
  const existingIdx = data.queue.findIndex(
    item => item.orderId === orderId && item.type === type && item.status === 'pending'
  );

  const now = Date.now();
  const nextRetryAt = new Date(now + retryDelayMs).toISOString();

  if (existingIdx !== -1) {
    const existing = data.queue[existingIdx];
    existing.customerEmail = customerEmail || existing.customerEmail;
    existing.customerName = customerName || existing.customerName;
    existing.productName = productName || existing.productName;
    existing.payload = { ...(existing.payload || {}), ...payload };
    existing.lastError = lastError || existing.lastError;
    existing.nextRetryAt = nextRetryAt;
    saveQueueData(data);
    return existing;
  }

  const newItem = {
    id: `email_q_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    type,
    orderId: String(orderId || cleanOrderNum),
    orderNumber: cleanOrderNum,
    customerEmail: (customerEmail || '').trim(),
    customerName: (customerName || 'Customer').trim(),
    productName: (productName || 'Designer Outfit').trim(),
    itemType: itemType || 'order',
    payload: payload || {},
    status: 'pending', // 'pending' | 'processing' | 'sent' | 'failed'
    attempts: 0,
    maxAttempts: 25,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    nextRetryAt,
    lastError: lastError ? String(lastError) : null
  };

  data.queue.push(newItem);
  saveQueueData(data);
  console.log(`[EmailQueue] Queued ${type} email for Order #${cleanOrderNum} (${customerEmail})`);
  return newItem;
}

/**
 * Process pending items in the background queue
 */
export async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    ensureStorage();
    const data = getQueueData();
    const nowMs = Date.now();

    const pendingItems = data.queue.filter(
      item => item.status === 'pending' && new Date(item.nextRetryAt).getTime() <= nowMs
    );

    if (pendingItems.length === 0) {
      isProcessing = false;
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!isGmailConfigured()) {
      console.warn('[EmailQueue] Gmail API not configured yet. Retaining queued emails.');
      isProcessing = false;
      return { processed: 0, succeeded: 0, failed: 0, reason: 'Gmail API not configured' };
    }

    let succeeded = 0;
    let failed = 0;

    for (const item of pendingItems) {
      item.status = 'processing';
      item.attempts = (item.attempts || 0) + 1;
      item.lastAttemptAt = new Date().toISOString();

      try {
        let sendResult = null;
        if (item.type === 'cancellation') {
          sendResult = await sendCancellationEmail({
            to: item.customerEmail,
            customerName: item.customerName,
            orderNumber: item.orderNumber,
            productName: item.productName,
            itemType: item.itemType || 'order'
          });
        } else if (item.type === 'confirmation') {
          sendResult = await sendOrderConfirmationEmail({
            to: item.customerEmail,
            customerName: item.customerName,
            orderNumber: item.orderNumber,
            productName: item.productName,
            size: item.payload?.size,
            amount: item.payload?.amount,
            paymentMethod: item.payload?.paymentMethod,
            deliveryAddress: item.payload?.deliveryAddress,
            estimatedDelivery: item.payload?.estimatedDelivery
          });
        }

        item.status = 'sent';
        item.sentAt = new Date().toISOString();
        item.messageId = sendResult?.messageId || null;
        succeeded++;
        console.log(`[EmailQueue] ✓ Successfully delivered queued ${item.type} email for Order #${item.orderNumber} to ${item.customerEmail}`);

        // Move completed item to history
        data.history.push({ ...item });
        data.queue = data.queue.filter(q => q.id !== item.id);
      } catch (err) {
        failed++;
        item.status = 'pending';
        item.lastError = err.message;

        const isQuota = /quota|daily limit|user-rate|ratelimit|exceeded|429|403/i.test(err.message);
        if (isQuota) {
          // If quota reached, wait at least 30 minutes before next background attempt
          const quotaDelayMs = 30 * 60 * 1000;
          item.nextRetryAt = new Date(Date.now() + quotaDelayMs).toISOString();
          console.warn(`[EmailQueue] Quota exceeded for Order #${item.orderNumber}. Next retry scheduled for: ${item.nextRetryAt}`);
        } else {
          // Exponential backoff for transient network errors (1m, 2m, 4m, 8m, 16m, max 30m)
          const backoffMs = Math.min(30 * 60 * 1000, 60000 * Math.pow(2, Math.min(item.attempts, 5)));
          item.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
          console.warn(`[EmailQueue] Delivery error for Order #${item.orderNumber}: ${err.message}. Retrying at: ${item.nextRetryAt}`);
        }

        // If exceeded maximum allowed retry attempts, mark failed
        if (item.attempts >= (item.maxAttempts || 25)) {
          item.status = 'failed';
          item.failedAt = new Date().toISOString();
          data.history.push({ ...item });
          data.queue = data.queue.filter(q => q.id !== item.id);
          console.error(`[EmailQueue] Item ${item.id} reached max retry attempts. Moved to history as failed.`);
        }
      }

      // Persist after each processed item
      saveQueueData(data);
    }

    return { processed: pendingItems.length, succeeded, failed };
  } catch (err) {
    console.error('[EmailQueue] Error processing queue:', err);
    return { error: err.message };
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the automatic background worker timer
 */
export function startQueueWorker(intervalMs = 60000) {
  if (workerInterval) return;
  console.log(`[EmailQueue] Starting automatic background retry worker (interval: ${intervalMs}ms)...`);
  
  // Run an immediate check on startup
  setTimeout(() => {
    processQueue().catch(err => console.error('[EmailQueue] Initial queue run error:', err));
  }, 3000);

  workerInterval = setInterval(() => {
    processQueue().catch(err => console.error('[EmailQueue] Worker error:', err));
  }, intervalMs);

  // Unref timer so node process can exit cleanly during tests / scripts
  if (workerInterval && typeof workerInterval.unref === 'function') {
    workerInterval.unref();
  }
}

/**
 * Stop the background worker timer
 */
export function stopQueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[EmailQueue] Background worker stopped.');
  }
}
