// Payment API with Sandbox Razorpay & Idempotent Webhook Processing
const express = require('express');
const router = express.Router();
const paymentService = require('../../services/paymentService');
const prisma = require('../../services/db');

// Create Payment Intent
router.post('/intent', async (req, res) => {
  try {
    const { rideId, amount, method = 'CASH', currency = 'INR' } = req.body;
    if (!rideId || isNaN(amount)) {
      return res.status(400).json({ error: 'rideId and numeric amount are required.' });
    }

    const intent = await paymentService.createPaymentIntent({
      rideId,
      amount: parseFloat(amount),
      currency,
      method
    });

    res.json({ success: true, payment: intent });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create payment intent.' });
  }
});

// Check Payment Status
router.get('/status/:rideId', async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { rideId: req.params.rideId }
    });
    if (!payment) return res.status(404).json({ error: 'No payment found for this ride.' });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment status.' });
  }
});

// Webhook Receiver (Sandbox Simulator with Idempotency)
router.post('/webhook', async (req, res) => {
  try {
    const eventId = req.headers['x-webhook-id'] || `wh_evt_${Date.now()}`;
    const { event, paymentRef, signature } = req.body;

    const result = await paymentService.processWebhook({
      eventId,
      eventType: event || 'payment.authorized',
      paymentRef,
      signature,
      payload: req.body
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Webhook processing failed.' });
  }
});

module.exports = router;
