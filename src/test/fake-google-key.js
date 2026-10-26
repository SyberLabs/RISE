/**
 * A Google-shaped fake for tests that prove a key is scrubbed.
 *
 * Joined when the test runs, so the source file never holds one contiguous literal.
 *
 * @param {string} [rest] what follows the provider prefix. The default is the fixture the Gemini scrub tests share.
 */
export function fakeGoogleApiKey(rest = `D-not-a-real-key-${'0'.repeat(15)}`) {
    return ['AI', 'za', 'Sy', rest].join('');
}
