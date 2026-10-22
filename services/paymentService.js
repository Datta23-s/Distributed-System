// Payment Engine & Sandbox Provider Abstraction
// Complies with Section 13 of UrbanPulse Master Spec

const prisma = require('./db');
const crypto = require('crypto');

class PaymentService {
  // Create or retrieve payment for a ride
  async createPaymentIntent({ rideId, amount, currency = 'INR', method = 'CASH' }) {
    // Check if an existing payment is pending
    const existing = await prisma.payment.findFirst({
      where: { rideId }
    });

    if (existing) {
      return existing;
    }

    const transactionRef = `UP-PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const payment = await prisma.payment.create({
      data: {
        rideId,
        amount,
        currency,
        method,
        status: method === 'CASH' ? 'COMPLETED' : 'PENDING',
        transactionRef,
        paidAt: method === 'CASH' ? new Date() : null
      }
    });

    return {
      paymentId: payment.id,
      rideId,
      amount,
      currency,
      method,
      status: payment.status,
      transactionRef,
      isSandbox: method.startsWith('SANDBOX_'),
      gatewayDetails: method.startsWith('SANDBOX_') ? {
        orderId: `order_sandbox_${crypto.randomBytes(4).toString('hex')}`,
        keyId: 'rzp_test_urbanpulse_pune'
      } : null
    };
  }

  // Process Sandbox Webhook with Idempotency
  async processWebhook({ eventId, eventType, paymentRef, signature, payload }) {
    // 1. Idempotency Check
    const existingLog = await prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey: eventId }
    });

    if (existingLog) {
      return { status: 'ALREADY_PROCESSED', code: existingLog.responseCode, cached: true };
    }

    // 2. Verify payment record
    const payment = await prisma.payment.findFirst({
      where: { transactionRef: paymentRef }
    });

    if (!payment) {
      throw new Error(`Payment reference ${paymentRef} not found.`);
    }

    // 3. Update status
    let newStatus = 'COMPLETED';
    if (eventType === 'payment.failed') newStatus = 'FAILED';

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        paidAt: newStatus === 'COMPLETED' ? new Date() : null
      }
    });

    // 4. Save idempotency record
    await prisma.idempotencyRecord.create({
      data: {
        idempotencyKey: eventId,
        endpoint: '/api/v1/payments/webhook',
        responseCode: 200,
        responseBody: JSON.stringify({ success: true, paymentId: updated.id, status: newStatus }),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
      }
    });

    return { success: true, paymentId: updated.id, status: newStatus };
  }
}

module.exports = new PaymentService();
