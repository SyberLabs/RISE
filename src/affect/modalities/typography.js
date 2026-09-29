/**
 * Typography contribution from explicit settings.
 * Tracking and size inform expansiveness. Weight informs density.
 * Neither is treated as an emotion.
 */

import { clamp, experienceState, slot, unavailableState } from '../schema.js';

export function typographyState(input = {}) {
    const hasSpacing = Number.isFinite(input.letterSpacing);
    const hasSize = Number.isFinite(input.fontSize);
    const hasWeight = Number.isFinite(input.fontWeight);
    if (!hasSpacing && !hasSize && !hasWeight) {
        return unavailableState('typography', 'typography-unspecified');
    }
    const spacing = hasSpacing ? input.letterSpacing : 0;
    const size = hasSize ? input.fontSize : 16;
    const weight = hasWeight ? input.fontWeight : 400;
    const dimensions = {};
    if (hasSpacing || hasSize) {
        dimensions.expansiveness = slot(
            clamp(0.35 + spacing * 4 + (size - 16) / 80, 0, 1),
            0.35,
            'prior'
        );
    }
    if (hasWeight || hasSpacing) {
        dimensions.perceptualDensity = slot(
            clamp((weight - 300) / 500 + (spacing < 0 ? 0.1 : 0), 0, 1),
            0.3,
            'prior'
        );
    }
    return experienceState({
        modality: 'typography',
        dimensions,
        measurements: {
            letterSpacing: hasSpacing ? spacing : undefined,
            fontSize: hasSize ? size : undefined,
            fontWeight: hasWeight ? weight : undefined,
            displayMode: typeof input.displayMode === 'string' ? input.displayMode : undefined
        },
        caveats: ['typography-is-not-emotion'],
        provenance: {
            method: 'typography-prior-v1',
            note: 'Spacing, size, and weight are measured settings. The axis placement is a prior.'
        }
    });
}
