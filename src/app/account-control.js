import { ACCOUNT_SIGN_IN, getAccount } from '../core/account-service.js';
import './account-control.css';

/** Outside route containers, so reading and every room retain this entrance. */
export function mountAccountControl() {
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
  const refresh = async () => {
    const generation = ++revision;
    let current = null;
    try { current = await getAccount(); } catch { /* signed out or unavailable */ }
    if (destroyed || generation !== revision) return;
    user = current;
    link.textContent = user ? 'Account' : 'Sign in';
    link.setAttribute('aria-label', user ? 'Open SyberLabs account' : 'Sign in to SyberLabs');
  };
  const click = async event => {
    if (!user || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (opening) return;
    opening = true;
    try {
      const { openAccountPanel } = await import('./account-panel.js');
      if (!destroyed) openAccountPanel({ user, trigger: link, onClose: refresh });
    } finally { opening = false; }
  };
  link.addEventListener('click', click);
  window.addEventListener('focus', refresh);
  void refresh();
  return { destroy() { destroyed = true; link.remove(); document.body.classList.remove('has-rise-account'); window.removeEventListener('focus', refresh); } };
}
