#!/usr/bin/env node
// Encode public/sounds/*.wav → public/sounds/*.mp3 (LAME via ffmpeg).
// The .wav assets are committed source-of-truth; .mp3 are reproducible build artifacts.
//
// Run: npm run sounds:build
// Requires ffmpeg on PATH (https://ffmpeg.org/). On Windows: `winget install ffmpeg`.

import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const soundsDir = join(__dirname, '..', 'public', 'sounds')

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('[build-sounds] ffmpeg not found on PATH. Install it before running this script.')
  process.exit(1)
}

const wavFiles = readdirSync(soundsDir).filter((f) => extname(f).toLowerCase() === '.wav')
if (wavFiles.length === 0) {
  console.error('[build-sounds] no .wav files in public/sounds/. Run scripts/generate-sounds.ps1 first.')
  process.exit(1)
}

for (const wav of wavFiles) {
  const src = join(soundsDir, wav)
  const dst = join(soundsDir, basename(wav, '.wav') + '.mp3')
  // -q:a 4 → VBR ~165 kbps, transparent for short SFX while keeping size small.
  // -ar 44100 -ac 1 → match source. -af loudnorm normalises to -14 LUFS.
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i', src,
      '-vn',
      '-ar', '44100',
      '-ac', '1',
      '-af', 'loudnorm=I=-14:LRA=7:TP=-1',
      '-codec:a', 'libmp3lame',
      '-q:a', '4',
      dst,
    ],
    { stdio: 'inherit' }
  )
  console.log(`[build-sounds] ${wav} → ${basename(dst)} (${statSync(dst).size} bytes)`)
}
