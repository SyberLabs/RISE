/**
 * One failure type for the live room.
 *
 * A card, a corpus row, or a decision either validates or refuses with a
 * code. Callers do not repair a bad card into a weaker one.
 */

export class EnterpriseError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'EnterpriseError';
        this.code = code;
    }
}

export function fail(code, message) {
    throw new EnterpriseError(code, message);
}
