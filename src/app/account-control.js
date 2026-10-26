import { ACCOUNT_SIGN_IN, getAccount } from '../core/account-service.js';
import { appLocation, IN_HOST_CARD } from '../core/embed-address.js';
import './account-control.css';

/**
 * Whether this browser has been signed in, or set out to sign in: only then is identity looked up. The account
 * service answers a reader who is not signed in with a 401, which every browser reports as an error, on every visit
 * and every return to the tab; most readers never sign in.
 */
const SIGNED_IN_BEFORE = 'rise.account.signedIn';
function signedInBefore() {
  try { return globalThis.localStorage?.getItem(SIGNED_IN_BEFORE) === '1'; } catch { return false; }
}
function rememberSignedIn(signedIn) {
  try {
    if (signedIn) globalThis.localStorage?.setItem(SIGNED_IN_BEFORE, '1');
    else globalThis.localStorage?.removeItem(SIGNED_IN_BEFORE);
  } catch { /* no storage: identity is looked up only once the reader sets out to sign in */ }
}

/** Outside route containers, so reading and every room retain this entrance. */
export function mountAccountControl() {
  // A host card shows the reading and its controls, nothing over them, and
  // needs no account: the connector asks for none, so the card offers no sign-in.
  if (IN_HOST_CARD) return { destroy() {} };
  // The study promises no identity/network lookup. Keep its explicit sign-in
  // link, but never refresh identity just by opening/focusing it.
  const isolated = () => {
    const location = appLocation();
    return location.pathname === '/live' && new URLSearchParams(location.search).has('eval');
  };
  const link = document.createElement('a');
  link.className = 'rise-account-control is-staff';
  link.href = ACCOUNT_SIGN_IN;
  link.textContent = 'Staff sign in';
  link.setAttribute('aria-label', 'Staff sign in to SyberLabs');
  document.body.append(link);
  document.body.classList.add('has-rise-account');
  let user = null;
  let destroyed = false;
  let opening = false;
  let revision = 0;
  let accountRevision = 0;
  const clearAccount = () => {
    revision++;
    if (user) accountRevision++;
    user = null;
    link.classList.add('is-staff');
    link.textContent = 'Staff sign in';
    link.setAttribute('aria-label', 'Staff sign in to SyberLabs');
  };
  const refresh = async () => {
    if (isolated() || !signedInBefore()) { clearAccount(); return; }
    const generation = ++revision;
    let current = null;
    let signedOut = false;
    try { current = await getAccount(); } catch (error) { signedOut = error?.status === 401; /* else unavailable */ }
    if (destroyed || generation !== revision) return;
    if (current) rememberSignedIn(true);
    else if (signedOut) rememberSignedIn(false);
    if (isolated()) { clearAccount(); return; }
    if (user?.id !== current?.id) accountRevision++;
    user = current;
    link.classList.toggle('is-staff', !user);
    link.textContent = user ? 'Account' : 'Staff sign in';
    link.setAttribute('aria-label', user ? 'Open SyberLabs account' : 'Staff sign in to SyberLabs');
  };
  const click = async event => {
    if (isolated()) {
      const remembered = user;
      clearAccount();
      if (remembered && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
      return;
    }
    // Setting out to sign in: when the reader comes back, identity is looked up.
    if (!user) rememberSignedIn(true);
    if (!user || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (opening) return;
    opening = true;
    const capturedUser = user;
    const capturedRevision = accountRevision;
    const isCurrentAccount = () => !destroyed && !isolated() && accountRevision === capturedRevision && user?.id === capturedUser.id;
    try {
      const { openAccountPanel } = await import('./account-panel.js');
      if (isolated()) { clearAccount(); return; }
      if (isCurrentAccount()) openAccountPanel({ user: capturedUser, trigger: link, onClose: refresh, isCurrentAccount });
    } finally { opening = false; }
  };
  link.addEventListener('click', click);
  window.addEventListener('focus', refresh);
  void refresh();
  return { destroy() { destroyed = true; link.remove(); document.body.classList.remove('has-rise-account'); window.removeEventListener('focus', refresh); } };
}
