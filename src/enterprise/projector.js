/**
 * The stage on a second screen. The presenter page draws into the popup
 * itself, through the same stage view, so the projector can only show what
 * Promote put on the stage. The popup runs no script and has no controls.
 * When the presenter page goes away the projector goes blank: nothing may
 * stay on it that the presenter can no longer retract. If the page comes
 * back from the back-forward cache, the projector is drawn again.
 */

import { renderStage } from './stage-view.js';

const NAME = 'rise-enterprise-stage';

let current = null;
let watching = false;

function watchPage() {
    if (watching) return;
    watching = true;
    window.addEventListener('pagehide', () => {
        if (current && !current.popup.closed) current.root.replaceChildren();
    });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted && current && !current.popup.closed) current.view.update();
    });
}

export function openProjector(session) {
    const popup = window.open('', NAME, 'popup,width=1280,height=720');
    if (!popup) return null;
    const doc = popup.document;
    doc.title = 'Stage';
    doc.documentElement.lang = document.documentElement.lang;
    doc.documentElement.dataset.view = 'projector';
    doc.head.replaceChildren(...[...document.querySelectorAll('head > meta[name="color-scheme"], head > style')]
        .map(node => doc.importNode(node, true)));
    const root = doc.createElement('div');
    root.id = 'stage';
    doc.body.replaceChildren(root);
    current = { popup, root, view: renderStage(root, session, { controls: false }) };
    watchPage();
    popup.focus();
    const opened = current;
    return {
        get closed() {
            return popup.closed;
        },
        update() {
            if (!popup.closed) opened.view.update();
        }
    };
}
