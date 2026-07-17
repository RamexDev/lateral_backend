/**
 * PurchaseService — reveal purchase orchestration (§6.7, §8).
 *
 * Flow:
 * 1. POST /purchases → create purchases row (revealed_fields set, payment_id NULL)
 *    + payments row (status='pending'). Return invoice link.
 * 2. POST /webhooks/telegram/payments → on successful_payment:
 *    mark payments.status='completed', finalize purchases.revealed_fields, enqueue
 *    payment-confirmation notification, write audit log. Idempotent on charge id (FR-PAY-002).
 *
 * BR-006: uq_buyer_target on purchases guarantees no double-charge for the same buyer/target pair.
 * We also use a short-lived cache mutex to close the race window before the DB constraint applies.
 */
const purchaseRepo = require('../repositories/purchaseRepository');
const paymentRepo = require('../repositories/paymentRepository');
const userRepo = require('../repositories/userRepository');
const notificationRepo = require('../repositories/notificationRepository');
const auditService = require('./auditService');
const { getProvider } = require('../providers/telegramStars');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const config = require('../config');
const { getBackend } = require('../utils/cache');

const REVEALED_FIELDS = {
  telegramUsername: true,
  phone: true,
  branchName: true,
  neighborhood: true,
};

/**
 * Initiate a purchase for a target candidate.
 * Returns the purchase id, payment id, and the Telegram invoice link.
 */
async function initiatePurchase(buyer, targetUserId) {
  const lang = buyer.preferred_language;

  // Race-window mutex (§7 — `lock:purchase:{buyerId}:{targetId}`).
  // Uses the cache's atomic `add(key, value, ttl)` operation so the lock can never
  // leak even if the process crashes between acquire and TTL-set. Mirrors Redis's
  // `SET key value NX EX ttl`. The DB unique constraint (uq_buyer_target) is the
  // real guard; this mutex just closes the user-visible race window for invoice
  // link creation.
  const cache = await getBackend();
  const lockKey = `lock:purchase:${buyer.id}:${targetUserId}`;
  const acquired = await cache.add(lockKey, '1', 5);
  if (!acquired) {
    // Another in-flight request already started this purchase — treat as conflict.
    throw ApiError.conflict('ALREADY_PURCHASED', i18n.t('ALREADY_PURCHASED', lang));
  }

  try {
    // Already purchased? (BR-006 — never charge twice)
    const existing = await purchaseRepo.findByBuyerAndTarget(buyer.id, targetUserId);
    if (existing) {
      throw ApiError.conflict('ALREADY_PURCHASED', i18n.t('ALREADY_PURCHASED', lang));
    }

    // Target validation.
    const target = await userRepo.findById(targetUserId);
    if (!target || !target.is_active) {
      throw ApiError.business('TARGET_INACTIVE', i18n.t('TARGET_INACTIVE', lang));
    }
    if (target.bank_id !== buyer.bank_id) {
      // BR-001 — same bank only.
      throw ApiError.business('TARGET_INACTIVE', i18n.t('TARGET_INACTIVE', lang));
    }

    // Create the purchases + payments rows.
    const purchaseId = await purchaseRepo.create({
      buyer_id: buyer.id,
      target_user_id: targetUserId,
      revealed_fields: JSON.stringify(REVEALED_FIELDS),
    });

    const paymentId = await paymentRepo.create({
      purchase_id: purchaseId,
      provider: getProvider().name,
      amount: config.payments.amountEtb,
      currency: config.payments.currency,
      status: 'pending',
    });

    await purchaseRepo.updatePaymentLink(purchaseId, paymentId);

    const invoiceLink = await getProvider().createInvoice({
      purchaseId,
      amountEtb: config.payments.amountEtb,
      currency: config.payments.currency,
    });

    await auditService.log({
      actorType: 'user',
      actorId: buyer.id,
      action: 'purchase.initiate',
      entityType: 'purchase',
      entityId: purchaseId,
      metadata: { targetUserId, paymentId },
    });

    return {
      purchaseId,
      paymentId,
      status: 'pending',
      telegramInvoiceLink: invoiceLink,
    };
  } finally {
    // Always release the lock — even on error.
    await cache.del(lockKey);
  }
}

/**
 * Handle a successful_payment webhook payload (§6.7, §8).
 * Idempotent: if the charge id is already completed, this is a no-op.
 */
async function handleSuccessfulPayment(payload) {
  const parsed = getProvider().parseSuccessfulPayment(payload);
  if (!parsed || !parsed.purchaseId) {
    return { ok: false, reason: 'unparseable_payload' };
  }

  // Idempotency check (FR-PAY-002).
  const existing = await paymentRepo.findByChargeId(parsed.chargeId);
  if (existing && existing.status === 'completed') {
    return { ok: true, idempotent: true, paymentId: existing.id };
  }

  const payment = await paymentRepo.findById(parsed.purchaseId);
  if (!payment) {
    return { ok: false, reason: 'payment_not_found' };
  }

  await paymentRepo.update(payment.id, {
    status: 'completed',
    telegram_charge_id: parsed.chargeId,
    raw_payload: JSON.stringify(parsed.rawPayload),
  });

  // Enqueue payment-confirmation notification (synchronous insert in v1 — no BullMQ worker).
  if (payment.purchase_id) {
    const purchase = await purchaseRepo.findById(payment.purchase_id);
    if (purchase) {
      await notificationRepo.create({
        user_id: purchase.buyer_id,
        type: 'payment_confirmation',
        channel: 'telegram',
        payload: JSON.stringify({
          purchaseId: purchase.id,
          amountEtb: Number(payment.amount),
          targetUserId: purchase.target_user_id,
        }),
        status: 'queued',
      });
    }
  }

  await auditService.log({
    actorType: 'system',
    action: 'payment.completed',
    entityType: 'payment',
    entityId: payment.id,
    metadata: { chargeId: parsed.chargeId, purchaseId: payment.purchase_id },
  });

  return { ok: true, paymentId: payment.id };
}

/**
 * List the buyer's purchases (§6.7 GET /me/purchases).
 * Status: 'completed' if a completed payment exists, else 'pending'.
 */
async function listMine(buyer) {
  const purchases = await purchaseRepo.listByBuyer(buyer.id);
  const out = [];
  for (const p of purchases) {
    const payment = p.payment_id ? await paymentRepo.findById(p.payment_id) : null;
    out.push({
      purchaseId: p.id,
      targetUserId: p.target_user_id,
      status: payment?.status || 'pending',
      createdAt: p.created_at,
    });
  }
  return out;
}

module.exports = { initiatePurchase, handleSuccessfulPayment, listMine, REVEALED_FIELDS };
