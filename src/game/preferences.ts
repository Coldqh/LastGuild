export interface AppPreferences {
  competitorsEnabled: boolean
  tutorialEnabled: boolean
  decisionCenterEnabled: boolean
}

const PREFERENCES_KEY = 'last-guild-preferences-v1'

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  competitorsEnabled: true,
  tutorialEnabled: true,
  decisionCenterEnabled: true,
}

export function loadPreferences(): AppPreferences {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_APP_PREFERENCES }
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    return raw ? { ...DEFAULT_APP_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_APP_PREFERENCES }
  } catch {
    return { ...DEFAULT_APP_PREFERENCES }
  }
}

export function savePreferences(preferences: AppPreferences): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
}
