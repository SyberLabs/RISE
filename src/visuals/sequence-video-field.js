/**
 * Sequence-local MP4 presenter.
 *
 * The score owns authority; this class owns only DOM playback. It never
 * chooses a video, never enables audio, and never keeps decoding once its cue
 * is replaced. Reduced motion holds the first decoded frame as the poster.
 */
export function adaptiveVideoLayout({
  mediaWidth,
  mediaHeight,
  stageWidth,
  stageHeight,
  presentation = 'full-frame'
} = {}) {
  const mw = Number(mediaWidth);
  const mh = Number(mediaHeight);
  const sw = Number(stageWidth);
  const sh = Number(stageHeight);
  const mediaAspect = mw > 0 && mh > 0 ? mw / mh : null;
  const stageAspect = sw > 0 && sh > 0 ? sw / sh : null;
  const mediaOrientation = mediaAspect == null
    ? 'unknown'
    : mediaAspect > 1.08 ? 'landscape' : mediaAspect < 0.92 ? 'portrait' : 'square';
  const stageOrientation = stageAspect == null
    ? 'unknown'
    : stageAspect > 1.08 ? 'landscape' : stageAspect < 0.92 ? 'portrait' : 'square';

  // `retained` is the fraction of the media's limiting dimension that a
  // centered cover crop would keep. Near-matched shapes fill the stage;
  // severe portrait/landscape mismatches keep the complete authored frame.
  const retained = mediaAspect && stageAspect
    ? Math.min(mediaAspect / stageAspect, stageAspect / mediaAspect)
    : 1;
  const threshold = presentation === 'behind-stream'
    ? 0.78
    : presentation === 'continuous' ? 0.68 : 0.62;
  const fit = retained >= threshold ? 'cover' : 'contain';

  return Object.freeze({
    fit,
    mediaAspect,
    stageAspect,
    mediaOrientation,
    stageOrientation,
    retained
  });
}

export class SequenceVideoField {
  constructor(host, options = {}) {
    this.host = host;
    this.reducedMotion = options.reducedMotion === true;
    this.presentation = options.presentation || 'full-frame';
    this.root = document.createElement('div');
    this.root.className = 'sequence-video-field';
    this.root.hidden = true;
    this.video = document.createElement('video');
    this.video.className = 'sequence-video-work';
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.setAttribute('muted', '');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.video);
    this.host.appendChild(this.root);
    this._generation = 0;
    this._assetId = null;
    this._active = false;
    this._transportPaused = false;
    this._ready = false;
    this._assetUri = null;
    this._timeMode = 'loop';
    this._resize = () => this._syncLayout();
    this._resizeObserver = null;
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._resize);
      this._resizeObserver.observe(this.host);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resize, { passive: true });
      window.visualViewport?.addEventListener?.('resize', this._resize, { passive: true });
    }
    this._syncLayout();
  }

  show(asset, cue = {}) {
    if (!asset?.uri || asset.kind !== 'video' || asset.mimeType !== 'video/mp4') {
      this.hide();
      return false;
    }
    this.presentation = cue.presentation || this.presentation || 'full-frame';
    this._timeMode = cue.timeMode || 'loop';
    const sameWork = this._active
      && this._assetId === asset.id
      && this._assetUri === asset.uri;
    if (sameWork) {
      this.video.loop = this._timeMode === 'loop';
      this._syncLayout();
      if (this.reducedMotion) this._pauseVideo();
      else if (this._ready && !this._transportPaused) this._playVideo();
      return true;
    }
    const generation = ++this._generation;
    this._active = true;
    this._transportPaused = false;
    this._ready = false;
    this._assetId = asset.id;
    this._assetUri = asset.uri;
    this.root.hidden = true;
    this._pauseVideo();
    this.video.loop = this._timeMode === 'loop';
    try { this.video.currentTime = 0; } catch { /* metadata not available yet */ }
    this.video.onloadedmetadata = () => {
      if (!this._active || generation !== this._generation) return;
      this._syncLayout();
    };
    this.video.onloadeddata = () => {
      if (!this._active || generation !== this._generation) return;
      this._ready = true;
      this._syncLayout();
      this.root.hidden = false;
      if (this.reducedMotion || this._transportPaused) {
        this._pauseVideo();
        return;
      }
      // Muted playback is the sole V1 policy. A browser refusal degrades to
      // the decoded first frame, never a broken or invisible player.
      this._playVideo();
    };
    this.video.onerror = () => {
      if (generation === this._generation) this.hide();
    };
    this.video.onended = () => {
      if (this._timeMode !== 'hold-final' && this._timeMode !== 'cue') this.hide();
    };
    this.video.src = asset.uri;
    try { this.video.load(); } catch { /* jsdom / detached */ }
    return true;
  }

  pause() {
    if (!this._active || this._transportPaused) return false;
    this._transportPaused = true;
    this._pauseVideo();
    return true;
  }

  resume() {
    if (!this._active || !this._transportPaused) return false;
    this._transportPaused = false;
    if (!this.reducedMotion && !this.root.hidden) {
      this._playVideo();
    }
    return true;
  }

  hide() {
    this._generation += 1;
    this._active = false;
    this._transportPaused = false;
    this._assetId = null;
    this._assetUri = null;
    this._ready = false;
    this._pauseVideo();
    this.video.onloadedmetadata = null;
    this.video.onloadeddata = null;
    this.video.onerror = null;
    this.video.onended = null;
    this.video.removeAttribute('src');
    try { this.video.load(); } catch { /* jsdom / detached */ }
    this.root.hidden = true;
  }

  setPresentation(presentation) {
    const next = ['full-frame', 'behind-stream', 'continuous'].includes(presentation)
      ? presentation
      : 'full-frame';
    if (next === this.presentation) return false;
    this.presentation = next;
    this._syncLayout();
    return true;
  }

  _syncLayout() {
    const rect = this.host?.getBoundingClientRect?.();
    const layout = adaptiveVideoLayout({
      mediaWidth: this.video.videoWidth,
      mediaHeight: this.video.videoHeight,
      stageWidth: rect?.width || this.host?.clientWidth,
      stageHeight: rect?.height || this.host?.clientHeight,
      presentation: this.presentation
    });
    this.root.dataset.fit = layout.fit;
    this.root.dataset.mediaOrientation = layout.mediaOrientation;
    this.root.dataset.stageOrientation = layout.stageOrientation;
    this.root.dataset.presentation = this.presentation;
    if (layout.mediaAspect) {
      this.root.style.setProperty('--sequence-video-aspect', String(layout.mediaAspect));
    } else {
      this.root.style.removeProperty('--sequence-video-aspect');
    }
    return layout;
  }

  _pauseVideo() {
    try { this.video.pause(); } catch { /* detached / unsupported media API */ }
  }

  _playVideo() {
    try {
      Promise.resolve(this.video.play()).catch(() => this._pauseVideo());
    } catch {
      this._pauseVideo();
    }
  }

  destroy() {
    this.hide();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._resize);
      window.visualViewport?.removeEventListener?.('resize', this._resize);
    }
    this.root.remove();
  }

  get active() { return this._active; }
  get assetId() { return this._assetId; }
}
