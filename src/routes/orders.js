const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// A customer's own order history — scoped to their token, same pattern
// as wishlist. Actual order creation happens in payments.js once payment
// is confirmed, so a customer can't create a fake "PAID" order by calling
// this route directly.
router.get('/', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.userId },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

const querySchema = z.object({
  email: z.string().email(),
  message: z.string().min(1),
  orderRef: z.string().optional(),
});

// "Contact customer care" — stores the message and, in a real deployment,
// you'd also send an email notification (e.g. via Resend or SendGrid) to
// the address set in SiteSettings.careEmail. Sending that email is a
// couple of lines once you've picked a provider and added its API key.
router.post('/support', requireAuth, async (req, res) => {
  const parse = querySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Add your email and a message.' });
  const query = await prisma.supportQuery.create({
    data: { userId: req.user.userId, ...parse.data },
  });
  res.status(201).json(query);
});

module.exports = router;
