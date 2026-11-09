import { expect, test } from '@playwright/test'

import { devUser } from './helpers/credentials.js'

test.use({ viewport: { height: 900, width: 1440 } })

test('select and move a section from the live preview', async ({ page }) => {
  await page.goto('/admin')
  await page.fill('#field-email', devUser.email)
  await page.fill('#field-password', devUser.password)
  await page.click('.form-submit button')
  await expect(page).toHaveTitle(/Dashboard/)

  await page.goto('/admin/collections/pages')
  await page.getByRole('link', { name: 'Home' }).first().click()
  await page.getByRole('button', { name: 'Live Preview' }).click()

  const preview = page.frameLocator('iframe.iframe-loader__iframe')
  const firstText = preview.locator('[data-section-index="1"]')
  await expect(firstText).toBeAttached()

  // Wait for the handshake, then select the second section.
  await expect(preview.locator('html[data-section-builder="on"]')).toHaveCount(1)
  await firstText.click()

  // The sidebar shows only the selected block expanded.
  await expect(page.locator('#layout-row-1 input').first()).toBeVisible()

  // Move it down via the overlay toolbar and check the order in the preview.
  await preview.getByRole('button', { name: /move down/i }).click()
  await expect(preview.locator('[data-section-index="2"] h2')).toHaveText('How it works')
})
