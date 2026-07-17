const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Public — the frontend calls this on every page load to render the
// current store name, hero text, accent color, and category list.
router.get('/', async (req, res) => {
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 }, update: {}, create: { id: 1 },
  });
  res.json(settings);
});

const settingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  logoMark: z.string().min(1).max(4).optional(),
  heroEyebrow: z.string().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  careEmail: z.string().email().optional(),
  categories: z.array(z.string()).optional(),
});

// Owner-only — this single endpoint backs every field in the "Site
// settings" panel: store name, logo, hero copy, accent color, categories.
router.patch('/', requireAuth, requireOwner, async (req, res) => {
  const parse = settingsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.issues[0].message });
  const settings = await prisma.siteSettings.update({ where: { id: 1 }, data: parse.data });
  res.json(settings);
});

module.exports = router;
