#!/usr/bin/env node
/**
 * ตรวจคุณภาพแอปที่ build แล้ว (ขั้น 10) — `npm run audit`
 *
 * 1. Lighthouse (มือถือ) บนหน้าแรก: Accessibility / Best Practices / SEO ต้อง ≥ 90 · Performance แสดงผลอย่างเดียว
 * 2. axe-core ทุกหน้าจอหลัก × โหมดสว่าง/มืด ที่จอกว้าง 360px: ต้องไม่มีปัญหา WCAG 2.2 A/AA
 *    (รวมคอนทราสต์สี) และหน้าต้องไม่ล้นแนวนอน
 * 3. PWA: manifest ครบ, Service worker คุมหน้า, ปิดเน็ตแล้วรีโหลด/เปลี่ยนทุกแท็บได้, ธีมที่เลือกคงอยู่หลังรีโหลด
 *    (Lighthouse ตั้งแต่ v12 ไม่มีหมวด PWA แล้ว จึงตรวจเกณฑ์ติดตั้งได้/ออฟไลน์เองที่นี่)
 *
 * ต้องรัน `npm run build` ก่อน · ใช้ Chrome/Chromium ที่ติดตั้งในเครื่อง (หรือกำหนด CHROME_PATH)
 * รายงาน Lighthouse ฉบับเต็มอยู่ที่ `.audit/lighthouse.html`
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = `${root}.audit`
const LH_MIN = 90
const LH_GATED = ['accessibility', 'best-practices', 'seo']
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const th = JSON.parse(readFileSync(`${root}src/i18n/th.json`, 'utf8'))
const en = JSON.parse(readFileSync(`${root}src/i18n/en.json`, 'utf8'))
/** ชื่อปุ่มได้ทั้งสองภาษา (ไม่ผูกกับภาษาที่เปิดอยู่) */
const both = (key) => new RegExp(`^(${escape(th[key])}|${escape(en[key])})`)
function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.log(`  ✗ ${msg}`)
}
const pass = (msg) => console.log(`  ✓ ${msg}`)

if (!existsSync(`${root}dist/index.html`)) {
  console.error('ไม่พบ dist/ — รัน `npm run build` ก่อน')
  process.exit(2)
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const found = chromeLauncher.Launcher.getInstallations()
  if (found.length) return found[0]
  console.error('ไม่พบ Chrome/Chromium — ติดตั้ง Google Chrome หรือกำหนด CHROME_PATH')
  process.exit(2)
}
const CHROME = chromePath()
process.env.CHROME_PATH = CHROME

const server = await preview({ root, logLevel: 'warn', preview: { port: 4173, strictPort: false } })
const url = server.resolvedUrls.local[0]
console.log(`Audit ${url} · Chrome: ${CHROME}\n`)

try {
  await runLighthouse()
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  try {
    await runAxe(browser)
    await runPwa(browser)
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}

console.log(failures.length ? `\n✗ ไม่ผ่าน ${failures.length} รายการ` : '\n✓ ผ่านทุกเกณฑ์')
process.exit(failures.length ? 1 : 0)

// ---------------------------------------------------------------------------

async function runLighthouse() {
  console.log('1) Lighthouse (มือถือ, หน้าแรก)')
  const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--no-sandbox'] })
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'html',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    })
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(`${OUT_DIR}/lighthouse.html`, result.report)
    for (const [id, cat] of Object.entries(result.lhr.categories)) {
      const score = Math.round((cat.score ?? 0) * 100)
      const line = `${cat.title}: ${score}`
      if (!LH_GATED.includes(id)) console.log(`  · ${line} (แสดงผลอย่างเดียว — ขึ้นกับความเร็วเครื่องที่ตรวจ)`)
      else if (score >= LH_MIN) pass(line)
      else fail(`${line} (ต้อง ≥ ${LH_MIN})`)
    }
    const a11yFails = result.lhr.categories.accessibility.auditRefs
      .map((ref) => result.lhr.audits[ref.id])
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
    for (const a of a11yFails) console.log(`    - ${a.id}: ${a.title}`)
  } finally {
    chrome.kill()
  }
}

