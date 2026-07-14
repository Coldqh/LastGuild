export interface AppPreferences {
  competitorsEnabled: boolean
  tutorialEnabled: boolean
  decisionCenterEnabled: boolean
  warsEnabled: boolean
  crisesEnabled: boolean
  economicDeclineEnabled: boolean
  borderChangesEnabled: boolean
  cityDestructionEnabled: boolean
  agingEnabled: boolean
  oldAgeDeathEnabled: boolean
  poachingEnabled: boolean
  devToolsEnabled: boolean
  compactCardsEnabled: boolean
  maxChronicleEntries: number
}

const PREFERENCES_KEY = 'last-guild-preferences-v2'
const LEGACY_PREFERENCES_KEY = 'last-guild-preferences-v1'

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  competitorsEnabled: true,
  tutorialEnabled: true,
  decisionCenterEnabled: true,
  warsEnabled: true,
  crisesEnabled: true,
  economicDeclineEnabled: true,
  borderChangesEnabled: true,
  cityDestructionEnabled: true,
  agingEnabled: true,
  oldAgeDeathEnabled: true,
  poachingEnabled: true,
  devToolsEnabled: false,
  compactCardsEnabled: false,
  maxChronicleEntries: 1200,
}

export function loadPreferences(): AppPreferences {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_APP_PREFERENCES }
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY) ?? localStorage.getItem(LEGACY_PREFERENCES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const merged = { ...DEFAULT_APP_PREFERENCES, ...parsed }
    merged.maxChronicleEntries = Math.max(300, Math.min(3000, Number(merged.maxChronicleEntries) || 1200))
    return merged
  } catch {
    return { ...DEFAULT_APP_PREFERENCES }
  }
}

export function savePreferences(preferences: AppPreferences): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
}
