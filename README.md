# StudyHub

A full-stack Next.js + Supabase + Razorpay foundation for an Indian student learning portal.

## Included
- Responsive StudyHub landing page styled after the supplied navy/gold reference.
- Supabase email magic-link sign-in and student library.
- Published materials from Supabase, category/title search, free/paid labels.
- Material detail page, sample-preview endpoint, protected download endpoint.
- Razorpay order creation, server signature verification, and webhook entitlement grant.
- Admin role gate and protected upload endpoint/dashboard.
- SQL schema and environment template.

## Run locally
1. Install Node.js 20+ and create a Supabase project.
2. Copy `.env.example` to `.env.local`; fill in Supabase and Razorpay **test-mode** keys.
3. In Supabase SQL Editor, run `supabase/schema.sql`.
4. In Supabase Storage, create a **private** bucket named `study-materials`.
5. Set Supabase Auth Site URL to `http://localhost:3000`; enable email OTP/magic links.
6. `npm install && npm run dev`.
7. Create a user by signing in, then promote that user in SQL:
   `update public.profiles set role='admin' where id='YOUR_AUTH_USER_UUID';`
8. Open `/admin` and upload a PDF. Set sample_path by admin workflow/SQL if you want a preview.

## Razorpay setup
- Use test credentials first. Configure webhook URL as `https://YOUR_HOST/api/payments/webhook`.
- Subscribe to `payment.captured`; copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`.
- Set `APP_URL` to the deployed origin.
- The checkout-order route creates server-side orders. The browser-side Razorpay Checkout UI must be wired into the material page for a polished live checkout; the current purchase form returns the order API contract and is intentionally not a fake “paid” flow.
- Never expose `RAZORPAY_KEY_SECRET`, webhook secret, or Supabase service-role key to client code.

## Production launch checklist (required)
This is a deployable foundation, not a finished audited payment product. Before accepting real money:
- Wire Razorpay Checkout.js on the material detail page to POST `/api/payments/create-order`, open checkout with returned order/key, then POST the checkout response to `/api/payments/verify`. The webhook remains the durable source of truth.
- Add idempotent payment event storage and reconciliation; verify captured amount/currency against order and material price; handle refunds, failures, duplicate webhook delivery, and race conditions.
- Add rate limiting, CSRF/origin checks, security headers, admin audit logs, upload malware scanning, file-type sniffing, storage quotas, and signed URL access logging.
- Complete admin edit/delete, student/payment/download/revenue analytics, receipt PDF/email, Google OAuth, mobile OTP, and video playback authorization. These are not represented as fully implemented in this starter.
- Use a server-side video provider or short-lived playback tokens; do not publish private raw video URLs.
- Add tests, monitoring, backups, privacy policy, terms, refund policy, and Indian tax/accounting review.
- Configure a custom domain, HTTPS, Supabase production policies, and Razorpay live keys only after testing.

## Key endpoints
- `POST /api/admin/materials` — admin-only upload.
- `POST /api/payments/create-order` — authenticated paid order creation.
- `POST /api/payments/verify` — authenticated checkout signature verification.
- `POST /api/payments/webhook` — Razorpay webhook signature validation and access grant.
- `GET /api/materials/:id/download` — entitlement-checked, short-lived private-file redirect.
- `GET /api/materials/:id/sample` — short-lived sample-file redirect.

## Deployment
Deploy to Vercel or any Node-compatible host. Set all `.env.example` variables in the host's secret manager. Run the SQL schema once in Supabase. Do not commit `.env.local`.
