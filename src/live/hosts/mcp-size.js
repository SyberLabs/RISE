/** Byte budgets for the sealed Current and complete parent messages on the MCP path only. */
export const MCP_CURRENT_BYTES = 65_536;
export const MCP_MESSAGE_BYTES = 262_144;

/** Measure the JSON representation the other side receives, in UTF-8 bytes. */
export function serializedUtf8Bytes(value) {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? new TextEncoder().encode(serialized).byteLength : null;
}
