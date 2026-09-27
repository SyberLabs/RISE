const svg = body => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const MIC_ICON = svg('<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path>');
const STOP_ICON = svg('<rect x="7" y="7" width="10" height="10" rx="1.5"></rect>');

/**
 * Browser speech input for a Jev request. Dictation never submits the form.
 * A button marked data-jev-dictate="icon" is a 44px icon button (its
 * aria-label carries the words); any other button carries a text label.
 */
export function attachJevDictation(form) {
  const input = form.elements.namedItem('intent');
  const button = form.querySelector('[data-jev-dictate]');
  const iconOnly = button.dataset.jevDictate === 'icon';
  const status = form.querySelector('[data-jev-dictation-status]');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.disabled = true;
    status.textContent = 'Voice input is not available in this browser. You can type your request.';
    return () => {};
  }

  const recognition = new SpeechRecognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;
  let listening = false;
  let failed = false;
  const setListening = active => {
    listening = active;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Stop voice input' : 'Speak your Jev request');
    button.title = active ? 'Stop listening' : 'Speak your Jev request';
    if (iconOnly) button.innerHTML = active ? STOP_ICON : MIC_ICON;
    else button.textContent = active ? 'Stop' : 'Speak';
  };
  setListening(false);
  const click = () => {
    if (listening) {
      recognition.stop();
      status.textContent = 'Finishing voice input…';
      return;
    }
    failed = false;
    setListening(true);
    status.textContent = 'Listening… Speak your request, then stop or pause.';
    try {
      recognition.start();
    } catch {
      setListening(false);
      status.textContent = 'Voice input could not start. You can type your request.';
    }
  };
  button.addEventListener('click', click);
  recognition.onresult = event => {
    const words = Array.from(event.results).slice(event.resultIndex || 0)
      .filter(result => result.isFinal)
      .map(result => result[0]?.transcript?.trim())
      .filter(Boolean).join(' ');
    if (!words) return;
    const prefix = input.value.trimEnd();
    const next = `${prefix}${prefix ? ' ' : ''}${words}`;
    const max = Number(input.maxLength) || 240;
    input.value = next.slice(0, max);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = next.length > max
      ? 'Request shortened to 240 characters. Review it before asking Jev.'
      : 'Voice added. Review or edit your request, then ask Jev.';
  };
  recognition.onerror = event => {
    failed = true;
    setListening(false);
    status.textContent = ['not-allowed', 'service-not-allowed'].includes(event.error)
      ? 'Microphone access was denied. Allow it in your browser or type your request.'
      : event.error === 'no-speech'
        ? 'No speech was heard. Try again or type your request.'
        : 'Voice input stopped. Try again or type your request.';
  };
  recognition.onend = () => {
    setListening(false);
    if (!failed && status.textContent.startsWith('Listening')) {
      status.textContent = 'Voice input ended. Review your request, then ask Jev.';
    }
  };
  return () => {
    button.removeEventListener('click', click);
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    if (listening) recognition.abort();
  };
}
