/** Money is integer microdollars throughout. Defaults deliberately exceed Flash's base rate;
 * deployments must raise the estimate for vendor taxes, voice modifiers or plan price changes.
 * Unknown models and a policy less conservative than these floors fail closed.
 */
const integer = (value, fallback, min, max = Number.MAX_SAFE_INTEGER) => {
  const raw = value === undefined ? String(fallback) : String(value);
  if (!/^\d+$/u.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
};
export function spendingPolicy(env) {
  if ((env.PLUS_VOICE_MODEL || 'eleven_flash_v2_5') !== 'eleven_flash_v2_5') return null;
  const rate = integer(env.PLUS_VENDOR_MICRO_USD_PER_CHAR, 60, 60, 1000000);
  const feeBps = integer(env.PLUS_FEE_BPS, 500, 500, 10000);
  const feeCents = integer(env.PLUS_FEE_FIXED_USD_CENTS, 50, 50, 100000);
  const reserveBps = integer(env.PLUS_RESERVE_BPS, 5000, 5000, 10000);
  return [rate, feeBps, feeCents, reserveBps].some(n => n === null) ? null : { rate, feeBps, feeCents, reserveBps };
}
export function adminBudget(env, policy) {
  const cents = integer(env.PLUS_ADMIN_MONTHLY_USD_CENTS, 0, 1, 500);
  const dayLimit = integer(env.PLUS_ADMIN_DAILY_CHAR_CAP, 25000, 1, 25000);
  return policy && cents !== null && dayLimit !== null ? { micros: cents * 10000, dayLimit } : null;
}
const cents = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;
const id = value => typeof value === 'string' ? value : value?.id;

/** Admit only one fully enumerated, non-prorated Plus item for exactly this billing period.
 * Credits, discounts and free trials never turn the price's list amount into spendable money.
 */
export async function paidBudget(subscription, standing, env, policy, stripe) {
  if (subscription.status !== 'active' || !id(subscription.latest_invoice)) return null;
  const invoice = await stripe(`/v1/invoices/${encodeURIComponent(id(subscription.latest_invoice))}`, env);
  const lines = invoice?.lines;
  const line = lines?.data?.[0];
  const parent = line?.parent?.subscription_item_details;
  const item = subscription.items?.data?.find(candidate => id(candidate.price) === env.PLUS_PRICE_ID);
  if (invoice.status !== 'paid' || invoice.currency !== 'usd' || invoice.livemode !== standing.l
    || id(invoice.parent?.subscription_details?.subscription) !== standing.s
    || !cents(invoice.amount_paid) || invoice.amount_paid <= 0 || !cents(invoice.total)
    || !cents(invoice.post_payment_credit_notes_amount) || !Array.isArray(invoice.total_taxes)
    || lines?.has_more !== false || !Array.isArray(lines.data) || lines.data.length !== 1
    || id(line.pricing?.price_details?.price) !== env.PLUS_PRICE_ID || parent?.proration !== false
    || id(parent.subscription) !== standing.s || parent.subscription_item !== item?.id
    || line.period?.start !== standing.start || line.period?.end !== standing.exp) return null;
  if (!invoice.total_taxes.every(tax => cents(tax.amount))) return null;
  const taxes = invoice.total_taxes.reduce((sum, tax) => sum + tax.amount, 0);
  // Fully enumerate the payments. Out-of-band "marked paid", credit-only invoices and unknown payment rails fund nothing.
  const payments = await stripe(`/v1/invoice_payments?invoice=${encodeURIComponent(invoice.id)}&expand[]=data.payment.payment_intent.latest_charge`, env);
  if (payments?.has_more !== false || !Array.isArray(payments.data) || !payments.data.length) return null;
  let collected = 0, refunded = 0, actualFees = 0;
  for (const payment of payments.data) {
    const intent = payment.payment?.payment_intent;
    const charge = intent?.latest_charge;
    if (payment.status !== 'paid' || payment.currency !== 'usd' || !cents(payment.amount_paid)
      || payment.payment?.type !== 'payment_intent' || intent?.status !== 'succeeded'
      || !charge?.paid || !charge.captured || charge.disputed !== false || charge.currency !== 'usd'
      || !cents(charge.amount) || charge.amount < payment.amount_paid || !cents(charge.amount_refunded)
      || !id(charge.balance_transaction)) return null;
    const transaction = await stripe(`/v1/balance_transactions/${encodeURIComponent(id(charge.balance_transaction))}`, env);
    if (transaction.currency !== 'usd' || !cents(transaction.fee)) return null;
    collected += payment.amount_paid;
    // If one charge funds multiple invoices, subtracting its entire refund and fee here is deliberately conservative.
    refunded += charge.amount_refunded;
    actualFees += transaction.fee;
  }
  if (collected !== invoice.amount_paid) return null;
  const gross = Math.min(collected, invoice.total);
  const fees = Math.max(actualFees, Math.ceil(collected * policy.feeBps / 10000) + policy.feeCents * payments.data.length);
  const netCents = Math.max(0, gross - taxes - refunded - invoice.post_payment_credit_notes_amount - fees);
  const micros = Math.floor(netCents * (10000 - policy.reserveBps));
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}
