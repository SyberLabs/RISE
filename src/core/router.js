/**
 * RISE — Application Router
 * View navigation with crossfade transitions
 *
 * Design principles (from UX spec):
 * - Transitions use crossfade (opacity), not slide
 * - Escape key returns to Home from any view
 * - View stack enables contextual back navigation
 */

/**
 * A view's code chunk is missing from the server.
 *
 * This is what a stale tab looks like after a deploy: the running shell
 * asks for a hashed chunk that the new build replaced, and the fetch
 * 404s. It is NOT transient — every retry fails identically — so a tab
 * left open across a release becomes permanently unable to reach any
 * view it has not already loaded. A reader in the Vault could not get
 * back to Home at all.
 */
function isStaleChunkError(error) {
    const message = String(error?.message || error || '');
    return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
        .test(message);
}

import { ROUTE_ALIASES, ROUTE_PANES, addressIsOwnTo, pathForRoute } from './route-url.js';
import { sameData } from './same-data.js';

const STALE_BUILD_SENTINEL = 'rise_reloaded_for_stale_build';
const STALE_BUILD_WINDOW_MS = 5 * 60_000;

/**
 * Claim the one reload a missing chunk earns: once per build, per window.
 *
 * The reload is the cure for a stale tab: it fetches the build that
 * replaced this one. If the chunk still fails in the build the reload
 * fetched — blocked by the network, say — it is not a deploy, and a
 * second reload fails identically, forever. So the claim names the build
 * it was spent from, and when, and survives the reload. A later deploy is
 * a new build, and may claim again; so may the same build once the claim
 * is old, or a reload spent on a network blip would strand the tab when a
 * deploy lands hours later. `build` is the entry chunk's hashed URL,
 * which changes whenever any chunk the entry loads does. Without storage
 * nothing could stop a loop, so nothing reloads.
 */
export function claimStaleBuildReload(build = import.meta.url) {
    try {
        let last = null;
        try { last = JSON.parse(sessionStorage.getItem(STALE_BUILD_SENTINEL)); } catch (e) { /* older form */ }
        if (last?.build === build && Date.now() - last.at < STALE_BUILD_WINDOW_MS) return false;
        sessionStorage.setItem(STALE_BUILD_SENTINEL, JSON.stringify({ build, at: Date.now() }));
        return true;
    } catch (e) {
        return false;
    }
}

export class Router {
    constructor(options = {}) {
        this.views = new Map();
        this.viewStack = [];
        this.currentView = null;
        this.transitioning = false;
        this._pendingNav = null;
        this.navigationRevision = 0;
        // The running build, named by the entry chunk. See claimStaleBuildReload.
        this.build = options.build;

        // Transition timing from design system
        this.transitionDuration = 400; // ms

        // Callbacks
        this.onNavigationIntent = options.onNavigationIntent || (() => {});
        this.onViewChange = options.onViewChange || (() => { });
        this.history = options.history || globalThis.history;
        this.location = options.location || globalThis.location;
        this.currentData = undefined;

        this.handleKeydown = this.handleKeydown.bind(this);
        document.addEventListener('keydown', this.handleKeydown);
    }

    /**
     * Register a view component
     * @param {string} name - View identifier
     * @param {object} config - { container, component, init }
     */
    registerView(name, config) {
        this.views.set(name, {
            container: config.container,
            component: config.component || null,
            init: config.init || null,
            instance: null
        });
    }

