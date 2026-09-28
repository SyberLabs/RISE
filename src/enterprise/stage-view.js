/**
 * The public stage. It shows only cards a presenter has promoted, and the
 * only control is Retract. Promote stays on the rail.
 */

function provenanceLine(card) {
    return card.provenance.map(item => {
        const table = item.tableId ? ` · table ${item.tableId}` : '';
        return `${item.documentId} · page ${item.page}${table} · ${item.query}`;
    }).join('; ');
}

export function renderStage(root, session) {
    function draw() {
        root.replaceChildren();
        const surface = document.createElement('div');
        surface.dataset.surface = 'stage';
        const cards = session.stage();
        if (!cards.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Nothing on stage.';
            surface.append(empty);
        }
        for (const card of cards) {
            const item = document.createElement('article');
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
                for (const row of card.chart.rows) {
                    const tr = document.createElement('tr');
                    const label = document.createElement('td');
                    label.textContent = row.label;
                    tr.append(label);
                    for (const value of row.values) {
                        const cell = document.createElement('td');
                        cell.textContent = value;
                        tr.append(cell);
                    }
                    table.append(tr);
                }
                item.append(table);
            }
            const source = document.createElement('p');
            source.textContent = provenanceLine(card);
            item.append(source);
            const retract = document.createElement('button');
            retract.type = 'button';
            retract.dataset.action = 'retract';
            retract.dataset.cardId = card.id;
            retract.textContent = 'Retract';
            retract.setAttribute('aria-label', `Retract “${card.title}” from the stage`);
            retract.addEventListener('click', () => {
                session.retract(card.id);
                draw();
            });
            item.append(retract);
            surface.append(item);
        }
        root.append(surface);
    }

    draw();
    return { update: draw };
}
