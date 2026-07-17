const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const cartItemSchema = z.object({
  productId: z.string(),
  size: z.string(),
  color: z.string(),
  quantity: z.number().int().positive().default(1),
});

// Step 1 of checkout: customer's cart is sent here, we look up real
// prices from OUR database (never trust a price the browser sends), then
// ask Razorpay to open a payment order. The frontend uses the returned
// order id to open Razorpay's checkout widget, where the customer pays
// with card, UPI, netbanking, or wallet straight from their bank.
router.post('/checkout', requireAuth, async (req, res) => {
  const parse = z.object({ items: z.array(cartItemSchema).min(1) }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Cart is empty or malformed.' });

  const items = parse.data.items;
  const products = await prisma.product.findMany({
    where: { id: { in: items.map(i => i.productId) } },
  });
  const priceMap = Object.fromEntries(products.map(p => [p.id, p.price]));
  const totalAmount = items.reduce((sum, i) => sum + (priceMap[i.productId] || 0) * i.quantity, 0);
  if (totalAmount <= 0) return res.status(400).json({ error: 'Could not price this order.' });

  const order = await prisma.order.create({
    data: {
      userId: req.user.userId,
      totalAmount,
      items: { create: items.map(i => ({
        productId: i.productId, size: i.size, color: i.color,
        quantity: i.quantity, price: priceMap[i.productId] || 0,
      })) },
    },
  });

  const rzpOrder = await razorpay.orders.create({
    amount: totalAmount, // in paise
    currency: 'INR',
    receipt: order.id,
  });

  await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: rzpOrder.id } });
  res.json({ orderId: order.id, razorpayOrderId: rzpOrder.id, amount: totalAmount, key: process.env.RAZORPAY_KEY_ID });
});

// Step 2: Razorpay calls this automatically once a payment succeeds or
// fails — you paste this URL into your Razorpay dashboard's webhook
// settings. We verify the signature so we know the request genuinely
// came from Razorpay and not someone pretending a payment went through.
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');
  if (signature !== expected) return res.status(400).json({ error: 'Invalid signature.' });

  const event = JSON.parse(req.body);
  const rzpOrderId = event.payload?.payment?.entity?.order_id;
  if (event.event === 'payment.captured' && rzpOrderId) {
    await prisma.order.updateMany({
      where: { razorpayOrderId: rzpOrderId },
      data: { paymentStatus: 'PAID', status: 'PLACED' },
    });
  }
  if (event.event === 'payment.failed' && rzpOrderId) {
    await prisma.order.updateMany({ where: { razorpayOrderId: rzpOrderId }, data: { paymentStatus: 'FAILED' } });
  }
  res.json({ received: true });
});

// Owner connects their bank account so they can actually receive money.
// In production you'd redirect the owner into Razorpay's hosted "Route"
// onboarding flow (or Stripe Connect if you go that route instead), and
// Razorpay handles collecting bank details, KYC/PAN verification, and
// compliance. This endpoint just stores the linked account id Razorpay
// gives you back at the end of that flow.
router.post('/connect-bank', requireAuth, requireOwner, async (req, res) => {
  const parse = z.object({ razorpayAccountId: z.string().min(1) }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Missing linked account id.' });
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: { bankConnected: true, razorpayAccountId: parse.data.razorpayAccountId },
    create: { id: 1, bankConnected: true, razorpayAccountId: parse.data.razorpayAccountId },
  });
  res.json({ ok: true });
});

module.exports = router;
