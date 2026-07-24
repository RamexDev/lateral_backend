// Import notification helper.
import { sendPaymentConfirmation } from '../notifications/notifications.service.js';
// Import MySQL pool.
import { pool } from '../../db/pool.js';
// Import Redis client.
import { redis } from '../../lib/redis.js';
// Import API error class.
import { ApiError } from '../../lib/errors.js';
// Import logger.
import { logger } from '../../lib/logger.js';
// Import payment provider.
import { paymentProvider } from './paymentProvider.js';
// Import env config.
import { env } from '../../config/env.js';
// Import crypto for unique tx_ref generation.
import crypto from 'node:crypto';

// Reveal price in ETB (configurable via env).
const REVEAL_PRICE_ETB = Number(env.REVEAL_PRICE_ETB) || 500;

// Purchase race lock TTL in seconds.
const PURCHASE_LOCK_TTL = 5;

// Generate a unique transaction reference.
function generateTxRef(purchaseId) {
  return 'zwuwur-payment-' + purchaseId + '-' + crypto.randomBytes(4).toString('hex');
}

// Initiate a purchase (paid reveal) for a target candidate.
export async function createPurchase(buyerId, targetUserId) {
  // Validate target is not the buyer themselves.
  if (buyerId === targetUserId) {
    throw new ApiError(400, 'SELF_PURCHASE', 'You cannot purchase your own contact.');
  }

  // Acquire race lock to prevent duplicate concurrent purchases.
  const lockKey = 'lock:purchase:' + buyerId + ':' + targetUserId;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', PURCHASE_LOCK_TTL, 'NX');
  if (!lockAcquired) {
    throw new ApiError(409, 'PURCHASE_IN_PROGRESS', 'A purchase is already in progress for this candidate.');
  }

  try {
    // Load buyer context.
    const [buyerRows] = await pool.query(
      'SELECT id, bank_id, is_active, profile_completed_at FROM users WHERE id = ?',
      [buyerId]
    );
    const buyer = buyerRows[0];
    if (!buyer) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    }
    if (!buyer.is_active) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }
    if (!buyer.profile_completed_at) {
      throw new ApiError(403, 'PROFILE_INCOMPLETE', 'Complete your profile before making purchases.');
    }

    // Load target context.
    const [targetRows] = await pool.query(
      'SELECT id, bank_id, is_active, profile_completed_at FROM users WHERE id = ?',
      [targetUserId]
    );
    const target = targetRows[0];
    if (!target) {
      throw new ApiError(404, 'TARGET_NOT_FOUND', 'Candidate not found.');
    }
    if (!target.is_active) {
      throw new ApiError(422, 'TARGET_INACTIVE', 'Candidate is no longer active.');
    }
    if (!target.profile_completed_at) {
      throw new ApiError(422, 'TARGET_INACTIVE', 'Candidate profile is incomplete.');
    }

    // Enforce same-bank constraint (BR-001).
    if (buyer.bank_id !== target.bank_id) {
      throw new ApiError(403, 'CROSS_BANK', 'Cannot purchase contact across different banks.');
    }

    // Check for existing purchase (duplicate prevention via uq_buyer_target).
    const [existingRows] = await pool.query(
      'SELECT id, status, payment_id FROM purchases WHERE buyer_id = ? AND target_user_id = ?',
      [buyerId, targetUserId]
    );
    if (existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.status === 'completed') {
        throw new ApiError(409, 'ALREADY_PURCHASED', 'You have already purchased this contact.');
      }
      // If pending, return the existing pending purchase info.
      let checkoutUrl = null;
      if (existing.payment_id) {
        const [paymentRows] = await pool.query(
          'SELECT tx_ref FROM payments WHERE id = ?',
          [existing.payment_id]
        );
        if (paymentRows.length > 0) {
          checkoutUrl = 'https://checkout.chapa.co/mock/' + paymentRows[0].tx_ref;
        }
      }
      return {
        purchase_id: existing.id,
        checkout_url: checkoutUrl,
        status: 'pending',
        amount: REVEAL_PRICE_ETB,
        currency: 'ETB',
        provider: 'chapa',
        already_exists: true
      };
    }

    // Step 1: Create purchase record (pending, payment_id = NULL initially).
    let purchaseId;
    try {
      const [purchaseResult] = await pool.query(
        'INSERT INTO purchases (buyer_id, target_user_id, payment_id, status) VALUES (?, ?, NULL, ?)',
        [buyerId, targetUserId, 'pending']
      );
      purchaseId = purchaseResult.insertId;
    } catch (err) {
      // Handle duplicate key error (race condition).
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'ALREADY_PURCHASED', 'You have already purchased this contact.');
      }
      throw err;
    }

    // Step 2: Generate tx_ref and create payment record.
    const txRef = generateTxRef(purchaseId);
    const [paymentResult] = await pool.query(
      'INSERT INTO payments (purchase_id, provider, provider_charge_id, tx_ref, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [purchaseId, 'chapa', txRef, txRef, REVEAL_PRICE_ETB, 'ETB', 'pending']
    );
    const paymentId = paymentResult.insertId;

    // Step 3: Link purchase to payment.
    await pool.query('UPDATE purchases SET payment_id = ? WHERE id = ?', [paymentId, purchaseId]);

    // Step 4: Create checkout via payment provider.
    const { checkout_url } = await paymentProvider.createCheckout({
      txRef,
      amount: REVEAL_PRICE_ETB,
      currency: 'ETB',
      title: 'Contact Reveal - Zwuwur'
    });

    // Return purchase initiation response.
    return {
      purchase_id: purchaseId,
      payment_id: paymentId,
      checkout_url,
      status: 'pending',
      amount: REVEAL_PRICE_ETB,
      currency: 'ETB',
      provider: 'chapa',
      already_exists: false
    };
  } finally {
    // Release race lock.
    try {
      await redis.del(lockKey);
    } catch {
      // Ignore lock release failures.
    }
  }
}