    /**
     * Navigate to a view
     * @param {string} viewName - Target view
     * @param {object} options - { data, replace, skipStack }
     */
    async navigate(requestedView, options = {}, queuedRevision) {
        // Old ids stay valid forever: the table in route-url.js says where
        // each one lives now.
        // An old id that became a pane of a room carries the pane's name.
        const viewName = ROUTE_ALIASES[requestedView] ?? requestedView;
        if (viewName !== requestedView && ROUTE_PANES[requestedView]) {
            // A reading's session is carried whole, never copied: the shell
            // and the live hand-off know it by identity.
            const data = requestedView === 'chamber-session' ? { session: options.data } : options.data;
            options = { ...options, data: { ...data, pane: ROUTE_PANES[requestedView] } };
        }
        const launchesReading = viewName === 'read' && options.data?.pane === 'chamber';
        const revision = queuedRevision ?? ++this.navigationRevision;
        if (queuedRevision === undefined) this.onNavigationIntent(viewName, options);
        console.log(`[Router] Navigate to: ${viewName}, from: ${this.currentView}`);
        if (this.transitioning) {
            // Don't silently eat clicks that land mid-transition — remember
            // the latest request and honor it once the crossfade completes.
            this._pendingNav?.resolve(false);
            return new Promise((resolve) => {
                this._pendingNav = { viewName, options, resolve, revision };
            });
        }
        // A completed division may hand the same immersive surface a fresh
        // Session. Same-route navigation is normally a no-op; `force` is the
        // explicit remount contract for that bounded continuation case.
        // A room that hosts panes exposes showPane and takes new data through
        // update; every other room ignores a move to itself. An in-place move
        // has no fade, but a back-stack entry and an address like any other.
        const inPlace = viewName === this.currentView && options.force !== true
            && typeof this.views.get(viewName)?.instance?.showPane === 'function';
        if (viewName === this.currentView && options.force !== true
            && (!inPlace || sameData(options.data, this.currentData))) return true;

        const newView = this.views.get(viewName);
        if (!newView) {
            console.error(`Router: View "${viewName}" not found`);
            return false;
        }

        this.transitioning = true;
        const previousViewName = this.currentView;
        const previousView = previousViewName ? this.views.get(previousViewName) : null;
        const previousData = this.currentData;
        let succeeded = false;
        // The address states where the reader is going, so it is written as
        // the move begins, not after a slow room (a reading) has initialised.
        this.writeAddress(viewName, options);
        const assertCurrentLaunch = () => {
            if (launchesReading && revision !== this.navigationRevision) {
                throw new DOMException('Launch cancelled', 'AbortError');
            }
        };
        // A reading launched from Home is drawn over Home's last frame: Home
        // stays shown and running under the Read view until the reading has
        // faded in, so no bare ground shows between the two (RDR-015). The
        // stylesheet lifts #view-read above #view-home while both show.
        let homeHeld = launchesReading && previousViewName === 'home';

        try {
            if (inPlace) {
                await newView.instance.update(options.data);
            } else {
                if (!homeHeld) {
                    previousView?.instance?.deactivate?.();
                    if (previousView?.container) {
                        await this.fadeOut(previousView.container);
                        previousView.container.hidden = true;
                    }
                }

                assertCurrentLaunch();

                // Views sharing a container cannot coexist. Dispose the old owner
                // only after it has been deactivated and visually removed.
                for (const [viewKey, viewData] of this.views.entries()) {
                    if (viewKey !== viewName && viewData.container === newView.container && viewData.instance) {
                        viewData.instance.destroy?.();
                        viewData.instance = null;
                    }
                }

                if (!newView.instance) {
                    if (newView.init) {
                        newView.instance = await newView.init(newView.container, options.data);
                    } else if (newView.component) {
                        newView.instance = new newView.component(newView.container, options.data);
                    }
                } else {
                    await newView.instance.update?.(options.data);
                }

                assertCurrentLaunch();
                newView.container.hidden = false;
                await this.fadeIn(newView.container);
                assertCurrentLaunch();
                if (homeHeld) {
                    previousView.instance?.deactivate?.();
                    previousView.container.hidden = true;
                    homeHeld = false;
                }
                newView.instance?.activate?.();
            }

            if (!options.replace && !options.skipStack && previousViewName
                && (previousViewName !== viewName || inPlace)) {
                this.viewStack.push({ viewName: previousViewName, data: this.currentData });
            }
            this.currentView = viewName;
            this.currentData = options.data;
            this.onViewChange(viewName, options.data);
            succeeded = true;
        } catch (error) {
            if (error?.name !== 'AbortError') console.error(`[Router] Navigation to "${viewName}" failed:`, error);
            if (launchesReading) newView.instance?.closePane?.('chamber');

            // A missing chunk cannot be recovered from in this session:
            // the shell itself is out of date. Reload once to pick up
            // the current build, preserving the destination so the
            // reader lands where they were going. The claim prevents a
            // reload loop when the chunk keeps failing after the reload.
            if (isStaleChunkError(error)
                && options.data?.provenance?.kind !== 'personal-generated'
                && claimStaleBuildReload(this.build)) {
                try {
                    // Carry the route DATA too, not just the view name:
                    // a Chapel book, a vault identifier, a Library
                    // selection. Bounded and JSON-only, on the
                    // same principle as provenance — recovery state must
                    // never be able to smuggle live objects across a
                    // reload. Oversized or circular data degrades to a
                    // plain view recovery rather than losing it entirely.
                    let payload = JSON.stringify({ viewName });
                    try {
                        const withData = JSON.stringify({ viewName, data: options.data });
                        if (withData.length <= 4000) payload = withData;
                    } catch (e) { /* unserializable data — view only */ }
                    sessionStorage.setItem('rise_stale_reload', payload);
                } catch (e) { /* private mode — reload anyway */ }
                console.warn('[Router] Stale build detected; reloading to recover.');
                window.location.reload();
                return false;
            }

            newView.instance?.deactivate?.();
            if (newView.container !== previousView?.container) newView.container.hidden = true;
            // A Home still held was never taken down, so it is not brought back.
            if (previousView?.container && !homeHeld) {
                previousView.container.hidden = false;
                await this.fadeIn(previousView.container).catch(() => {});
                previousView.instance?.activate?.();
            }
            this.currentView = previousViewName;
            // The move failed: the address goes back to where the reader is.
            if (previousViewName) {
                this.writeAddress(previousViewName, { data: previousData, replaceUrl: true });
            }
        } finally {
            this.transitioning = false;
        }

        const pending = this._pendingNav;
        this._pendingNav = null;
        if (pending) {
            // A queued move to the room already showing is a no-op inside
            // navigate(), unless it names another pane of that room.
            const pendingSucceeded = await this.navigate(pending.viewName, pending.options, pending.revision);
            pending.resolve(pendingSucceeded === true);
        }
        return succeeded;
    }

