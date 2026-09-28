/**
 * The speaker rail. Suggestions land here; Promote and Dismiss are the only
 * controls, and they are the speaker's. There is no stage on this surface.
 *
 * The rail has a fixed number of slots. A card keeps its slot until it
 * leaves, a new card takes the first empty slot, and a slot is repainted
 * only when its card changes — so a card arriving never moves a button the
 * presenter is about to press. The newest card not on the stage is the
 * keyboard target.
 */

import { cardContent } from './card-view.js';
import { RAIL_POLICY } from './decision.js';

export function renderRail(root, session, { onChange } = {}) {
    const list = document.createElement('ol');
    list.dataset.surface = 'rail';
    const slots = Array.from({ length: RAIL_POLICY.maxRail }, (_, index) => {
        const el = document.createElement('li');
        el.className = 'slot';
        el.dataset.slot = String(index);
        list.append(el);
        return { el, id: null, key: null };
    });
    root.replaceChildren(list);

    function changed() {
        draw();
        onChange?.();
    }

    function onStage() {
        return new Set(session.stage().map(card => card.id));
    }

    function targetOf(cards, staged = onStage()) {
        return [...cards].reverse().find(card => !staged.has(card.id)) || null;
    }

    function button(action, label, name, handler) {
        const node = document.createElement('button');
        node.type = 'button';
        node.dataset.action = action;
        node.textContent = label;
        node.setAttribute('aria-label', name);
        node.addEventListener('click', handler);
        return node;
    }

    function paint(slot, card, staged) {
        slot.el.replaceChildren();
        slot.el.removeAttribute('data-card-id');
        if (!card) {
            slot.el.classList.add('empty');
            return;
        }
        slot.el.classList.remove('empty');
        slot.el.dataset.cardId = card.id;
        const tags = document.createElement('p');
        tags.className = 'card-tags';
        if (card.asked) tags.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: 'Asked' }));
        if (staged) tags.append(Object.assign(document.createElement('span'), { className: 'tag on', textContent: 'On stage' }));
        // Shown by CSS only while this slot is the keyboard target.
        tags.append(Object.assign(document.createElement('span'), { className: 'tag key', textContent: 'P / D' }));
        const body = document.createElement('div');
        body.className = 'card-body';
        body.append(...cardContent(card));
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const promote = button('promote', staged ? 'On stage' : 'Promote',
            staged ? `“${card.title}” is on the stage` : `Promote “${card.title}” to the stage`,
            () => { session.promote(card.id); changed(); });
        promote.disabled = staged;
        actions.append(promote, button('dismiss', 'Dismiss', `Dismiss “${card.title}”`,
            () => { session.dismiss(card.id); changed(); }));
        slot.el.append(tags, body, actions);
    }

    function draw() {
        const cards = session.rail();
        const byId = new Map(cards.map(card => [card.id, card]));
        for (const slot of slots) if (slot.id && !byId.has(slot.id)) slot.id = null;
        for (const card of cards) {
            if (slots.some(slot => slot.id === card.id)) continue;
            const free = slots.find(slot => !slot.id);
            if (free) free.id = card.id;
        }
        const staged = onStage();
        const target = targetOf(cards, staged);
        for (const slot of slots) {
            const card = slot.id ? byId.get(slot.id) : null;
            const key = card ? `${card.id}|${staged.has(card.id)}|${card.layout}` : 'empty';
            if (key !== slot.key) {
                slot.key = key;
                paint(slot, card, !!card && staged.has(card.id));
            }
            // Moving the target toggles an attribute; it never rebuilds a slot
            // under a pointer that is mid-press.
            slot.el.toggleAttribute('data-target', !!card && card.id === target?.id);
        }
    }

    draw();
    return {
        update: draw,
        /** The card P and D act on: the newest one not yet on the stage. */
        target: () => targetOf(session.rail()),
        promoteTarget() {
            const card = targetOf(session.rail());
            if (!card) return null;
            const result = session.promote(card.id);
            changed();
            return result.action === 'promote' ? card : null;
        },
        dismissTarget() {
            const card = targetOf(session.rail());
            if (!card) return null;
            session.dismiss(card.id);
            changed();
            return card;
        }
    };
}