// List purchases for the buyer.
// status filter (F.3): 'completed' (default, backward compat), 'pending', 'all'.
// For pending purchases, contact details remain masked — only completed purchases reveal.
export async function listPurchases(buyerId, { page, pageSize, status = 'completed' }) {
  const offset = (page - 1) * pageSize;

  // Build WHERE clause based on status filter.
  let whereClause = 'WHERE p.buyer_id = ?';
  const params = [buyerId];

  if (status === 'completed') {
    whereClause += ' AND p.status = ?';
    params.push('completed');
  } else if (status === 'pending') {
    whereClause += ' AND p.status = ?';
    params.push('pending');
  }
  // 'all' → no status filter.

  // For pending purchases, the target user's contact details are NOT revealed.
  // We still return the card with masked fields so the UI can render "Payment pending" cards.
  // The JOINs to grades/regions/zones are always available (they're reference data).
  const [rows] = await pool.query(
    'SELECT ' +
    'p.id AS purchase_id, ' +
    'p.status AS purchase_status, ' +
    'p.completed_at, ' +
    'p.created_at AS purchase_created_at, ' +
    'u.id AS target_id, ' +
    'u.full_name_en, ' +
    'u.full_name_am, ' +
    'u.phone_number, ' +
    'u.telegram_username, ' +
    'u.branch_name_en, ' +
    'u.branch_name_am, ' +
    'u.neighborhood_en, ' +
    'u.neighborhood_am, ' +
    'u.photo_url, ' +
    'ug.grade_number, ' +
    'ug.band_number, ' +
    'ug.band_label_en, ' +
    'ug.band_label_am, ' +
    'ug.tier_classification_en, ' +
    'ug.tier_classification_am, ' +
    'r.name_en AS region_name_en, ' +
    'r.name_am AS region_name_am, ' +
    'z.name_en AS zone_name_en, ' +
    'z.name_am AS zone_name_am ' +
    'FROM purchases p ' +
    'JOIN users u ON u.id = p.target_user_id ' +
    'JOIN grades ug ON ug.id = u.grade_id ' +
    'JOIN regions r ON r.id = u.region_id ' +
    'JOIN zones z ON z.id = u.zone_id ' +
    whereClause + ' ' +
    'ORDER BY ' + (status === 'pending' ? 'p.created_at DESC' : 'p.completed_at DESC') + ' ' +
    'LIMIT ? OFFSET ?',
    [...params, pageSize, offset]
  );

  // Count total purchases matching the filter.
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM purchases p ' + whereClause,
    params
  );
  const totalResults = Number(countRows[0].total);

  // Serialize results. Pending purchases get masked contact fields.
  const results = rows.map((row) => {
    const isCompleted = row.purchase_status === 'completed';
    const maskValue = (v) => isCompleted ? (v !== null && v !== undefined ? v : null) : '*';

    return {
      purchase_id: row.purchase_id,
      status: row.purchase_status,
      created_at: row.purchase_created_at,
      completed_at: row.completed_at,
      target: {
        id: row.target_id,
        full_name_en: maskValue(row.full_name_en),
        full_name_am: maskValue(row.full_name_am),
        phone_number: maskValue(row.phone_number),
        telegram_username: maskValue(row.telegram_username),
        branch_name_en: maskValue(row.branch_name_en),
        branch_name_am: maskValue(row.branch_name_am),
        neighborhood_en: maskValue(row.neighborhood_en),
        neighborhood_am: maskValue(row.neighborhood_am),
        photo_url: row.photo_url,
        grade: {
          band: row.band_number,
          number: row.grade_number,
          band_label_en: row.band_label_en,
          band_label_am: row.band_label_am,
          tier_classification_en: row.tier_classification_en,
          tier_classification_am: row.tier_classification_am
        },
        region_en: row.region_name_en,
        region_am: row.region_name_am,
        zone_en: row.zone_name_en,
        zone_am: row.zone_name_am
      }
    };
  });

  return {
    results,
    page,
    page_size: pageSize,
    total_results: totalResults
  };
}

