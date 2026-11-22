// Loot logs the admin has loaded in this browser tab. Kept outside any page so they stay loaded
// when switching between the Loot Logger and the Kill log (nothing is uploaded or saved).
import { useSyncExternalStore } from 'react'

let files = []
const listeners = new Set()

export function getLootFiles() { return files }

export function setLootFiles(next) {
  files = typeof next === 'function' ? next(files) : next
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLootFiles() {
  return [useSyncExternalStore(subscribe, getLootFiles, getLootFiles), setLootFiles]
}
