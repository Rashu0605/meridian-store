const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { sendOtp, checkOtp } = require('../utils/otp');
const { signToken } = require('../utils/jwt');

const router = express.Router();
const prisma = new PrismaClient();

// Prevents someone from spamming OTP requests at a phone number that
// isn't theirs. 5 requests per 15 minutes per IP is generous for real
// users, tight for abuse.
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

const phoneSchema = z.string().min(8).max(16);

// Step 1: person enters name + phone, we text them a code.
router.post('/send-otp', otpLimiter, async (req, res) => {
  const parse = z.object({ name: z.string().min(1), phone: phoneSchema }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Enter a valid name and phone number.' });

  const { phone } = parse.data;
  try {
    await sendOtp(phone);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send the code. Check the phone number and try again.' });
  }
});

// Step 2: person enters the 4-6 digit code Twilio texted them. If it
// checks out, we either create their account or log them into the
// existing one, and hand back a signed token the frontend stores and
// sends on every future request.
router.post('/verify-otp', async (req, res) => {
  const parse = z.object({
    name: z.string().min(1),
    phone: phoneSchema,
    code: z.string().min(4).max(8),
  }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Missing name, phone, or code.' });

  const { name, phone, code } = parse.data;
  try {
    const approved = await checkOtp(phone, code);
    if (!approved) return res.status(401).json({ error: 'Incorrect or expired code.' });

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // First-ever signup from the phone number set as OWNER_PHONE becomes
      // the store owner automatically. Everyone else is a customer. This
      // check happens once, server-side, at account creation — a user can
      // never grant themselves the owner role later by calling this route
      // again, because by then their account already exists.
      const role = phone === process.env.OWNER_PHONE ? 'OWNER' : 'CUSTOMER';
      user = await prisma.user.create({ data: { name, phone, role } });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sign-in failed. Try again.' });
  }
});

module.exports = router;
