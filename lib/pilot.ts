export const PILOT_CHECKS = [
  {
    id: "account_access",
    title: "Separate-account access",
    detail:
      "Use distinct owner, teacher, learner, mentor and employer identities. Verify forbidden access and revocation.",
  },
  {
    id: "mentor_flow",
    title: "Consenting mentor trial",
    detail:
      "A real invited mentor confirms a learner session and exchanges an in-app message. Record consent and outcome without private details.",
  },
  {
    id: "partner_intake",
    title: "Consenting employer trial",
    detail:
      "A real partner receives a consented application and returns a review decision.",
  },
  {
    id: "android_offline",
    title: "Low-end Android offline recovery",
    detail:
      "On an actual phone, prepare offline, disconnect, reload, complete work, reconnect and verify synchronization. Record device/browser and result.",
  },
  {
    id: "regional_voice",
    title: "Hindi and Marathi speech",
    detail:
      "On the pilot device, check microphone permission, available voices and typed fallback in both languages.",
  },
  {
    id: "ai_quality",
    title: "Hosted AI quality",
    detail:
      "Review real English/Hindi/Marathi answers, citations, unsupported eligibility claims and unavailable-provider fallback.",
  },
  {
    id: "payment_sandbox",
    title: "Merchant sandbox purchase and refund",
    detail:
      "Use the merchant sandbox. Verify amount, receipt, paid-content unlock, replay, full/partial refund reconciliation and provider failure.",
  },
  {
    id: "subscription_cycle",
    title: "Subscription lifecycle",
    detail:
      "Verify a real sandbox paid period, renewal failure, cancellation, last paid period and expiry. Mock contract tests do not satisfy this check.",
  },
  {
    id: "webhook_delivery",
    title: "Provider callback delivery",
    detail:
      "Verify signed callbacks can reach the deployment without changing its intended audience. Record the approved manual reconciliation procedure if callbacks remain blocked.",
  },
  {
    id: "merchant_policy",
    title: "Merchant support and policies",
    detail:
      "The merchant approves pricing, refunds, disputes, receipts/tax obligations and a support channel before charging users.",
  },
  {
    id: "opportunity_freshness",
    title: "Provider opportunity verification",
    detail:
      "Obtain an authorized export/feed and confirm current eligibility, dates and application destination with the provider.",
  },
] as const;
export const PILOT_IDS = PILOT_CHECKS.map((c) => c.id);
export function pilotConfiguration(config: Record<string, string | undefined>) {
  return [
    {
      id: "hosted_ai",
      configured: Boolean(
        config.CLOUDFLARE_AI_ACCOUNT_ID && config.CLOUDFLARE_AI_TOKEN,
      ),
      detail:
        "Cloudflare Workers AI credentials; configuration only, not a health or quality test.",
    },
    {
      id: "payments",
      configured: Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET),
      detail:
        "Merchant key pair; real sandbox acceptance must be recorded separately.",
    },
    {
      id: "webhook",
      configured: Boolean(config.RAZORPAY_WEBHOOK_SECRET),
      detail:
        "Signing secret only; the provider must still be able to reach the site.",
    },
    {
      id: "subscriptions",
      configured: Boolean(config.RAZORPAY_MONTHLY_PLAN_ID),
      detail:
        "Monthly provider plan ID; verify account, currency and lifecycle in sandbox.",
    },
    {
      id: "partner_feed",
      configured: Boolean(config.DISHA_PARTNER_FEED_URL),
      detail: "Optional authorized feed URL; manual import remains available.",
    },
  ];
}
