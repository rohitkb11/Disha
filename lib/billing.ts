import { runtimeConfig, apiError, type getContext } from "./server";
import { reconcileReceipt } from "./billing-reconcile";

export async function razorpay(path: string, body?: unknown) {
  const config = runtimeConfig();
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET)
    throw apiError(
      503,
      "Payments need the centre's Razorpay account configuration. No payment has been taken.",
    );
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw apiError(
      502,
      "The payment provider could not complete this request. Retry or contact your centre.",
    );
  return (await response.json()) as any;
}
export async function reconcilePayment(
  c: Pick<Awaited<ReturnType<typeof getContext>>, "binding">,
  row: any,
) {
  return reconcileReceipt(c.binding, row, (path) => razorpay(path));
}