    /**
     * Give the active view its address. Nothing is written when the id has
     * none, or when the address bar already names this room, so a cold load
     * on a public path and a Back that landed here leave history alone.
     * `keepUrl` is for a navigation that follows the address bar (a cold load,
     * Back): the bar is already the truth, and a slower navigation settling
     * late must not write an older address over a newer one.
     * `replaceUrl` overrides `replace` for the address alone, since `replace`
     * also keeps the view out of the back stack.
     */
    writeAddress(id, options) {
        if (options.keepUrl === true) return;
        const here = this.location;
        // A hash is a door the router does not own (`#rosary`); rewriting the
        // path would drop it.
        if (here?.hash) return;
        const target = pathForRoute(id, options.data);
        if (!target || !this.history || !here) return;
        if (target === here.pathname + here.search) return;
        if (addressIsOwnTo(id, here.pathname)) return;
        // The state is for the next reader of history, not a copy of the
        // room: data too large to be an address (a session) is left out.
        // Browsers cap serialized history state (640 KB in Firefox, less
        // elsewhere); 4000 characters stays far under any of them.
        // A reading's session is never written, whatever its size.
        let data = options.data?.session ? { pane: options.data.pane } : {};
        try {
            const text = options.data?.session ? '' : JSON.stringify(options.data ?? {});
            if (text && text.length <= 4000) data = JSON.parse(text);
        } catch { /* unserializable data stays out of history */ }
        try {
            this.history[(options.replaceUrl ?? options.replace) ? 'replaceState' : 'pushState']({ id, data }, '', target);
        } catch (error) {
            console.warn('[Router] Could not write the address:', error);
        }
    }

