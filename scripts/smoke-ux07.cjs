const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const http = require('node:http')

const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ||
  '/Users/jportugal/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Users/jportugal/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const { chromium } = require(playwrightPath)

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for dev server at ${url}`))
        } else {
          setTimeout(check, 300)
        }
      })
    }
    check()
  })
}

async function runSmoke() {
  const port = 5173
  const baseUrl = `http://localhost:${port}`
  let viteProcess = null

  // Check if server is already running, else spawn it
  let serverRunning = false
  try {
    await waitForServer(baseUrl, 1000)
    serverRunning = true
    console.log(`Dev server is already running on ${baseUrl}`)
  } catch {
    console.log(`Starting Vite dev server on ${baseUrl}...`)
    viteProcess = spawn('npx', ['vite', '--port', String(port)], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      detached: false,
    })
    await waitForServer(baseUrl, 20000)
    console.log(`Vite dev server is ready at ${baseUrl}`)
  }

  let browser = null
  try {
    console.log('Launching Playwright Chromium...')
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumPath,
    })

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      timezoneId: 'America/Argentina/Mendoza',
    })
    const page = await context.newPage()

    page.on('pageerror', (err) => console.error('Page error:', err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('Console error:', msg.text())
    })

    console.log(`Navigating to ${baseUrl}...`)
    await page.goto(baseUrl)

    // Create tournament
    const tournamentName = `Torneo UX-07 Smoke ${Date.now()}`
    await page.getByPlaceholder('Nombre del torneo').fill(tournamentName)
    await page.locator('input[type=date]').fill('2026-10-12')
    await page.getByRole('button', { name: 'Nuevo torneo', exact: true }).click()

    await page.waitForURL(/\/tournaments\/[^/]+\/groups/)
    console.log(`Tournament created successfully. URL: ${page.url()}`)

    const categoryNames = [
      'Primera',
      'Segunda',
      'Tercera',
      'Cuarta',
      'Quinta',
      'Sexta',
    ]

    for (const name of categoryNames) {
      await page.getByPlaceholder('Nombre de categoría (ej: Núcleo)').fill(name)
      await page.getByRole('button', { name: 'Agregar categoría' }).click()
      await page.waitForTimeout(100)
    }

    console.log('Added 6 categories. Inspecting rendered cards...')

    for (const name of categoryNames) {
      const heading = page.getByRole('heading', { level: 3, name })
      await heading.waitFor({ state: 'visible', timeout: 5000 })
    }

    // Wait for autosave debounce (800ms) to flush to IndexedDB
    await page.waitForTimeout(1500)

    // Read colors directly from DOM swatches
    const domColors = await page.evaluate(() => {
      const swatches = Array.from(document.querySelectorAll('span[aria-hidden]'))
        .filter((el) => el.style && el.style.background)
        .map((el) => el.style.background)
      return swatches
    })
    console.log('DOM swatches background colors:', domColors)

    // Read colors from IndexedDB / stored tournament
    const tournamentData = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store')
        open.onsuccess = () => {
          const db = open.result
          const currentId = window.location.pathname.split('/')[2]
          const req = db
            .transaction('keyval', 'readonly')
            .objectStore('keyval')
            .get(`tournament:v2:${currentId}`)
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        }
        open.onerror = () => reject(open.error)
      })
    })

    const categoryColors = (tournamentData?.categories || []).map((c) => c.color)
    console.log('Categories created with colors in storage:', categoryColors)

    // Assert all 6 colors are unique
    const uniqueColors = new Set(categoryColors)
    assert.equal(
      uniqueColors.size,
      6,
      `Expected 6 unique colors, but got ${uniqueColors.size}: ${categoryColors.join(', ')}`,
    )

    // Expected palette
    const expectedPalette = [
      '#d3ede8', // Teal
      '#fce4ca', // Amber
      '#e5defa', // Violet
      '#dce9fc', // Sky
      '#fcdfe5', // Rose
      '#d4f2db', // Emerald
    ]

    for (let i = 0; i < expectedPalette.length; i++) {
      assert.equal(
        categoryColors[i],
        expectedPalette[i],
        `Category ${i} (${categoryNames[i]}) expected color ${expectedPalette[i]}, got ${categoryColors[i]}`,
      )
    }

    // Capture screenshot
    fs.mkdirSync(path.resolve(__dirname, '../tmp'), { recursive: true })
    const screenshotPath = path.resolve(__dirname, '../tmp/smoke-categories-ux07.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`Screenshot saved to ${screenshotPath}`)

    console.log('✅ Playwright smoke test passed successfully!')
  } finally {
    if (browser) {
      await browser.close()
    }
    if (viteProcess) {
      viteProcess.kill('SIGTERM')
    }
  }
}

runSmoke().catch((err) => {
  console.error('❌ Smoke test failed:', err)
  process.exit(1)
})
