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
        if (this.transitioning) return;
        if (viewName === this.currentView) return;

        const newView = this.views.get(viewName);
        if (!newView) {
            console.error(`Router: View "${viewName}" not found`);
            return;
        }

        this.transitioning = true;

        // Handle view stack
        if (!options.replace && !options.skipStack && this.currentView) {
            this.viewStack.push(this.currentView);
        }

        // Fade out current view
        if (this.currentView) {
            const currentViewData = this.views.get(this.currentView);
            if (currentViewData?.container) {
                await this.fadeOut(currentViewData.container);
                currentViewData.container.hidden = true;
                
                // Do NOT destroy previous instance immediately. Keep it in memory.
                // We only destroy views intentionally during a hard reset or cleanup.
            }
        }

        // Destroy only views that share the EXACT SAME container to prevent overlapping DOM
        // (This applies to Chamberlain and other shared #view-chamber views)
        for (const [viewKey, viewData] of this.views.entries()) {
            if (viewKey !== viewName && viewData.container === newView.container && viewData.instance) {
                if (viewData.instance.destroy) {
                    viewData.instance.destroy();
                }
                viewData.instance = null;
            }
        }

        // Initialize new view OR update existing
        if (!newView.instance) {
            // First time initialization
            if (newView.init) {
                newView.instance = await newView.init(newView.container, options.data);
            } else if (newView.component) {
                newView.instance = new newView.component(newView.container, options.data);
            }
        } else {
            // Hot update of an existing, preserved instance
            if (newView.instance.update) {
                newView.instance.update(options.data);
            }
        }

        // Fade in new view
        newView.container.hidden = false;
        await this.fadeIn(newView.container);

        this.currentView = viewName;
        this.transitioning = false;

        // Notify listeners
        this.onViewChange(viewName, options.data);
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
