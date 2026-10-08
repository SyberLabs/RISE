/**
 * Plus on this browser: what the page knows about the paid voice. The receipt
 * itself is an HttpOnly cookie the Worker holds (worker/plus.mjs) and the page
 * cannot see, so the page keeps only that a claim was made here, and whether
 * the Worker has since answered that it lapsed.
 */
const PLUS_KEY = 'rise.plus';
const PLUS_CLAIM_ROUTE = '/api/plus/claim';
const PLUS_FORGET_ROUTE = '/api/plus/forget';
const PLUS_VOICES_ROUTE = '/api/plus/voices';
const VOICE_SLUG = /^[a-z0-9_-]{1,40}$/u;

/** The voice the Worker reads in when the reader has chosen none, or the list cannot be had. */
export const PLUS_DEFAULT_VOICE = Object.freeze({ slug: 'default', label: 'Default' });

/** The reader's chosen voice slug as the Worker accepts it, or the default. */
export function plusVoiceSlug(value) {
  return typeof value === 'string' && VOICE_SLUG.test(value) ? value : PLUS_DEFAULT_VOICE.slug;
}

/**
 * The voices a reader may choose, as the Worker lists them. Only "Default"
 * when the list cannot be had: the picker still works, and the Worker reads
 * an unknown choice as nothing to voice rather than a wrong voice.
 * @returns {Promise<Array<{ slug: string, label: string }>>}
 */
export async function fetchPlusVoices({ fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  try {
    const response = await fetchImpl(PLUS_VOICES_ROUTE);
    if (!response.ok) throw new Error(`voices answered ${response.status}`);
    const listed = (await response.json())
      .filter(voice => typeof voice?.slug === 'string' && VOICE_SLUG.test(voice.slug))
      .map(voice => ({ slug: voice.slug, label: typeof voice.label === 'string' && voice.label.trim() ? voice.label.trim().slice(0, 60) : voice.slug }));
    if (listed.length) return listed;
  } catch {
    /* offline, or no list: Default alone */
  }
  return [{ ...PLUS_DEFAULT_VOICE }];
}

/**
 * The Stripe payment link for Plus, from the Stripe dashboard (Payment links).
 * This is the TEST-mode link; swap it for the live one at go-live. Stripe
 * returns the buyer to /plus/claim?session_id={CHECKOUT_SESSION_ID}.
 */
export const PLUS_PAYMENT_LINK = 'https://buy.stripe.com/test_aFa7sL5HpfHD0K5bIP9MY00';
export const PLUS_PRICE = '$8.99 a month';
/** One voicing is one vendor request (worker/plus.mjs VOICE_MAX_CHARS). */
export const PLUS_VOICE_MAX_CHARS = 10_000;

/** What the reader is told, in the Chamber's quiet place, when the voice did not come. */
const NOTICES = {
  PLUS_REQUIRED: 'Plus voice has lapsed. Reading continues silently.',
  PLUS_LAPSED: 'Plus voice has lapsed. Reading continues silently.',
  PLUS_ALLOWANCE: 'This month\'s voice allowance is used up. Reading continues silently.',
  TOO_LONG: 'This reading is too long for the Plus voice.'
};

export function plusNotice(code) {
  return NOTICES[code] ?? 'The Plus voice could not be rendered. Reading continues silently.';
}

function stored() {
  try {
    const value = JSON.parse(localStorage.getItem(PLUS_KEY) ?? 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function store(value) {
  try {
    if (value) localStorage.setItem(PLUS_KEY, JSON.stringify(value));
    else localStorage.removeItem(PLUS_KEY);
  } catch {
    /* private mode: Plus is remembered by the cookie alone */
  }
}

/** Whether Plus was claimed in this browser, and whether the Worker has since called it lapsed. */
export function plusState() {
  const value = stored();
  return { claimed: Number.isFinite(value?.claimedAt), lapsed: value?.lapsed === true };
}

/** What the Worker last said of this period's voice allowance, kept beside the claim; null until it has voiced something here. */
export function plusAllowance() {
  const allowance = stored()?.allowance;
  return Number.isFinite(allowance?.used) && Number.isFinite(allowance?.limit) ? allowance : null;
}

export function notePlusAllowance(allowance) {
  if (!Number.isFinite(allowance?.used) || !Number.isFinite(allowance?.limit) || !stored()) return;
  store({ ...stored(), allowance: { used: allowance.used, limit: allowance.limit, periodEnd: allowance.periodEnd } });
}

/** The Worker answered PLUS_REQUIRED or PLUS_LAPSED: no more requests until the reader claims again. */
export function markPlusLapsed() {
  store({ ...(stored() ?? { claimedAt: Date.now() }), lapsed: true });
}

/**
 * The Checkout success page's one call: the Worker confirms the purchase with
 * Stripe and sets the cookie; the page remembers the claim.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export async function claimPlus(sessionId, { fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  let response;
  try {
    response = await fetchImpl(PLUS_CLAIM_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    });
  } catch {
    return { ok: false, message: 'Plus could not be reached. Open this page again in a moment.' };
  }
  if (response.status === 204) {
    store({ claimedAt: Date.now() });
    return { ok: true };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: false, message: body?.error?.message ?? 'The purchase could not be confirmed.' };
}

/** Clears the cookie and the page's memory of the claim. The subscription itself stays with Stripe. */
export async function forgetPlus({ fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  try {
    await fetchImpl(PLUS_FORGET_ROUTE, { method: 'POST' });
  } catch {
    /* offline: the cookie outlives this, the page's memory does not */
  }
  store(null);
}
