/**
 * The browser half of a live OpenAI session, with a fake peer connection and a
 * fake site, and a virtual clock.
 *
 * What is held: the key goes to this site in one header and to nothing else;
 * the offer is receive-only for audio, so the microphone is never asked for; a
 * refusal is said in RISE's words; a connection that cannot be made is closed
 * on every path, so nothing is left open; and a dropped connection is reported.
 */
import { describe, expect, it, vi } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createOpenAIWebRtcTransport } from './openai-webrtc.js';

const KEY = 'sk-test-0123456789abcdefghijklmnopqrstuvwxyz';
const OFFER_SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
const ANSWER_SDP = 'v=0\r\nm=audio 9\r\nm=application 9\r\n';

class FakeChannel {
    constructor() { this.readyState = 'connecting'; this.listeners = new Map(); this.sent = []; this.closed = false; }
    addEventListener(type, fn) { (this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type)).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    emit(type, event = {}) { for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event); }
    send(text) { this.sent.push(text); }
    close() { this.closed = true; this.readyState = 'closed'; this.emit('close'); }
    open() { this.readyState = 'open'; this.emit('open'); }
}

function makePeer({ gatherImmediately = true, opens = true, throwOn } = {}) {
    const made = [];
    class Peer {
        constructor() {
            this.iceGatheringState = gatherImmediately ? 'complete' : 'gathering';
            this.connectionState = 'new';
            this.listeners = new Map();
            this.transceivers = [];
            this.closed = false;
            this.channel = null;
            made.push(this);
        }
        createDataChannel(name) { this.channelName = name; this.channel = new FakeChannel(); return this.channel; }
        addTransceiver(kind, init) { this.transceivers.push([kind, init]); }
        async createOffer() { if (throwOn === 'offer') throw new Error('no offer'); return { type: 'offer', sdp: OFFER_SDP }; }
        async setLocalDescription(description) { this.localDescription = description; }
        async setRemoteDescription(description) {
            if (throwOn === 'answer') throw new Error(`bad answer ${KEY}`);
            this.remoteDescription = description;
            if (opens) queueMicrotask(() => this.channel.open());
        }
        addEventListener(type, fn) { (this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type)).add(fn); }
        removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
        emit(type) { for (const fn of [...(this.listeners.get(type) ?? [])]) fn({}); }
        close() { this.closed = true; this.connectionState = 'closed'; }
    }
    return { Peer, made };
}

const answering = (status = 200, body = ANSWER_SDP) => vi.fn(async () => new Response(body, { status }));

function setup(options = {}, peerOptions = {}) {
    const { Peer, made } = makePeer(peerOptions);
    const clock = createVirtualClock();
    const fetchImpl = options.fetchImpl ?? answering();
    const transport = createOpenAIWebRtcTransport({ getKey: () => KEY, fetchImpl, PeerConnection: Peer, clock, ...options });
    return { transport, made, clock, fetchImpl };
}

describe('opening a session', () => {
    it('makes a text-only offer, relays it to this site with the key in one header, and connects to what comes back', async () => {
        const { transport, made, fetchImpl } = setup();
        const connection = await transport.open();
        const peer = made[0];
        expect(peer.channelName).toBe('oai-events');
        // Receive-only audio: the microphone is never asked for.
        expect(peer.transceivers).toEqual([['audio', { direction: 'recvonly' }]]);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('/api/live/realtime');
        expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', body: OFFER_SDP });
        expect(init.headers).toEqual({ 'Content-Type': 'application/sdp', Authorization: `Bearer ${KEY}` });
        expect(String(url)).not.toContain(KEY);
        expect(init.body).not.toContain(KEY);
        expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: ANSWER_SDP });

        connection.send('{"type":"x"}');
        expect(peer.channel.sent).toEqual(['{"type":"x"}']);
        connection.close();
        expect(peer.closed).toBe(true);
        expect(peer.channel.closed).toBe(true);
    });

    it('names the model it asks for, and only in the address', async () => {
        const { transport, fetchImpl } = setup({ model: 'gpt-realtime-mini' });
        await transport.open();
        expect(fetchImpl.mock.calls[0][0]).toBe('/api/live/realtime?model=gpt-realtime-mini');
    });

    it('hands over messages that are text, and reports a drop from the channel or from the connection', async () => {
        const { transport, made } = setup();
        const connection = await transport.open();
        const heard = [];
        const drops = [];
        connection.onMessage(text => heard.push(text));
        connection.onClose(() => drops.push('dropped'));
        made[0].channel.emit('message', { data: 'hello' });
        made[0].channel.emit('message', { data: new ArrayBuffer(4) });
        expect(heard).toEqual(['hello', '']);
        made[0].channel.emit('close');
        made[0].connectionState = 'failed';
        made[0].emit('connectionstatechange');
        expect(drops).toHaveLength(2);
    });

    it('does not wait for every candidate: it offers what it has after a moment', async () => {
        const { transport, clock, made } = setup({}, { gatherImmediately: false });
        const opening = transport.open();
        await clock.advance(4_000);
        const connection = await opening;
        expect(made[0].localDescription.sdp).toBe(OFFER_SDP);
        connection.close();
        expect(clock.pending()).toBe(0);
    });

    it('carries on at once when the last candidate arrives before the moment is up', async () => {
        const { transport, clock, made } = setup({}, { gatherImmediately: false });
        const opening = transport.open();
        await clock.advance(500);
        made[0].iceGatheringState = 'complete';
        made[0].emit('icegatheringstatechange');
        await opening;
        expect(clock.now()).toBe(500);
        expect(clock.pending()).toBe(0);
    });
});

