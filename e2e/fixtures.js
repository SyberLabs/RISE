import { expect, test as base } from '@playwright/test';

export const test = base.extend({
    page: async ({ page }, use) => {
        let handlingConsent = false;
        await page.route('**/api/jev-decision', async route => {
            const request = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    requestId: request.requestId,
                    action: 'continue',
                    model: 'openai/gpt-4.1-mini'
                })
            });
        });

        await page.addLocatorHandler(
            page.getByRole('dialog', { name: 'Start a guided reading' }),
            async dialog => {
                // The checkbox change re-evaluates the dialog locator. Keep
                // the handler single-entry while the consent form is closed.
                if (handlingConsent) return;
                handlingConsent = true;
                try {
                    await dialog.getByRole('checkbox').check();
                    await dialog.getByRole('button', { name: 'Continue with reading guide' }).click();
                } finally {
                    handlingConsent = false;
                }
            }
        );

        await use(page);
    }
});

export { expect };
