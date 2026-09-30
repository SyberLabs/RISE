/**
 * The Page opens where the reading is.
 *
 * The Stream's head is the reading's one place (LATERAL-TRAVERSAL-SPEC: there
 * is no seeking). The Page is a second way of looking at it, so it opens on
 * the head, and nothing done there moves it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { PageReader } from '../page/PageReader.js';

function mount(head) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = {
        state: 'paused',
        sessionState: { currentIndex: head },
        pause: vi.fn(),
        play: vi.fn(),
        stop: vi.fn(),
        on: vi.fn(),
        setInterlocutionHandler: vi.fn()
    };
    const chamber = new Chamber(container, {
        session: {
            title: 'A long reading',
            atoms: Array.from({ length: 60 }, (_, i) => ({
                content: `Paragraph ${i} — ${'word '.repeat(60)}`,
                modality: 'text',
                duration: 500,
                chapter: 1,
                verse: i + 1
            })),
            totalDuration: 30000,
            atomCount: 60,
            visualConfig: { visualMode: 'off' }
        },
        player
    });
    return { chamber, player };
}

let show;
let go;

beforeEach(() => {
    show = vi.spyOn(PageReader.prototype, 'showAtom');
    go = vi.spyOn(PageReader.prototype, 'goToPage');
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('Page mode opens on the head', () => {
    it('opens on the atom the Stream is showing, not on its own first page', async () => {
        const { chamber } = mount(40);
        await chamber.togglePageMode(true);
        expect(show).toHaveBeenCalledWith(40);
        chamber.destroy();
    });

    it('does not move the head', async () => {
        const { chamber, player } = mount(40);
        await chamber.togglePageMode(true);
        chamber.pageReader.showAtom(55);
        expect(player.sessionState.currentIndex).toBe(40);
        chamber.destroy();
    });

    it('returns to the page the reader reached while the head has not moved', async () => {
        const { chamber } = mount(40);
        await chamber.togglePageMode(true);
        chamber._syncPageTurn({ index: 3, total: 9, isPaged: true, canPage: true });
        await chamber.togglePageMode(false);
        show.mockClear();
        go.mockClear();

        await chamber.togglePageMode(true);

        expect(go).toHaveBeenCalledWith(3);
        expect(show).not.toHaveBeenCalled();
        chamber.destroy();
    });

    it('opens on the new head once the Stream has moved past where the page was left', async () => {
        const { chamber, player } = mount(40);
        await chamber.togglePageMode(true);
        chamber._syncPageTurn({ index: 3, total: 9, isPaged: true, canPage: true });
        await chamber.togglePageMode(false);
        player.sessionState.currentIndex = 47;
        show.mockClear();

        await chamber.togglePageMode(true);

        expect(show).toHaveBeenCalledWith(47);
        chamber.destroy();
    });
});
