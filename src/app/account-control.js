import { ACCOUNT_SIGN_IN, getAccount } from '../core/account-service.js';
import { appLocation, IN_HOST_CARD } from '../core/embed-address.js';
import './account-control.css';

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
  link.className = 'rise-account-control';
  link.href = ACCOUNT_SIGN_IN;
  link.textContent = 'Sign in';
  link.setAttribute('aria-label', 'Sign in to SyberLabs');
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
    link.textContent = 'Sign in';
    link.setAttribute('aria-label', 'Sign in to SyberLabs');
  };
  const refresh = async () => {
    if (isolated()) { clearAccount(); return; }
    const generation = ++revision;
    let current = null;
    try { current = await getAccount(); } catch { /* signed out or unavailable */ }
    if (destroyed || generation !== revision) return;
    if (isolated()) { clearAccount(); return; }
    if (user?.id !== current?.id) accountRevision++;
    user = current;
    link.textContent = user ? 'Account' : 'Sign in';
    link.setAttribute('aria-label', user ? 'Open SyberLabs account' : 'Sign in to SyberLabs');
  };
  const click = async event => {
    if (isolated()) {
      const remembered = user;
      clearAccount();
      if (remembered && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
      return;
    }
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
