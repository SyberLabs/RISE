const [{ KokoroTTS }, { default: sharp }] = await Promise.all([
    import('kokoro-js'),
    import('sharp'),
]);

if (typeof KokoroTTS?.from_pretrained !== 'function') {
    throw new Error('kokoro-js did not expose KokoroTTS.from_pretrained');
}
if (typeof sharp !== 'function') {
    throw new Error('sharp did not expose its image factory');
}

const { info } = await sharp({
    create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
}).png().toBuffer({ resolveWithObject: true });

if (info.format !== 'png' || info.width !== 1 || info.height !== 1) {
    throw new Error('sharp could not encode the compatibility probe');
}

// The speech engine parses MathML with the overridden @xmldom/xmldom in Node.
const { default: sre } = await import('speech-rule-engine');
await sre.setupEngine({ locale: 'en', domain: 'clearspeak', modality: 'speech' });
const half = sre.toSpeech('<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>');
if (half !== 'one half') {
    throw new Error(`speech-rule-engine read one half as ${JSON.stringify(half)}`);
}

console.log('Kokoro, Sharp and the speech engine compatibility verified.');
