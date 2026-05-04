// fake-indexeddb/auto installs a spec-compliant in-memory IDB implementation
// onto the global object so jsdom-backed tests can exercise lib/offline-queue
// (enqueue/flush/length) without a real browser.
import 'fake-indexeddb/auto'