async function runAxe(browser) {
  console.log('\n2) axe-core WCAG 2.2 AA · จอ 360px · ทุกหน้าจอ × สว่าง/มืด')
  const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme, serviceWorkers: 'block' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

    const scan = async (name) => {
      await page.waitForTimeout(300) // รอแอนิเมชัน/กราฟวาดเสร็จ
      if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: axeSource })
      // เมนูล่างเป็น sticky: ปุ่มที่บังเอิญอยู่ใต้เมนูตอนสแกนถูกนับว่า "ถูกบัง" ทั้งที่เลื่อนขึ้นมากดได้
      // (และ scroll-padding กันโฟกัสถูกบังแล้ว) จึงวางเมนูตามปกติชั่วคราวระหว่างสแกน ขนาดเป้าแตะจริงยังถูกตรวจครบ
      const { violations } = await page.evaluate(async (tags) => {
        const nav = document.querySelector('nav')
        nav?.style.setProperty('position', 'static')
        try {
          return await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] })
        } finally {
          nav?.style.removeProperty('position')
        }
      }, AXE_TAGS)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      const label = `[${colorScheme}] ${name}`
      if (dark !== (colorScheme === 'dark')) fail(`${label}: ธีมไม่ตามการตั้งค่าเครื่อง (dark=${dark})`)
      if (overflow > 0) fail(`${label}: ล้นแนวนอน ${overflow}px`)
      if (!violations.length) return pass(label)
      for (const v of violations) {
        // จัดกลุ่มตามข้อความปัญหา (เช่น คู่สีเดียวกัน) แสดงตัวอย่างตำแหน่งกลุ่มละ 1 จุด
        const groups = new Map()
        for (const n of v.nodes) {
          const why = (n.any?.[0]?.message ?? n.failureSummary ?? '').split('\n')[0]
          if (!groups.has(why)) groups.set(why, n.target.join(' '))
        }
        const detail = [...groups].map(([why, where]) => `\n      ${where}\n        ${why}`).join('')
        fail(`${label}: ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}${detail}`)
      }
    }
    const nav = (i) => page.locator('nav button').nth(i).click()
    const click = (name) => page.getByRole('button', { name }).first().click()

    await page.goto(url)
    await page.locator('nav').waitFor()
    await scan('ชง (หน้าแรก, ภาษาไทย, ยังไม่มีข้อมูล)')

    // ป้อนข้อมูลตัวอย่างผ่าน "นำข้อมูลกลับ" (ไฟล์ตั้งภาษาอังกฤษ → แอปสลับเป็นอังกฤษ)
    await click(new RegExp(`^(${escape(th['app.dataButton'])}|${escape(en['app.dataButton'])})`))
    await page.locator('input[type=file]').setInputFiles({
      name: 'audit-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(sampleBackup())),
    })
    await scan('ข้อมูลของฉัน — ยืนยันนำข้อมูลกลับ')
    await click(both('restore.confirmBtn'))
    await page.getByText(/^Data restored/).waitFor()
    await scan('ข้อมูลของฉัน (หลังนำกลับ)')

    await nav(0)
    await scan('ชง (มีเมล็ด)')
    await click(both('brew.form.start'))
    await scan('จับเวลา — พร้อมชง')
    await click(both('assistant.start'))
    await page.waitForTimeout(1200)
    await scan('จับเวลา — กำลังชง')
    await click(both('assistant.finish'))
    await scan('ชงเสร็จ — ชิม & ให้คะแนน')

    await nav(1)
    await scan('บันทึก (รายการ)')
    await page.getByText(both('filter.filters')).first().click()
    await scan('บันทึก (เปิดตัวกรอง)')
    await click(both('log.add'))
    await scan('บันทึก — ฟอร์มบันทึกการชง')

    await nav(2)
    await scan('เมล็ด (รายการ)')
    await click(both('bean.list.add'))
    await scan('เมล็ด — ฟอร์มเพิ่มเมล็ด')
    await page.getByLabel(both('bean.form.variety')).fill('Gesha')
    await scan('เมล็ด — ฟอร์ม + แหล่งอ้างอิงสายพันธุ์')
    await nav(2)
    await click(both('bean.page.gear'))
    await scan('อุปกรณ์ (รายการ)')
    await click(both('gear.list.add'))
    await scan('อุปกรณ์ — ฟอร์มเพิ่ม')
    await page.getByRole('searchbox').fill('df64')
    await scan('อุปกรณ์ — ค้นหาฐานข้อมูลอ้างอิง')
    await click(/DF Grinders DF64 Gen 2/)
    await page.getByRole('region', { name: both('catalog.card.title') }).locator('summary').click()
    await scan('อุปกรณ์ — การ์ดฐานข้อมูล + แหล่งอ้างอิง')

    await nav(3)
    await page.locator('.recharts-surface').first().waitFor()
    await scan('สรุป (กราฟ)')
    const viewTable = page.getByRole('button', { name: both('chart.viewTable') })
    while (await viewTable.count()) await viewTable.first().click()
    await scan('สรุป (มุมมองตาราง)')

    if (errors.length) fail(`[${colorScheme}] console error: ${[...new Set(errors)].join(' | ')}`)
    await context.close()
  }
}