    /**
     * The active view's data changed in a way that is part of its address
     * (a Chapel chapter): rewrite the address in place, adding no entry.
     */
    updateAddress(data) {
        if (!this.currentView) return;
        this.currentData = data;
        this.writeAddress(this.currentView, { data, replaceUrl: true });
    }

    /**
     * Go back to the previous view, with the data it had. The address is
     * rewritten rather than pushed, and history.back() is not called: it
     * would re-enter popstate and handle the same move twice.
     */
    async back() {
        const entry = this.viewStack.pop();
        if (!entry) {
            // If no stack, go Home
            await this.navigate('home', { replace: true });
            return;
        }
        await this.navigate(entry.viewName, { data: entry.data, replace: true });
    }

    /**
     * Clear stack and go to view
     */
    async reset(viewName = 'home') {
        this.viewStack = [];
        await this.navigate(viewName, { replace: true });
    }

    /**
     * Fade out element
     */
    fadeOut(element) {
        return new Promise(resolve => {
            element.style.transition = `opacity ${this.transitionDuration}ms var(--ease-in, ease-in)`;
            element.style.opacity = '0';
            setTimeout(resolve, this.transitionDuration);
        });
    }

    /**
     * Fade in element
     */
    fadeIn(element) {
        return new Promise(resolve => {
            element.style.opacity = '0';
            element.style.transition = `opacity ${this.transitionDuration}ms var(--ease-out, ease-out)`;
            // Force reflow
            element.offsetHeight;
            element.style.opacity = '1';
            setTimeout(resolve, this.transitionDuration);
        });
    }

    /**
     * Handle keyboard events
     */
    handleKeydown(e) {
        if (e.key !== 'Escape' || (this.currentView === 'home' && !this.transitioning)) return;
        // A dialog that answered the press (a sheet closing on Escape) owns it: closing it must not also
        // abandon a reading still fading in, or leave the room.
        if (e.defaultPrevented) return;

        // Mid-transition Escape has no rightful owner: the incoming
        // view's instance isn't mounted yet, so falling through would
        // reset to the portal while a just-started session keeps its
        // audio running underneath. Swallow the press — the settled
        // view owns the next one. (Caught by the E2E smoke harness.)
        if (this.transitioning) {
            e.preventDefault();
            ++this.navigationRevision;
            this.onNavigationIntent('escape', {});
            return;
        }

        // Views may own Escape (session exit confirmation, open config
        // modals). If the active view's handleEscape() returns true, it
        // consumed the key and the router stays out of it. This is what
        // routes a mid-session Escape through the Chamber's exit flow —
        // player stop, cortex disable, audio stopSession() and the lobby
        // drone resume all live on that path.
        const instance = this.views.get(this.currentView)?.instance;
        if (instance?.handleEscape && instance.handleEscape()) {
            e.preventDefault();
            return;
        }

        e.preventDefault();
        this.reset('home');
    }

    /**
     * Get current view name
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Get the instance of a view (if initialized)
     * @param {string} viewName - View identifier
     * @returns {object|null} - The view instance or null
     */
    getViewInstance(viewName) {
        const view = this.views.get(viewName);
        return view?.instance || null;
    }

    /**
     * Cleanup
     */
    destroy() {
        document.removeEventListener('keydown', this.handleKeydown);
        this._pendingNav?.resolve(false);
        this._pendingNav = null;

        // Destroy all view instances
        for (const [name, view] of this.views) {
            if (view.instance?.destroy) {
                view.instance.destroy();
            }
        }

        this.views.clear();
        this.viewStack = [];
    }
}

export default Router;
