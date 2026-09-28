/**
 * The body of a card as the rail and the stage draw it: title, the verbatim
 * quote or the copied table cells, and where it came from. Text only, set
 * through textContent; nothing here interprets card content as markup.
 */

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

export function sourceLine(card) {
    return card.provenance.map(item => {
        const table = item.tableId ? ` · table ${item.tableId}` : '';
        return `${item.documentId} · p. ${item.page}${table}`;
    }).join('; ');
}

export function cardContent(card, headingTag = 'h3') {
    const parts = [element(headingTag, 'card-title', card.title)];
    if (card.body) parts.push(element('blockquote', 'card-quote', card.body));
    if (card.chart) {
        const table = element('table', 'card-chart');
        const magnitudes = card.chart.rows.flatMap(row => row.values.map(value => Math.abs(Number(value))));
        const scale = Math.max(...magnitudes, 1);
        for (const row of card.chart.rows) {
            const tr = element('tr');
            tr.append(element('th', null, row.label));
            for (const value of row.values) {
                const cell = element('td', null, value);
                if (card.layout !== 'table') {
                    const bar = element('span', 'bar');
                    // Leaves room for the value beside the bar; lengths stay proportional.
                    bar.style.width = `${Math.round((Math.abs(Number(value)) / scale) * 75)}%`;
                    cell.prepend(bar);
                }
                tr.append(cell);
            }
            table.append(tr);
        }
        parts.push(table);
    }
    parts.push(element('p', 'card-source', sourceLine(card)));
    return parts;
}