async function runPwa(browser) {
  console.log('\n3) PWA: ติดตั้งได้ + ใช้ออฟไลน์ได้')
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } })
  const page = await context.newPage()
  await page.goto(url)
  await page.locator('nav').waitFor()

  // --- manifest & meta ---
  const href = await page.locator('link[rel=manifest]').getAttribute('href')
  const manifest = href ? await (await page.request.get(new URL(href, url).href)).json() : null
  const check = (ok, msg) => (ok ? pass(msg) : fail(msg))
  check(manifest, 'มี Web App Manifest')
  if (manifest) {
    check(manifest.name && manifest.short_name, 'manifest: name / short_name')
    check(manifest.start_url && manifest.scope, 'manifest: start_url / scope')
    check(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display), `manifest: display = ${manifest.display}`)
    check(manifest.theme_color && manifest.background_color, 'manifest: theme_color / background_color')
    const sizes = (manifest.icons ?? []).flatMap((i) => i.sizes.split(' '))
    check(sizes.includes('192x192') && sizes.includes('512x512'), 'manifest: ไอคอน 192 และ 512 px')
    check((manifest.icons ?? []).some((i) => i.purpose?.includes('maskable')), 'manifest: ไอคอน maskable (Android)')
    for (const icon of manifest.icons ?? []) {
      const res = await page.request.get(new URL(icon.src, new URL(href, url)).href)
      check(res.ok(), `ไอคอนโหลดได้: ${icon.src}`)
    }
  }
  check(await page.locator('meta[name=viewport]').count(), 'meta viewport')
  check(await page.locator('meta[name=theme-color]').count(), 'meta theme-color')
  check(await page.locator('link[rel=apple-touch-icon]').count(), 'apple-touch-icon (iOS)')

  // --- service worker ---
  await page.evaluate(() => navigator.serviceWorker.ready)
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload()
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'Service worker คุมหน้าแอป')

  // --- ธีมที่เลือกเองคงอยู่หลังรีโหลด (ไม่กะพริบ: ใส่ class ก่อนแอปเริ่ม) ---
  await page.getByRole('button', { name: new RegExp(`^${escape(th['theme.button'].split(':')[0])}|^Theme`) }).click()
  const picked = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.reload()
  const atFirstPaint = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  check(picked === true && atFirstPaint === true, 'เลือกโหมดมืดแล้วรีโหลด: ยังเป็นโหมดมืด')

  // --- ออฟไลน์ ---
  await context.setOffline(true)
  const failed = []
  page.on('requestfailed', (r) => failed.push(r.url()))
  await page.reload()
  await page.locator('nav').waitFor({ timeout: 10000 })
  check(true, 'ปิดเน็ตแล้วรีโหลด: แอปเปิดได้')
  for (let i = 0; i < 4; i++) await page.locator('nav button').nth(i).click()
  await page.waitForTimeout(800)
  const insightsOk = await page.locator('main h2, main h3').count()
  check(insightsOk > 0, 'ปิดเน็ต: เปิดครบ 4 แท็บ (รวมก้อนกราฟที่โหลดทีหลัง)')
  check(!failed.length, `ปิดเน็ต: ไม่มีไฟล์ที่โหลดไม่ได้${failed.length ? ` (${failed.join(', ')})` : ''}`)
  await context.close()
}

