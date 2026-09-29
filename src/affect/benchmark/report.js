/**
 * A passage-by-passage inspection report.
 * Aggregate numbers are a footer. They are not the report.
 */

function formatSlot(slot) {
    if (!slot || slot.value == null) return '—';
    return `${slot.value.toFixed(2)} (${slot.confidence.toFixed(2)} ${slot.source})`;
}

export function renderReport(result) {
    const lines = [
        '# RISE affect benchmark',
        '',
        'Runnable models were executed on passages held in the RISE archive.',
        'External models listed as unavailable were not run. Their published scores are not repeated here.',
        ''
    ];
    for (const passage of result.passages) {
        const cases = (passage.provenance?.cases || []).join(', ');
        lines.push(`## ${passage.id}`);
        lines.push('');
        lines.push(`Origin: ${passage.origin}. Cases: ${cases || 'none'}.`);
        if (passage.provenance?.archivePath) {
            lines.push(`Archive: \`${passage.provenance.archivePath}\` · ${passage.provenance.work} · ${passage.provenance.author}.`);
        }
        lines.push('');
        lines.push('> ' + passage.text);
        lines.push('');
        const dimensionIds = [...new Set(passage.outputs.flatMap(output => Object.keys(output.state.dimensions)))];
        const header = ['dimension', ...passage.outputs.map(output => output.modelId)];
        lines.push(`| ${header.join(' | ')} |`);
        lines.push(`| ${header.map(() => '---').join(' | ')} |`);
        for (const id of dimensionIds) {
            const cells = passage.outputs.map(output => formatSlot(output.state.dimensions[id]));
            lines.push(`| ${id} | ${cells.join(' | ')} |`);
        }
        lines.push('');
        for (const output of passage.outputs) {
            lines.push(`- ${output.modelId}: ${output.ms.toFixed(3)} ms, mean confidence ${output.confidence.toFixed(2)}, parameters ${output.parameters}, trained ${output.trained}.`);
            if (output.state.caveats?.length) lines.push(`  Caveats: ${output.state.caveats.join(', ')}.`);
        }
        if (passage.disagreements.length === 0) {
            lines.push('- Disagreements: none at the 0.35 threshold on shared axes.');
        } else {
            for (const item of passage.disagreements) {
                lines.push(`- Disagreement on ${item.dimension}: ${item.models.join(' vs ')} differ by ${item.delta.toFixed(2)} (${item.values.map(value => value.toFixed(2)).join(', ')}).`);
            }
        }
        if (passage.teacher) {
            lines.push(`- Teacher ${passage.teacher.id}: ${passage.teacher.status}. ${passage.teacher.reason || ''}`.trim());
        }
        lines.push('');
    }

    lines.push('## Models not executed');
    lines.push('');
    for (const model of result.models.filter(model => model.available === false)) {
        lines.push(`- ${model.id} (${model.role}): ${model.reason}`);
    }
    lines.push('');
    lines.push('## Watched failure classes');
    lines.push('');
    lines.push('Irony, ambiguity, and difficult literary cases are listed with their outputs above. A high confidence on those passages would be a claim this encoder is not entitled to make. The contextual model caps confidence at 0.7 because its readout is an unfitted prior.');
    lines.push('');
    const disagreementCount = result.passages.reduce((sum, passage) => sum + passage.disagreements.length, 0);
    lines.push('## Footer');
    lines.push('');
    lines.push(`Passages: ${result.passages.length}. Recorded disagreements: ${disagreementCount}.`);
    return lines.join('\n');
}
