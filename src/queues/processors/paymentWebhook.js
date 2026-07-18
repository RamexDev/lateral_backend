/**
 * Payment-webhook-processing queue processor (§7, answers.md §B).
 *
 * Decouples the Chapa webhook receipt (which must ack fast, per §8 NFRs)
 * from the downstream work: payment-confirmation notification + audit log.
 *
 * In test env this runs inline via the queue layer's fallback.
 */
const notificationRepo = require('../../repositories/notificationRepository');
const purchaseRepo = require('../../repositories/purchaseRepository');
const auditService = require('../../services/auditService');

async function confirmPayment({ paymentId, purchaseId, chargeId, amountEtb }) {
  const purchase = await purchaseRepo.findById(purchaseId);
  if (!purchase) {
    // Purchase was deleted (shouldn't happen — RESTRICT FK). Drop silently.
    return { ok: false, reason: 'purchase_not_found' };
  }

  // Enqueue payment-confirmation notification.
  await notificationRepo.create({
    user_id: purchase.buyer_id,
    type: 'payment_confirmation',
    channel: 'telegram',
    payload: JSON.stringify({
      purchaseId: purchase.id,
      amountEtb,
      targetUserId: purchase.target_user_id,
    }),
    status: 'queued',
  });

  await auditService.log({
    actorType: 'system',
    action: 'payment.completed',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { chargeId, purchaseId: purchase.id },
  });

  return { ok: true };
}

module.exports = { confirmPayment };