// Get purchase statistics for the buyer (F.12).
// Returns aggregate spending and activity metrics.
export async function getPurchaseStats(buyerId) {
  // Total spent (only completed purchases have an amount snapshot, but we use
  // the env REVEAL_PRICE_ETB as a fallback for older purchases without amount).
  const [completedRows] = await pool.query(
    'SELECT COUNT(*) AS total_reveals, COALESCE(SUM(p.amount), 0) AS total_spent ' +
    'FROM purchases p WHERE p.buyer_id = ? AND p.status = ?',
    [buyerId, 'completed']
  );

  const totalReveals = Number(completedRows[0].total_reveals);
  const totalSpent = Number(completedRows[0].total_spent) || (totalReveals * REVEAL_PRICE_ETB);

  // Pending purchases count.
  const [pendingRows] = await pool.query(
    'SELECT COUNT(*) AS total_pending FROM purchases WHERE buyer_id = ? AND status = ?',
    [buyerId, 'pending']
  );
  const totalPending = Number(pendingRows[0].total_pending);

  // This-month reveals.
  const [monthRows] = await pool.query(
    'SELECT COUNT(*) AS month_reveals, COALESCE(SUM(p.amount), 0) AS month_spent ' +
    'FROM purchases p ' +
    'WHERE p.buyer_id = ? AND p.status = ? ' +
    'AND p.completed_at >= DATE_FORMAT(NOW(), \'%Y-%m-01\')',
    [buyerId, 'completed']
  );
  const monthReveals = Number(monthRows[0].month_reveals);
  const monthSpent = Number(monthRows[0].month_spent) || (monthReveals * REVEAL_PRICE_ETB);

  return {
    total_reveals: totalReveals,
    total_spent_etb: totalSpent,
    total_pending: totalPending,
    this_month_reveals: monthReveals,
    this_month_spent_etb: monthSpent,
    currency: 'ETB',
    reveal_price_etb: REVEAL_PRICE_ETB
  };
}

// Handle Chapa webhook: verify, mark payment completed, reveal contact.
export async function handleChapaWebhook(payload) {
  // Extract relevant fields from Chapa webhook payload.
  // Support both flat and nested (data.*) payload formats.
  const data = payload.data || payload;
  const txRef = data.tx_ref;
  const status = data.status;
  const reference = data.reference || null;

  // Validate required fields.
  if (!txRef) {
    throw new ApiError(400, 'INVALID_WEBHOOK', 'Missing tx_ref in webhook payload.');
  }

  // Look up the payment by tx_ref.
  const [paymentRows] = await pool.query(
    'SELECT id, purchase_id, status, amount FROM payments WHERE tx_ref = ?',
    [txRef]
  );

  // If payment not found, reject.
  if (paymentRows.length === 0) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Payment not found for tx_ref: ' + txRef);
  }

  const payment = paymentRows[0];

  // Idempotency: if payment is already completed, return duplicate_ignored.
  if (payment.status === 'completed') {
    return { duplicate_ignored: true, payment_id: payment.id };
  }

  // If Chapa reports failure, mark payment as failed.
  if (status !== 'success') {
    await pool.query(
      'UPDATE payments SET status = ?, raw_payload = ? WHERE id = ?',
      ['failed', JSON.stringify(payload), payment.id]
    );
    return { duplicate_ignored: false, payment_id: payment.id, status: 'failed' };
  }

  // Mark payment as completed, store provider_charge_id if provided.
  if (reference) {
    await pool.query(
      'UPDATE payments SET status = ?, provider_charge_id = ?, raw_payload = ?, updated_at = NOW() WHERE id = ?',
      ['completed', reference, JSON.stringify(payload), payment.id]
    );
  } else {
    await pool.query(
      'UPDATE payments SET status = ?, raw_payload = ?, updated_at = NOW() WHERE id = ?',
      ['completed', JSON.stringify(payload), payment.id]
    );
  }

  // Mark associated purchase as completed.
  const [purchaseResult] = await pool.query(
    'UPDATE purchases SET status = ?, completed_at = NOW() WHERE id = ? AND status = ?',
    ['completed', payment.purchase_id, 'pending']
  );

  // If no purchase was updated, it might already be completed.
  if (purchaseResult.affectedRows === 0) {
    logger.warn({ paymentId: payment.id, txRef }, 'Payment completed but no pending purchase found.');
    return { duplicate_ignored: false, payment_id: payment.id, status: 'completed', purchase_updated: false };
  }

  // Queue notification for the buyer (fire-and-forget).
  try {
    const [purchaseRows] = await pool.query(
      'SELECT buyer_id, target_user_id FROM purchases WHERE id = ?',
      [payment.purchase_id]
    );
    if (purchaseRows.length > 0) {
      const { buyer_id, target_user_id } = purchaseRows[0];
      logger.info({ buyerId: buyer_id, targetUserId: target_user_id }, 'Purchase completed, notification queued.');
      // Send payment confirmation notification.
      await sendPaymentConfirmation(buyer_id, payment.purchase_id, target_user_id, payment.amount).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, 'Failed to queue purchase notification.');
  }

  return { duplicate_ignored: false, payment_id: payment.id, status: 'completed', purchase_updated: true };
}
