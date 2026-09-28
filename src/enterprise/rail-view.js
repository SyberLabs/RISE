/**
 * The speaker rail. Suggestions land here. Promote and Dismiss are the only
 * controls, and they are the speaker's. There is no stage on this surface.
 */

export function renderRail(root, session) {
    function draw() {
        const metrics = session.metrics();
        root.replaceChildren();
        const status = document.createElement('p');
        status.dataset.metrics = 'session';
        const acceptance = metrics.shown ? Math.round(metrics.acceptanceRate * 100) : 0;
        const provenance = metrics.provenanceComplete ? 'complete' : 'incomplete';
        status.textContent = [
            `Shown ${metrics.shown}`,
            `Promoted ${metrics.promoted}`,
            `Dismissed ${metrics.speakerDismissed}`,
            `Acceptance ${acceptance}%`,
            `Provenance ${provenance}`
        ].join(' · ');
        root.append(status);

        const list = document.createElement('ol');
        list.dataset.surface = 'rail';
        for (const card of session.rail()) {
            const item = document.createElement('li');
            item.dataset.cardId = card.id;
            const title = document.createElement('h2');
            title.textContent = card.title;
            item.append(title);
            if (card.body) {
                const quote = document.createElement('blockquote');
                quote.textContent = card.body;
                item.append(quote);
            }
            if (card.chart) {
                const table = document.createElement('table');
                const caption = document.createElement('caption');
                caption.textContent = card.layout;
                table.append(caption);
                const magnitudes = card.chart.rows.flatMap(row => row.values.map(value => Math.abs(Number(value))));
                const scale = Math.max(...magnitudes, 1);
                for (const row of card.chart.rows) {
                    const tr = document.createElement('tr');
                    const label = document.createElement('td');
                    label.textContent = row.label;
                    tr.append(label);
                    for (const value of row.values) {
                        const cell = document.createElement('td');
                        cell.textContent = value;
                        if (card.layout !== 'table') {
                            const mark = document.createElement('span');
                            mark.className = 'bar';
                            mark.style.width = `${(Math.abs(Number(value)) / scale) * 100}%`;
                            cell.prepend(mark);
                        }
                        tr.append(cell);
                    }
                    table.append(tr);
                }
                item.append(table);
            }
            const provenanceLine = document.createElement('p');
            provenanceLine.textContent = card.provenance.map(itemSource => {
                const table = itemSource.tableId ? ` · table ${itemSource.tableId}` : '';
                return `${itemSource.documentId} · page ${itemSource.page}${table} · ${itemSource.query}`;
            }).join('; ');
            item.append(provenanceLine);

            const promote = document.createElement('button');
            promote.type = 'button';
            promote.dataset.action = 'promote';
            promote.dataset.cardId = card.id;
            promote.textContent = 'Promote';
            promote.addEventListener('click', () => {
                session.promote(card.id);
                draw();
            });
            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.dataset.action = 'dismiss';
            dismiss.dataset.cardId = card.id;
            dismiss.textContent = 'Dismiss';
            dismiss.addEventListener('click', () => {
                session.dismiss(card.id);
                draw();
            });
            item.append(promote, dismiss);
            list.append(item);
        }
        root.append(list);
    }

    draw();
    return {
        update: draw,
        hear(event) {
            const result = session.hear(event);
            draw();
            return result;
        },
        promote(cardId) {
            session.promote(cardId);
            draw();
        },
        dismiss(cardId) {
            session.dismiss(cardId);
            draw();
        }
    };
}
