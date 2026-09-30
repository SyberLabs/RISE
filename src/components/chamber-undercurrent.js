/**
 * The panel a dive opens: what lies under the passage the reading is at.
 *
 * Every word in it is set as text. A gloss may have been proposed by a model
 * and an echo is the edition's, and neither may become markup.
 *
 * Each thread says which kind of words it is. A reader can always tell a text
 * they were handed from one written here, and who wrote it.
 */

const WRITTEN_BY = Object.freeze({
    published: 'Written for this reading',
    user: 'Written by you',
    proposed: 'Proposed, not yet accepted'
});

const RECEIVED = 'From the text';

const NOTHING = 'Nothing lies under this passage.';

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function threadItem(thread) {
    const item = element('li', 'under-thread');
    item.dataset.kind = thread.kind;
    item.dataset.provenance = thread.provenance;
    if (thread.kind === 'echo') {
        item.append(
            element('blockquote', 'under-text', `\u201C${thread.text}\u201D`),
            element('p', 'under-provenance', RECEIVED)
        );
    } else {
        item.append(
            element('p', 'under-text', thread.text),
            element('p', 'under-provenance', WRITTEN_BY[thread.authority] || 'Written here')
        );
    }
    return item;
}

/**
 * Replace the panel's contents with what `undercurrentAt` found.
 *
 * @param {HTMLElement} panel
 * @param {{threads: object[], visual: object|null, audio: object|null}} under
 * @returns {number} how many threads were shown
 */
export function renderUndercurrent(panel, under) {
    const list = element('ul', 'under-list');
    for (const thread of under.threads) list.append(threadItem(thread));
    if (under.visual) list.append(element('li', 'under-score', 'The score puts an image here.'));
    if (under.audio) list.append(element('li', 'under-score', 'The score puts a sound here.'));

    if (list.children.length === 0) panel.replaceChildren(element('p', 'under-nothing', NOTHING));
    else panel.replaceChildren(list);
    return under.threads.length;
}
