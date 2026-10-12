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
const VOICE_SLUG = /^[a-z0-9_-]{1,32}$/u; // worker/plus.mjs voices()

let audioSession = new AbortController();

/** Logout, account restoration and local/server erasure revoke pending and loaded audio. */
export function invalidatePlusAudio() {
  audioSession.abort();
  audioSession = new AbortController();
}
export function plusAudioSession() { return audioSession.signal; }

// Another tab can forget or restore Plus. Allowance updates are not a login change.
globalThis.window?.addEventListener('storage', event => {
  if (event.key === null) { invalidatePlusAudio(); return; }
  if (event.key !== PLUS_KEY) return;
  try {
    if (JSON.parse(event.oldValue)?.claimedAt !== JSON.parse(event.newValue)?.claimedAt) invalidatePlusAudio();
  } catch { invalidatePlusAudio(); }
});

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

const PLUS_CONFIG_ROUTE = '/api/plus/config';
const PAYMENT_LINK = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/u; // worker/plus.mjs paymentLink()

/**
 * The Stripe Payment Link for Plus, as this deployment configures it
 * (PLUS_PAYMENT_LINK, served by GET /api/plus/config), so test and live differ by
 * configuration, not code. Stripe returns the buyer to
 * /plus/claim?session_id={CHECKOUT_SESSION_ID}. Null when the deployment has none,
 * or it cannot be had: then there is nothing to subscribe with, and no button.
 * @returns {Promise<string | null>}
 */
export async function fetchPlusPaymentLink({ fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  try {
    const response = await fetchImpl(PLUS_CONFIG_ROUTE);
    if (!response.ok) return null;
    const link = (await response.json())?.paymentLink;
    return typeof link === 'string' && PAYMENT_LINK.test(link) ? link : null;
  } catch {
    return null;
  }
}
export const PLUS_PRICE = '$8.99 a month';
/** One voicing is one vendor request (worker/plus.mjs VOICE_MAX_CHARS). */
export const PLUS_VOICE_MAX_CHARS = 10_000;

/** What the reader is told, in the Chamber's quiet place, when the voice did not come. */
const NOTICES = {
  PLUS_REQUIRED: 'Plus voice has lapsed. Reading continues silently.',
  PLUS_LAPSED: 'Plus voice has lapsed. Reading continues silently.',
  PLUS_ALLOWANCE: 'This month\'s voice allowance is used up. Reading continues silently.',
  PLUS_AUDIO_PENDING: 'This audio is still being prepared. Try opening it again later; RISE will not start a duplicate voicing. Reading continues silently.',
  PLUS_AUDIO_UNAVAILABLE: 'Saved audio is expired, deleted or unavailable. RISE will not voice or charge it again automatically. Reading continues silently.',
  PLUS_AUDIO_STORAGE: 'Saved audio is temporarily unavailable. Try again later. RISE will not start a duplicate voicing. Reading continues silently.',
  PLUS_AUDIO_FULL: 'Your saved voice capacity is full. Contact support for help. Reading continues silently.',
  PLUS_AUDIO_AUTH: 'Could not confirm access to saved audio. Sign in and open this reading again. Reading continues silently.',
  PLUS_SESSION_CHANGED: 'Your voice session changed. Open this reading again to check access. Reading continues silently.',
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

export function notePlusClaimed() { invalidatePlusAudio(); store({ claimedAt: Date.now() }); }

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
  invalidatePlusAudio();
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
    notePlusClaimed();
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
  invalidatePlusAudio();
  try {
    await fetchImpl(PLUS_FORGET_ROUTE, { method: 'POST' });
  } catch {
    /* offline: the cookie outlives this, the page's memory does not */
  }
  store(null);
  invalidatePlusAudio();
}

/** Explicit account deletion; forgetting a browser never calls this endpoint. */
export async function erasePlusAudio({ audioScope, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  invalidatePlusAudio();
  try {
    const response = await fetchImpl('/api/plus/audio/erase', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioScope })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.erased !== true) return { ok: false, message: body?.error?.message ?? 'Saved audio deletion could not be confirmed. Check access and try again.' };
    invalidatePlusAudio();
    const { PlusVoices } = await import('../audio/plus-voice-store.js');
    const localCleared = await PlusVoices.clear().then(() => true, () => false);
    return { ok: true, localCleared };
  } catch {
    return { ok: false, message: 'Saved audio deletion could not be confirmed. Check your connection and try again.' };
  }
}

/** Server-verified entitlement; administrator authority stays in memory only. */
export async function fetchPlusStatus({ fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 1500 } = {}) {
  const unavailable = { confirmed: false, admin: false, subscriber: false, available: false, adminLogin: false, billingAvailable: false, canSubscribe: false, allowance: null, audioScope: null };
  const controller = new AbortController();
  let timer;
  const read = async () => {
    try {
      const response = await fetchImpl('/api/plus/status', { signal: controller.signal });
      if (!response.ok) return unavailable;
      const body = await response.json();
      const allowance = body?.allowance;
      return {
        confirmed: typeof body?.subscriber === 'boolean' && typeof body?.available === 'boolean',
        admin: body?.admin === true, subscriber: body?.subscriber === true,
        available: body?.available === true, adminLogin: body?.adminLogin === true,
        billingAvailable: body?.billingAvailable === true,
        canSubscribe: body?.canSubscribe === true,
        audioScope: (body?.admin === true || body?.subscriber === true) && /^[a-f0-9]{64}$/u.test(body?.audioScope ?? '') ? body.audioScope : null,
        allowance: Number.isFinite(allowance?.used) && Number.isFinite(allowance?.limit)
          ? { used: allowance.used, limit: allowance.limit, periodEnd: allowance.periodEnd } : null
      };
    } catch {
      return unavailable;
    }
  };
  try {
    return await Promise.race([read(), new Promise(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(unavailable); }, timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
