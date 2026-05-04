#!/usr/bin/env node
/**
 * Static PWA manifest + iOS meta auditor.
 *
 * Run: npm run pwa:check
 *
 * What it checks (exits non-zero if any required check fails):
 *  - public/manifest.json parses, has name/short_name/start_url/display/theme_color/background_color
 *  - icons[] has at least one purpose:any 192 + 512 PNG, AND at least one purpose:maskable 192 + 512 PNG
 *  - referenced icon files exist on disk
 *  - app/layout.tsx declares appleWebApp.capable=true, statusBarStyle, title
 *  - app/layout.tsx declares startupImage entries pointing at files that exist
 *  - viewport.width=device-width, viewportFit=cover (recommended for iOS notches)
 *
 * This is the "static" half of docs/pwa-ios-validation.md. The manual half
 * (Add-to-Home-Screen on a real device, splash render check, offline queue
 * replay) lives in that doc as a checklist for whoever has the hardware.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = dirname(__dirname)

const errors = []
const warnings = []
const passed = []

function fail(msg) {
  errors.push(msg)
  console.error(`  ✗ ${msg}`)
}
function warn(msg) {
  warnings.push(msg)
  console.warn(`  ! ${msg}`)
}
function ok(msg) {
  passed.push(msg)
  console.log(`  ✓ ${msg}`)
}

// ── manifest.json ────────────────────────────────────────────────────────────
console.log('\n[manifest.json]')
let manifest
try {
  manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8'))
} catch (err) {
  fail(`failed to parse public/manifest.json: ${err.message}`)
  process.exit(1)
}

for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color']) {
  if (!manifest[k]) fail(`manifest.${k} missing`)
  else ok(`manifest.${k} = ${JSON.stringify(manifest[k])}`)
}
if (manifest.display !== 'standalone' && manifest.display !== 'fullscreen') {
  warn(`manifest.display = "${manifest.display}" — Lighthouse PWA prefers "standalone" or "fullscreen"`)
}

const icons = manifest.icons ?? []
const has = (size, purpose) =>
  icons.some(
    (i) =>
      i.sizes === size &&
      (i.purpose ?? 'any').split(/\s+/).includes(purpose) &&
      (i.type ?? '').includes('png')
  )
if (!has('192x192', 'any')) fail('no purpose:any 192x192 PNG icon')
else ok('purpose:any 192x192 present')
if (!has('512x512', 'any')) fail('no purpose:any 512x512 PNG icon')
else ok('purpose:any 512x512 present')
if (!has('192x192', 'maskable')) fail('no purpose:maskable 192x192 PNG icon (Android adaptive)')
else ok('purpose:maskable 192x192 present')
if (!has('512x512', 'maskable')) fail('no purpose:maskable 512x512 PNG icon')
else ok('purpose:maskable 512x512 present')

for (const icon of icons) {
  const p = join(root, 'public', icon.src.replace(/^\//, ''))
  if (!existsSync(p)) fail(`icon file missing on disk: ${icon.src}`)
  else ok(`icon file ${icon.src} exists (${icon.sizes}, ${icon.purpose ?? 'any'})`)
}

// ── app/layout.tsx (iOS meta) ────────────────────────────────────────────────
console.log('\n[app/layout.tsx — iOS Add-to-Home-Screen meta]')
let layout
try {
  layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8')
} catch (err) {
  fail(`failed to read app/layout.tsx: ${err.message}`)
  process.exit(1)
}

if (/capable:\s*true/.test(layout)) ok('appleWebApp.capable = true')
else fail('appleWebApp.capable not set to true (required for full-screen iOS launch)')

const statusMatch = layout.match(/statusBarStyle:\s*"([^"]+)"/)
if (statusMatch) ok(`appleWebApp.statusBarStyle = "${statusMatch[1]}"`)
else fail('appleWebApp.statusBarStyle missing')

const titleMatch = layout.match(/appleWebApp:[\s\S]*?title:\s*"([^"]+)"/)
if (titleMatch) ok(`appleWebApp.title = "${titleMatch[1]}"`)
else fail('appleWebApp.title missing (sets the home-screen label)')

if (/width:\s*"device-width"/.test(layout)) ok('viewport.width = device-width')
else fail('viewport.width != device-width — iOS will scale content awkwardly')

if (/viewportFit:\s*"cover"/.test(layout))
  ok('viewport.viewportFit = cover (renders into safe-area insets on notched iPhones)')
else warn('viewport.viewportFit != cover — content may be letterboxed by safe-area insets')

const splashMatches = [...layout.matchAll(/url:\s*"(\/icons\/apple-splash-[^"]+)"/g)]
if (splashMatches.length === 0) fail('no apple-touch-startup-image entries declared')
else ok(`${splashMatches.length} startupImage entries declared`)

for (const m of splashMatches) {
  const p = join(root, 'public', m[1].replace(/^\//, ''))
  if (!existsSync(p)) fail(`splash image missing on disk: ${m[1]}`)
  else ok(`splash image ${m[1]} exists`)
}

// ── public/sw.js ─────────────────────────────────────────────────────────────
console.log('\n[public/sw.js]')
let sw
try {
  sw = readFileSync(join(root, 'public/sw.js'), 'utf8')
} catch (err) {
  fail(`failed to read public/sw.js: ${err.message}`)
  process.exit(1)
}
if (/addEventListener\(['"]install['"]/.test(sw)) ok('install handler present')
else fail('install handler missing')
if (/addEventListener\(['"]fetch['"]/.test(sw)) ok('fetch handler present')
else fail('fetch handler missing')
if (/\/offline\.html/.test(sw)) ok('navigation fallback to /offline.html present')
else warn('no /offline.html fallback in sw.js')

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n[summary] ${passed.length} passed, ${warnings.length} warnings, ${errors.length} errors`)
if (errors.length > 0) process.exit(1)
process.exit(0)
