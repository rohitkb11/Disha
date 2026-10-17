# Integration activation

Credentials belong only in the hosting runtime secret store or ignored local `.dev.vars`. Never commit keys or put them into browser forms. `.env.example` lists variable names. Restart/redeploy after changes. Hosted Workers cannot connect to local Ollama.

## Pilot membership

The current site audience is preserved. Grant intended pilot accounts site access through the hosting platform, then create centre invitations in Community & accounts → Team. Learners/mentors link to an existing profile. Share the one-time code yourself through an approved channel; Disha sends no email. Revoke memberships and clear shared devices after the pilot.

## AI

Set `CLOUDFLARE_AI_ACCOUNT_ID`, scoped `CLOUDFLARE_AI_TOKEN`, and optionally `CLOUDFLARE_AI_MODEL` (default `@cf/qwen/qwen3-30b-a3b-fp8`). Follow [Cloudflare REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) and [model documentation](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/). No OpenAI key is used.

Alternatively run `ollama serve` and `ollama pull qwen2.5:1.5b`; configure `OLLAMA_BASE_URL` and `OLLAMA_MODEL` locally. A hosted endpoint must be securely reachable; do not expose an unauthenticated local service. Cloudflare takes precedence. Test real responses in English/Hindi/Marathi, citations, contact redaction and unavailable-provider fallback. Configured does not mean healthy, and validation is not proof of full factual grounding.

## Payments

Set the merchant's `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in **test mode first**. For webhooks set a separately generated `RAZORPAY_WEBHOOK_SECRET`. For subscriptions create a monthly INR plan with interval 1 in the same account/mode and set `RAZORPAY_MONTHLY_PLAN_ID`.

One-time links cover course access and a ₹199/30-day centre pass. Monthly subscriptions use the configured provider plan price and at most 12 billing cycles. The provider displays price before authorization. Cancel renewal schedules cancellation at cycle end.

Use `/api/billing/webhook` for payment-link/subscription lifecycle events only if reachable from Razorpay. Exact raw-body HMAC is checked, then the authoritative provider record is fetched. The private Sites gate may block machine callbacks. Preserve site audience: use signed-in **Check payment** reconciliation for this demo, or separately design/validate a provider-reachable webhook deployment for commerce.

Provider references: [payment links](https://razorpay.com/docs/api/payments/payment-links/create-standard/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [subscription creation](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/), [cancellation](https://razorpay.com/docs/api/payments/subscriptions/cancel-subscription/).

Required sandbox checks before charging users:

- Complete a payment and reconcile the receipt; verify full amount/currency/reference before unlock.
- Reject forged callbacks and unpaid/expired links. Replayed confirmation must not extend one-time expiry.
- Verify subscription paid period, renewal, cancellation and unpaid cycles.
- Exercise provider outage, duplicate clicks and interruption/reconciliation.
- Define refunds, disputes, taxation/receipts and merchant support. One-time links now fetch their actual captured payment: full refunds remove that receipt's access; partial refunds suspend it for merchant review. Refund callbacks use a previously verified payment-to-receipt mapping, then refetch the provider state. No money is refunded from Disha. Subscription refunds and chargeback/dispute automation still need a merchant-specific integration.

No merchant account is configured in this delivery and no real payment was charged. Mocked contracts do not constitute provider end-to-end testing.

Pass expiry starts at the provider payment timestamp, not the date the learner first presses Check payment. Replaying reconciliation returns the stored expiry. Subscription cancellation/completion retains only an already verified paid period and cannot create new access. During a provider outage the previous verified period is retained until its own expiry; the outage is reported as a failure, never a fresh payment confirmation.

Use Community & accounts → Pilot to record actual sandbox and device outcomes. Configuration flags show key presence only, not network health. Download the JSON report for review; do not enter keys, payment details or personal documents in evidence notes. See PILOT_RUNBOOK.md.

## Opportunity feed

Set `DISHA_PARTNER_FEED_URL` to an authorized HTTPS JSON endpoint and optional `DISHA_PARTNER_FEED_TOKEN`. Refresh is facilitator-triggered, not scheduled. Alternatively paste an authorized export in Integrations. Maximum 100 records; fetched payload limit 250 KB; redirects rejected. Example:

```json
[{"id":"provider-course-1","title":"Course title","provider":"Provider name","type":"Training","description":"Provider-authored description","source":"https://provider.example/course","location":"District or online","verifiedAt":"2026-10-17","deadline":null}]
```

Types: Scholarship, Training, Apprenticeship, Mentorship, Experience. Use the actual source-check date (not future); deadline is ISO date or null. Optional benefit/documents are retained. Imported listings use external application pages. Test malformed input and failed refresh: existing records remain intact. Reachability is not proof of current eligibility or vacancies.

## Mentor/employer pilot

Use distinct signed-in identities. Invite a consenting mentor, publish availability, propose as learner, confirm as mentor and exchange an in-app message. Other learners must not access it; overlap proposals must conflict.

Invite an employer, publish its opportunity, submit as learner with consent, inspect the receipt as employer and record a decision. A learner cannot forge that decision. This is actual in-app intake, not submission to NSP/NCS/another external system. No external email/SMS/video is sent.
