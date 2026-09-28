/**
 * The stage on a second screen. The presenter page draws into the popup
 * itself, through the same stage view, so the projector can only show what
 * Promote put on the stage. The popup runs no script and has no controls.
 * When the presenter page goes away the projector goes blank: nothing may
 * stay on it that the presenter can no longer retract.
 */

import { renderStage } from './stage-view.js';

const NAME = 'rise-enterprise-stage';

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
    const view = renderStage(root, session, { controls: false });

    const blank = () => {
        if (!popup.closed) root.replaceChildren();
    };
    window.addEventListener('pagehide', blank);
    popup.focus();
    return {
        get closed() {
            return popup.closed;
        },
        update() {
            if (!popup.closed) view.update();
        }
    };
}
