/**
 * The reader's local calendar day. Kept apart from today-poem.js so Home can
 * watch the day without importing the division index.
 */
const pad = n => String(n).padStart(2, '0');

export const localDateKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Calls `onNewDay(now)` when the local date changes: at local midnight, and
 * when the tab becomes visible again (a sleeping laptop's timer runs late).
 * Returns a function that stops watching.
 */
export function watchLocalDay(onNewDay) {
  let key = localDateKey(new Date());
  let timer = 0;
  const check = () => {
    const now = new Date();
    if (localDateKey(now) !== key) {
      key = localDateKey(now);
      onNewDay(now);
    }
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(check, midnight - now + 1000);
  };
  const onVisible = () => {
    if (document.visibilityState !== 'hidden') check();
  };
  document.addEventListener('visibilitychange', onVisible);
  schedule();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
