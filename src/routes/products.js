const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Anyone can view products — no auth required. Supports ?category= and
// ?q= (search keyword) as simple query filters.
router.get('/', async (req, res) => {
  const { category, q } = req.query;
  const where = {
    active: true,
    ...(category && category !== 'All' ? { category: String(category) } : {}),
    ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
  };
  const products = await prisma.product.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(products);
});

router.get('/:id', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().int().positive(), // in paise/cents
  originalPrice: z.number().int().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  sizes: z.array(z.string()).optional().default([]),
  colors: z.array(z.string()).min(1),
  images: z.array(z.string().url()).min(1, 'At least 1 product image is required.'),
  description: z.string().optional(),
});

// Only a signed-in OWNER can reach anything past this line — requireAuth
// checks the token is valid, requireOwner checks the role on that token.
router.post('/', requireAuth, requireOwner, async (req, res) => {
  const parse = productSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.issues[0].message });
  const product = await prisma.product.create({ data: parse.data });
  res.status(201).json(product);
});

router.patch('/:id', requireAuth, requireOwner, async (req, res) => {
  const parse = productSchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.issues[0].message });
  if (parse.data.images && parse.data.images.length < 1) {
    return res.status(400).json({ error: 'At least 5 product images are required.' });
  }
  const product = await prisma.product.update({ where: { id: req.params.id }, data: parse.data });
  res.json(product);
});

router.delete('/:id', requireAuth, requireOwner, async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

module.exports = router;
