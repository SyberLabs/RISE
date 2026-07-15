export function createAbortError(message = 'Operation aborted') {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

export function isAbortError(error) {
    return error?.name === 'AbortError';
}

export function abortableDelay(ms, signal) {
    if (!ms) return Promise.resolve();
    if (signal?.aborted) return Promise.reject(createAbortError());

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(createAbortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Create a request-local AbortSignal that follows its parent and also has a
 * hard deadline. Call cleanup() in a finally block.
 */
export function withAbortTimeout(parentSignal, timeoutMs, label = 'Request') {
    const controller = new AbortController();
    let timedOut = false;
    const onParentAbort = () => controller.abort(parentSignal?.reason || createAbortError());

    if (parentSignal?.aborted) onParentAbort();
    else parentSignal?.addEventListener('abort', onParentAbort, { once: true });

    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(createAbortError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    return {
        signal: controller.signal,
        didTimeout: () => timedOut,
        cleanup() {
            clearTimeout(timer);
            parentSignal?.removeEventListener('abort', onParentAbort);
        }
    };
}
