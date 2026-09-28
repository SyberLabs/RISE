/**
 * Map one recognition event onto the hear event. No microphone and no network.
 * The session hint list is the boost vocabulary; this module does not copy it.
 */

export function mapRecognitionEvent(raw, { presenterIds }) {
    const label = raw?.speakerLabel;
    const presenter = typeof label === 'string' && presenterIds.includes(label);
    return {
        text: raw.transcript,
        final: raw.isFinal === true,
        speaker: presenter ? 'presenter' : 'audience',
        speakerId: label == null ? 'audience' : label,
        at: raw.at
    };
}
