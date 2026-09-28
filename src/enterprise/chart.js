/**
 * Draw a chart from the table the card names.
 *
 * The spec carries a table id, a label column id, and value column ids.
 * Cells are copied as stored. A layout change (bar, line, table) changes
 * presentation only.
 */

import { fail } from './errors.js';

export function renderChart(card, corpus) {
    if (!card?.chart || !['bar', 'line', 'table'].includes(card.layout)) {
        fail('CHART_LAYOUT', 'A chart layout has to be bar, line, or table');
    }
    const table = corpus.tables.find(item => item.id === card.chart.tableId);
    if (!table) fail('CHART_TABLE', 'Chart cites a missing table');
    const label = table.columns.find(column => column.id === card.chart.labelColumnId);
    if (!label) fail('CHART_COLUMN', 'Chart cites a missing label column');
    const valueColumns = card.chart.valueColumnIds.map(id => {
        const column = table.columns.find(item => item.id === id);
        if (!column || column.kind !== 'number') {
            fail('CHART_COLUMN', 'A plotted column has to be a number column on the table');
        }
        return column;
    });
    return {
        chartType: card.layout,
        labelColumn: { id: label.id, name: label.name },
        valueColumns: valueColumns.map(column => ({ id: column.id, name: column.name })),
        rows: table.rows.map(row => ({
            label: row[label.id],
            values: valueColumns.map(column => row[column.id])
        })),
        provenance: card.provenance
    };
}