describe('when it cannot', () => {
    it('needs the key first, before making anything', async () => {
        const { made } = makePeer();
        for (const key of ['', '   ', undefined, null, 42]) {
            const { Peer, made: madeHere } = makePeer();
            const transport = createOpenAIWebRtcTransport({ getKey: () => key, fetchImpl: answering(), PeerConnection: Peer, clock: createVirtualClock() });
            await expect(transport.open()).rejects.toMatchObject({ code: 'KEY_REQUIRED' });
            expect(madeHere).toEqual([]);
        }
        expect(made).toEqual([]);
    });

    it('says so, in words, when this browser cannot make the connection', async () => {
        const transport = createOpenAIWebRtcTransport({ getKey: () => KEY, fetchImpl: answering(), PeerConnection: undefined, clock: createVirtualClock() });
        await expect(transport.open()).rejects.toMatchObject({ code: 'NO_WEBRTC' });
    });

    for (const [status, code] of [[401, 'KEY_REFUSED'], [429, 'RATE_LIMITED'], [503, 'LIVE_UNAVAILABLE'], [502, 'PROVIDER_FAILED'], [400, 'PROVIDER_FAILED'], [500, 'PROVIDER_FAILED']]) {
        it(`says ${code} for a ${status}, and closes what it opened`, async () => {
            const { transport, made } = setup({ fetchImpl: answering(status, JSON.stringify({ error: { message: KEY } })) });
            const error = await transport.open().catch(caught => caught);
            expect(error).toMatchObject({ code, recoverable: false });
            expect(error.message).not.toContain(KEY);
            expect(made[0].closed).toBe(true);
            expect(made[0].channel.closed).toBe(true);
        });
    }

    it('says the site could not be reached, without the key, and closes what it opened', async () => {
        const { transport, made } = setup({ fetchImpl: vi.fn(async () => { throw new Error(`network ${KEY}`); }) });
        const error = await transport.open().catch(caught => caught);
        expect(error).toMatchObject({ code: 'NETWORK' });
        expect(error.message).not.toContain(KEY);
        expect(made[0].closed).toBe(true);
    });

    it('closes what it opened, and does not leak the key, when the browser refuses the answer or the offer', async () => {
        for (const throwOn of ['answer', 'offer']) {
            const { transport, made } = setup({}, { throwOn });
            const error = await transport.open().catch(caught => caught);
            expect(error).toMatchObject({ code: 'CONNECT_FAILED' });
            expect(error.message).not.toContain(KEY);
            expect(made[0].closed).toBe(true);
        }
    });

    it('gives up if the channel never opens, and if it closes before it opens, and closes what it opened', async () => {
        const slow = setup({}, { opens: false });
        const waiting = slow.transport.open().catch(caught => caught);
        await slow.clock.advance(12_000);
        expect(await waiting).toMatchObject({ code: 'CONNECT_TIMEOUT' });
        expect(slow.made[0].closed).toBe(true);
        expect(slow.clock.pending()).toBe(0);

        const closing = setup({}, { opens: false });
        const attempt = closing.transport.open().catch(caught => caught);
        await Promise.resolve();
        await closing.clock.advance(1);
        closing.made[0].channel.emit('close');
        expect(await attempt).toMatchObject({ code: 'CONNECT_FAILED' });
        expect(closing.clock.pending()).toBe(0);
    });
});
