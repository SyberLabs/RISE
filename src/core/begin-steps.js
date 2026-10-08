/**
 * The steps of a Begin, stamped only while a timing test is watching: e2e/home-begin.spec.js installs
 * `window.__riseBegin` with a `steps` list before the press, and reads them back beside the first word.
 * Without it this does nothing, so a reader pays for none of it.
 */
export function beginStep(name) {
    globalThis.__riseBegin?.steps?.push([name, performance.now()]);
}