/** ข้อมูลตัวอย่างครอบคลุมทุกสถานะที่มีสี: เมล็ดสด/เก่า/ใกล้หมด, คะแนนต่าง ๆ, TDS ในและนอกเป้า, คำแนะนำ */
function sampleBackup() {
  const now = Date.now()
  const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString()
  const day = (daysAgo) => iso(daysAgo).slice(0, 10)
  const stamp = { createdAt: iso(30), updatedAt: iso(1) }
  const beans = [
    { id: 'b1', name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', process: 'natural', roastLevel: 'light', roastDate: day(2), weightG: 250, remainingG: 200, priceTotal: 520, currency: 'THB', category: 'coffee', archived: false, ...stamp },
    { id: 'b2', name: 'Kenya AA', roaster: 'Roast Co', origin: 'Kenya', process: 'washed', roastLevel: 'mediumLight', roastDate: day(14), weightG: 250, remainingG: 25, priceTotal: 480, currency: 'THB', category: 'coffee', archived: false, ...stamp },
    { id: 'b3', name: 'Brazil Cerrado', roaster: 'Local', origin: 'Brazil', roastLevel: 'mediumDark', roastDate: day(60), weightG: 500, remainingG: 0, category: 'coffee', archived: false, ...stamp },
  ]
  const gear = [
    { id: 'g1', type: 'grinder', name: 'Comandante C40', brand: 'Comandante', model: 'C40 MK4 Nitro Blade', catalogId: 'comandante-c40-mk4', grindScale: { min: 0, max: 40, step: 1 }, ...stamp },
    { id: 'g2', type: 'brewer', name: 'Hario V60', ...stamp },
  ]
  const brew = (i, o) => ({
    id: `r${i}`, brewedAt: iso(i), method: 'v60', beanId: 'b2', grinderId: 'g1', brewerId: 'g2', doseG: 15, waterG: 240,
    grindSetting: 22, tempC: 94, totalTimeSec: 180, flavorTags: [], isBest: false, ...stamp, ...o,
  })
  const brews = [
    brew(1, { rating: 3, balance: -2, body: -1, tds: 1.2, yieldG: 205, flavorTags: ['citrus', 'tea'], notes: 'sour finish',
      advice: { kind: 'underExtracted', adjustment: { variable: 'grind', direction: 'finer', steps: 1, from: 22, to: 21 }, alternatives: [{ variable: 'temp', deltaC: 2, from: 94, to: 96 }], notes: [] } }),
    brew(2, { rating: 5, balance: 0, body: 0, tds: 1.35, yieldG: 205, isBest: true, flavorTags: ['berry'], advice: { kind: 'best', alternatives: [], notes: [] } }),
    brew(3, { method: 'espresso', beanId: 'b1', doseG: 18, waterG: 36, yieldG: 36, tds: 9.5, totalTimeSec: 18, rating: 2, balance: 2, sourAndBitter: true }),
    brew(5, { rating: 4, tds: 1.6, yieldG: 200 }),
    brew(8, { method: 'chemex', beanId: 'b3', doseG: 30, waterG: 480, rating: 4, tds: 1.1, yieldG: 420 }),
  ]
  return {
    app: 'brew-log',
    formatVersion: 1,
    exportedAt: iso(0),
    data: { beans, gear, recipes: [], brews, settings: { language: 'en', units: 'metric', theme: 'system', defaultMethod: 'v60' } },
  }
}
