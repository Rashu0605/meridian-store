const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Every route here uses req.user.userId from the verified token — never
// an id passed in the request body — so one signed-in person can only
// ever see or change their own wishlist.
router.get('/', requireAuth, async (req, res) => {
  const items = await prisma.wishlist.findMany({
    where: { userId: req.user.userId },
    include: { product: true },
  });
  res.json(items.map(i => i.product));
});

router.post('/:productId', requireAuth, async (req, res) => {
  await prisma.wishlist.upsert({
    where: { userId_productId: { userId: req.user.userId, productId: req.params.productId } },
    create: { userId: req.user.userId, productId: req.params.productId },
    update: {},
  });
  res.json({ ok: true });
});

router.delete('/:productId', requireAuth, async (req, res) => {
  await prisma.wishlist.deleteMany({
    where: { userId: req.user.userId, productId: req.params.productId },
  });
  res.json({ ok: true });
});

module.exports = router;
