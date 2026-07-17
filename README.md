# Deploying your store — a real, step-by-step path

This backend is written and ready to run. Nothing here needs "finishing" —
it needs accounts created and a few values pasted into `.env`. Budget
roughly half a day, most of it waiting on account verification emails.

## What you're setting up, and why

| Piece | What it does | Who provides it |
|---|---|---|
| Database | Stores users, products, orders | Render, Railway, or Supabase (all have free Postgres tiers) |
| Backend | This code — the API everything talks to | Render or Railway |
| Frontend | The storefront pages | Vercel or Netlify |
| OTP texts | Sends the login code by SMS | Twilio |
| Payments + payouts | Charges customers, pays you | Razorpay |
| Domain | yourstore.com instead of a vercel.app link | Any registrar (Namecheap, GoDaddy, etc.) |

## 1. Push this code to GitHub

Create a new repository and push the `meridian-server` folder to it.
Render, Railway, and Vercel all deploy directly from a GitHub repo — no
manual file uploads.

## 2. Create the database

Pick one:
- **Render**: New → PostgreSQL → copy the "External Database URL" it gives you.
- **Supabase**: New project → Settings → Database → copy the connection string.

Paste that into `DATABASE_URL` in your `.env`.

Then, from your own machine (with Node installed) or Render's shell:
```bash
npm install
npx prisma migrate dev --name init
```
This creates all the tables (users, products, orders, etc.) in your new database.

## 3. Set up Twilio (OTP texts)

1. Sign up at twilio.com, verify your own phone number.
2. In the console, go to **Verify → Services → Create new service**. Name it
   anything ("Store OTP" is fine).
3. Copy the **Service SID** into `TWILIO_VERIFY_SERVICE_SID`.
4. Copy your **Account SID** and **Auth Token** from the console home page
   into `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
5. Trial Twilio accounts can only text numbers you've manually verified in
   the console — fine for testing, upgrade the account (add a card) before
   real customers sign up.

## 4. Set up Razorpay (payments + your payouts)

1. Sign up at razorpay.com, complete KYC with your business/PAN details —
   this is what lets money actually reach your bank account, so it's not
   skippable.
2. Dashboard → **Settings → API Keys** → generate keys → copy into
   `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Dashboard → **Settings → Webhooks** → add a webhook pointing to
   `https://your-backend-url/api/payments/webhook`, subscribed to
   `payment.captured` and `payment.failed`. Razorpay gives you a secret
   during this step — paste it into `RAZORPAY_WEBHOOK_SECRET`.
4. For payouts specifically: Razorpay's **Route** product is what splits
   a customer's payment and sends your share straight to your bank. You
   apply for Route access from the dashboard, then use their hosted
   onboarding flow to add your bank account — that's the "connect your
   bank" step from your original ask. `payments.js` already has the
   endpoint (`/api/payments/connect-bank`) that stores the linked account
   id Razorpay gives you at the end of that flow.

## 5. Deploy the backend

On Render or Railway:
1. New Web Service → connect your GitHub repo.
2. Build command: `npm install && npx prisma generate`
3. Start command: `npm start`
4. Paste every value from your `.env` into their "Environment Variables" panel.
5. Deploy. You'll get a URL like `https://meridian-server.onrender.com`.

## 6. Deploy the frontend

`meridian-server-frontend/index.html` is already wired to call this real
API — it is not the mock version anymore. Before deploying:

1. Open `index.html` and find this near the top:
   ```javascript
   window.API_BASE = 'http://localhost:4000/api';
   ```
   Change it to your deployed backend URL, e.g.
   `'https://meridian-server.onrender.com/api'`.
2. Push the frontend folder to GitHub, then deploy it on Vercel or Netlify
   (drag-and-drop the folder also works for a quick first test).
3. Once deployed, go back to your backend's `CLIENT_URL` environment
   variable and set it to this new frontend URL, then redeploy the
   backend — this is what allows the two to talk to each other (CORS).

## 7. Point your domain at it

Buy a domain (if you haven't), then in Vercel: **Project → Settings →
Domains → add yourstore.com** — Vercel shows you exactly which DNS
records to add at your registrar. Propagation usually takes under an hour.

## 8. Make yourself the owner

Set `OWNER_PHONE` in your backend's environment variables to your own
phone number *before* anyone signs up. The very first account created
with that phone number automatically gets the `OWNER` role in the
database — every other phone number becomes a regular customer. Sign up
through the site once with your number and you're in as the owner.

## Costs, roughly

- Render/Railway backend + Postgres: free tier while testing, ~$7-15/month at real traffic
- Vercel frontend: free for most stores
- Twilio: pay-per-SMS, a few cents each
- Razorpay: no monthly fee, a percentage per transaction (check their current rate)
- Domain: ~$10-15/year
