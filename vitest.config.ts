import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // jsdom gives us window, localStorage, MessageEvent, etc. for the
    // offline-queue / SoundManager / OfflineQueueFlusher tests. Pure-logic
    // lib tests don't touch the DOM globals so the upgrade is transparent.
    environment: 'jsdom',
    globals: true,
    // fake-indexeddb/auto patches global indexedDB onto the test runtime so
    // lib/offline-queue.ts works under vitest exactly like in a real browser.
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
