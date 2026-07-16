/**
 * R.I.S.E. — Application Router
 * View navigation with crossfade transitions
 *
 * Design principles (from UX spec):
 * - Transitions use crossfade (opacity), not slide
 * - Escape key returns to Portal from any view
 * - View stack enables contextual back navigation
 */

export class Router {
    constructor(options = {}) {
        this.views = new Map();
        this.viewStack = [];
        this.currentView = null;
        this.transitioning = false;

        // Transition timing from design system
        this.transitionDuration = 400; // ms

        // Callbacks
        this.onViewChange = options.onViewChange || (() => { });

        // Bind keyboard handler
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
    async navigate(viewName, options = {}) {
        console.log(`[Router] Navigate to: ${viewName}, from: ${this.currentView}`, options);
        if (this.transitioning) {
            // Don't silently eat clicks that land mid-transition — remember
            // the latest request and honor it once the crossfade completes.
            this._pendingNav = { viewName, options };
            return;
        }
        if (viewName === this.currentView) return;

        const newView = this.views.get(viewName);
        if (!newView) {
            console.error(`Router: View "${viewName}" not found`);
            return;
        }

        this.transitioning = true;
        const previousViewName = this.currentView;
        const previousView = previousViewName ? this.views.get(previousViewName) : null;
        let succeeded = false;

        try {
            previousView?.instance?.deactivate?.();
            if (previousView?.container) {
                await this.fadeOut(previousView.container);
                previousView.container.hidden = true;
            }

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

            newView.container.hidden = false;
            await this.fadeIn(newView.container);
            newView.instance?.activate?.();

            if (!options.replace && !options.skipStack && previousViewName) {
                this.viewStack.push(previousViewName);
            }
            this.currentView = viewName;
            succeeded = true;
            this.onViewChange(viewName, options.data);
        } catch (error) {
            console.error(`[Router] Navigation to "${viewName}" failed:`, error);
            newView.instance?.deactivate?.();
            if (newView.container !== previousView?.container) newView.container.hidden = true;
            if (previousView?.container) {
                previousView.container.hidden = false;
                await this.fadeIn(previousView.container).catch(() => {});
                previousView.instance?.activate?.();
            }
            this.currentView = previousViewName;
        } finally {
            this.transitioning = false;
        }

        const pending = this._pendingNav;
        this._pendingNav = null;
        if (pending && pending.viewName !== this.currentView) {
            return this.navigate(pending.viewName, pending.options);
        }
        return succeeded;
    }

    /**
     * Go back to previous view
     */
    async back() {
        if (this.viewStack.length === 0) {
            // If no stack, go to Portal
            await this.navigate('portal', { skipStack: true });
            return;
        }

        const previousView = this.viewStack.pop();
        await this.navigate(previousView, { skipStack: true });
    }

    /**
     * Clear stack and go to view
     */
    async reset(viewName = 'portal') {
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
        if (e.key !== 'Escape' || this.currentView === 'portal') return;

        // Mid-transition Escape has no rightful owner: the incoming
        // view's instance isn't mounted yet, so falling through would
        // reset to the portal while a just-started session keeps its
        // audio running underneath. Swallow the press — the settled
        // view owns the next one. (Caught by the E2E smoke harness.)
        if (this.transitioning) {
            e.preventDefault();
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
        this.reset('portal');
    }

    /**
     * Get current view name
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Check if can go back
     */
    canGoBack() {
        return this.viewStack.length > 0;
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
