/**
 * Hosted teachers are offline reference judges.
 *
 * This function does not call a network unless a caller passes a URL.
 * An unset URL is a recorded result, not a silent skip.
 */

export async function hostedTeacher(passage, env = {}) {
    const url = env.AFFECT_TEACHER_URL;
    if (!url) {
        return {
            id: 'hosted-teacher',
            status: 'unavailable',
            reason: 'AFFECT_TEACHER_URL is unset. No hosted model was called.',
            passageId: passage?.id ?? null
        };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                id: passage.id,
                text: passage.text,
                task: 'continuous-affect-reference'
            }),
            signal: controller.signal
        });
        if (!response.ok) {
            return { id: 'hosted-teacher', status: 'error', reason: `HTTP ${response.status}`, passageId: passage.id };
        }
        const body = await response.json();
        return { id: 'hosted-teacher', status: 'ok', passageId: passage.id, body };
    } catch (error) {
        return {
            id: 'hosted-teacher',
            status: 'error',
            reason: error.name === 'AbortError' ? 'timeout' : 'request-failed',
            passageId: passage?.id ?? null
        };
    } finally {
        clearTimeout(timer);
    }
}
