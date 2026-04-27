
import { test, expect } from '@playwright/test';

test('Validate ExecutionOrder Component', async ({ page }) => {
    // 1. Navigate to the app
    console.log('Navigating to app...');
    await page.goto('http://localhost:3000');

    // 2. Wait for the Orchestrator tab/view to be visible
    // Assuming there's a way to switch views or it's the default. 
    // Based on MainLayout code, we might need to click a button to switch perspectives if it's not default.
    // Checking for "Orchestrator" text or title.
    console.log('Checking for Orchestrator title...');
    await expect(page.getByText('Orquestador de Pruebas')).toBeVisible({ timeout: 10000 });

    // 3. Verify Module List
    console.log('Verifying Module List...');
    const moduleList = page.locator('.dnd-sortable-module-item'); // This class might need adjustment based on code
    // Or look for known module names if any default ones exist, or the "No hay módulos" message.

    const noModulesParams = await page.getByText('No hay módulos en el plan de ejecución').isVisible();
    if (noModulesParams) {
        console.log('State: No modules present (Empty state verified)');
    } else {
        console.log('State: Modules are present');
        // Verify collapse/expand
        const toggleButton = page.locator('button[aria-label="Ocultar contenido"]').first();
        if (await toggleButton.isVisible()) {
            await toggleButton.click();
            console.log('Action: Toggled module collapse');
        }
    }

    // 4. Verify Add Module Button
    console.log('Verifying Add Module Button...');
    const addButton = page.getByRole('button', { name: 'Agregar Módulo' });
    await expect(addButton).toBeVisible();
    await addButton.click();
    console.log('Action: Clicked Add Module');

    // 5. Check Dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Agregar Módulos al Plan de Ejecución')).toBeVisible();
    console.log('State: Dialog opened successfully');

    // Close dialog
    await page.getByRole('button', { name: 'Cancelar' }).click();

    console.log('Validation Complete: ExecutionOrder renders and interactions work.');
});
