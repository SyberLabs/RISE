/**
 * Typed refusals for the render projection.
 *
 * A named object that cannot resolve is absent. An unsupported required cue
 * is a render refusal. These errors never rewrite the Experience Program.
 */

export class RenderError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'RenderError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

export const fail = (code, message, path, details) => {
  throw new RenderError(code, message, path, details);
};
