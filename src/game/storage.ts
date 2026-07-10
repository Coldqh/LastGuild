import type { GameState } from '../types/game'

const SAVE_KEY = 'last-guild-save-v2'

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GameState
    if (parsed.version !== 2) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
