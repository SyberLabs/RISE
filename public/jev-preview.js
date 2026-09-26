const form = document.querySelector('#jev-form');
const button = document.querySelector('#jev-submit');
const result = document.querySelector('#jev-result');
const actions = new Set(['continue', 'slower', 'pause']);
const modelPattern = /^typesafe\/jev-1\.13(?:-\d{8})?$/;

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    const intent = document.querySelector('#jev-intent').textContent.trim();
    const feedback = document.querySelector('#jev-feedback').textContent.trim();
    const excerpt = document.querySelector('#jev-excerpt').textContent.trim();
    const mode = document.querySelector('#jev-mode').textContent.trim();
    const pace = Number(document.querySelector('#jev-pace').textContent.trim());
    if (!intent || intent.length > 500 || feedback.length > 500 || excerpt.length > 2000
        || !['reading', 'devotional'].includes(mode)
        || !Number.isFinite(pace) || pace < 100 || pace > 500) {
        result.textContent = 'The fixed sample is unavailable.';
        return;
    }

    const requestId = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    button.disabled = true;
    result.textContent = 'Asking Jev…';

    try {
        const response = await fetch('/api/jev-decision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intent, feedback, excerpt, mode, pace, requestId })
        });
        if (!response.ok) throw new Error('Decision request failed');
        const decision = await response.json();
        if (decision?.requestId !== requestId || !actions.has(decision.action)
            || typeof decision.model !== 'string' || !modelPattern.test(decision.model)) {
            throw new Error('Invalid decision response');
        }
        result.textContent = `Action: ${decision.action}\nModel: ${decision.model}\nRequest ID: ${requestId}`;
    } catch {
        result.textContent = 'The Jev preview could not complete. Please try again.';
    } finally {
        button.disabled = false;
    }
});
