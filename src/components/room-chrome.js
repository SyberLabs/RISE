/**
 * Room chrome — the SyberLabs system frame shared by the quieter rooms
 * (Chapel, Rosarium, Stations, Curia, Scriptorium, Settings).
 *
 * One header (SYBERLABS / RISE lockup, one back link), one icon set
 * (20px stroke SVG, currentColor), one inline Alert. Each room keeps its
 * own reading register inside this frame; the frame itself never varies.
 */

import './room-chrome.css';

const ICON_PATHS = Object.freeze({
  back: '<path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path>',
  forward: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  close: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  alert: '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path>',
  info: '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  // A plain Latin cross — the Stations and the Rosary's way out
  cross: '<path d="M12 3v18"></path><path d="M7 8h10"></path>',
  // A rose window: circle, hub, and eight tracery spokes
  rose: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2.5"></circle><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21M5.6 5.6l4.6 4.6M13.8 13.8l4.6 4.6M18.4 5.6l-4.6 4.6M10.2 13.8l-4.6 4.6"></path>',
  // Rosary beads: a loop of beads and a pendant cross
  beads: '<circle cx="12" cy="4" r="1.5"></circle><circle cx="6.5" cy="6.5" r="1.5"></circle><circle cx="17.5" cy="6.5" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="8" cy="16.5" r="1.5"></circle><circle cx="16" cy="16.5" r="1.5"></circle><path d="M12 17v5M10 19.5h4"></path>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>',
  external: '<path d="M7 17 17 7"></path><path d="M8 7h9v9"></path>',
  none: '<circle cx="12" cy="12" r="9"></circle><path d="m5.6 18.4 12.8-12.8"></path>'
});

/** Inline 20px stroke SVG; decorative unless the caller labels its control. */
export function roomIcon(name, size = 20) {
  const paths = ICON_PATHS[name];
  if (!paths) return '';
  return `<svg class="room-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/**
 * The system header. `back` is the destination word ("Home", "Chapel");
 * the button carries `data-action="back"` unless a room asks otherwise.
 */
export function roomHeader({ back = 'Home', action = 'back', backClass = '', backLabel = null } = {}) {
  const label = backLabel ? ` aria-label="${backLabel}"` : '';
  return `
    <header class="sl-header room-header">
      <div class="sl-header-inner">
        <span class="sl-lockup" aria-label="SyberLabs RISE">
          <img class="sl-mark" src="/syberlabs-mark.webp" alt="" width="18" height="20" decoding="async">
          <span class="sl-wordmark" aria-hidden="true">SYBERLABS<span class="sl-divider"> / </span>RISE</span>
        </span>
        <button type="button" class="room-back ${backClass}" data-action="${action}"${label}>
          ${roomIcon('back')}<span>${back}</span>
        </button>
      </div>
    </header>
  `;
}

/** Eyebrow label with the RISE identity dot: "SCRIPTURE · DOUAY-RHEIMS". */
export function roomEyebrow(text, className = '') {
  return `<p class="room-eyebrow ${className}"><span class="room-dot" aria-hidden="true"></span>${text}</p>`;
}

/**
 * The system Alert. Variants: error (danger icon and border), info, success.
 * Title and message are already-escaped HTML.
 */
export function roomAlert({ title, message = '', variant = 'error', className = '', role = null, action = '' } = {}) {
  const icon = variant === 'error' ? 'alert' : variant === 'success' ? 'check' : 'info';
  const ariaRole = role || (variant === 'error' ? 'alert' : 'status');
  return `
    <div class="room-alert room-alert-${variant} ${className}" role="${ariaRole}">
      ${roomIcon(icon)}
      <div class="room-alert-body">
        ${title ? `<p class="room-alert-title">${title}</p>` : ''}
        ${message ? `<p class="room-alert-message">${message}</p>` : ''}
      </div>
      ${action}
    </div>
  `;
}
