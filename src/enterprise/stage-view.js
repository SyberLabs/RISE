/**
 * The public stage. It shows only cards a presenter has promoted, and the
 * only control is Retract. Promote stays on the rail.
 */

import { cardContent } from './card-view.js';

export function renderStage(root, session, { onChange } = {}) {
    function draw() {
        root.replaceChildren();
        const surface = document.createElement('div');
        surface.dataset.surface = 'stage';
        const cards = session.stage();
        if (!cards.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-note';
            empty.textContent = 'Nothing on stage.';
            surface.append(empty);
        }
        for (const card of cards) {
            const item = document.createElement('article');
            item.dataset.cardId = card.id;
            item.append(...cardContent(card));
            const retract = document.createElement('button');
            retract.type = 'button';
            retract.dataset.action = 'retract';
            retract.textContent = 'Retract';
            retract.setAttribute('aria-label', `Retract “${card.title}” from the stage`);
            retract.addEventListener('click', () => {
                session.retract(card.id);
                draw();
                onChange?.();
            });
            item.append(retract);
            surface.append(item);
        }
        root.append(surface);
    }

    draw();
    return { update: draw };
}
