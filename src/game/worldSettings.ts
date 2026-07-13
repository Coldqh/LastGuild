import type { DifficultyId, WorldGenerationSettings, WorldPresetId } from '../types/game'

export const DEFAULT_WORLD_SETTINGS: WorldGenerationSettings = {
  preset: 'classic',
  mapSize: 'regional',
  realmCount: 4,
  settlementDensity: 'normal',
  ruinDensity: 'normal',
  monsterDensity: 'normal',
  historyDepth: 'old',
  conflictLevel: 'turbulent',
  magicLevel: 'common',
  climate: 'varied',
  difficulty: 'standard',
  startingKnowledge: 2,
  worldChangeSpeed: 'normal',
  warFrequency: 'normal',
  economyVolatility: 'normal',
  cityGrowth: 'normal',
  catastropheFrequency: 'normal',
  discoveryImpact: 'normal',
}

export const WORLD_PRESETS: Record<Exclude<WorldPresetId, 'custom'>, WorldGenerationSettings> = {
  classic: { ...DEFAULT_WORLD_SETTINGS },
  fallen_empires: {
    preset: 'fallen_empires',
    mapSize: 'regional',
    realmCount: 4,
    settlementDensity: 'sparse',
    ruinDensity: 'dense',
    monsterDensity: 'normal',
    historyDepth: 'ancient',
    conflictLevel: 'turbulent',
    magicLevel: 'common',
    climate: 'varied',
    difficulty: 'hard',
    startingKnowledge: 2,
    worldChangeSpeed: 'slow',
    warFrequency: 'rare',
    economyVolatility: 'harsh',
    cityGrowth: 'slow',
    catastropheFrequency: 'frequent',
    discoveryImpact: 'dramatic',
  },
  wild_frontier: {
    preset: 'wild_frontier',
    mapSize: 'vast',
    realmCount: 3,
    settlementDensity: 'sparse',
    ruinDensity: 'normal',
    monsterDensity: 'dense',
    historyDepth: 'young',
    conflictLevel: 'calm',
    magicLevel: 'wild',
    climate: 'harsh',
    difficulty: 'hard',
    startingKnowledge: 1,
    worldChangeSpeed: 'fast',
    warFrequency: 'rare',
    economyVolatility: 'harsh',
    cityGrowth: 'fast',
    catastropheFrequency: 'frequent',
    discoveryImpact: 'dramatic',
  },
  age_of_war: {
    preset: 'age_of_war',
    mapSize: 'regional',
    realmCount: 6,
    settlementDensity: 'dense',
    ruinDensity: 'dense',
    monsterDensity: 'normal',
    historyDepth: 'old',
    conflictLevel: 'war_torn',
    magicLevel: 'common',
    climate: 'varied',
    difficulty: 'brutal',
    startingKnowledge: 2,
    worldChangeSpeed: 'fast',
    warFrequency: 'frequent',
    economyVolatility: 'harsh',
    cityGrowth: 'normal',
    catastropheFrequency: 'frequent',
    discoveryImpact: 'dramatic',
  },
}

export const DIFFICULTY_RULES: Record<DifficultyId, {
  eventRate: number
  damage: number
  death: number
  expenses: number
  rewards: number
  startingTreasury: number
  startingDebt: number
  label: string
}> = {
  story: { eventRate: 0.76, damage: 0.72, death: 0.45, expenses: 0.8, rewards: 1.2, startingTreasury: 1250, startingDebt: 1600, label: 'История' },
  standard: { eventRate: 1, damage: 1, death: 1, expenses: 1, rewards: 1, startingTreasury: 820, startingDebt: 2400, label: 'Стандарт' },
  hard: { eventRate: 1.18, damage: 1.2, death: 1.35, expenses: 1.12, rewards: 0.92, startingTreasury: 680, startingDebt: 3000, label: 'Тяжело' },
  brutal: { eventRate: 1.35, damage: 1.42, death: 1.8, expenses: 1.25, rewards: 0.84, startingTreasury: 520, startingDebt: 3800, label: 'Жестоко' },
}

export function applyPreset(preset: Exclude<WorldPresetId, 'custom'>): WorldGenerationSettings {
  return { ...WORLD_PRESETS[preset] }
}

export function markCustom(settings: WorldGenerationSettings, patch: Partial<WorldGenerationSettings>): WorldGenerationSettings {
  return { ...settings, ...patch, preset: 'custom' }
}

export function worldSize(settings: WorldGenerationSettings): { width: number; height: number } {
  if (settings.mapSize === 'compact') return { width: 30, height: 20 }
  if (settings.mapSize === 'vast') return { width: 52, height: 34 }
  return { width: 40, height: 26 }
}

export const densityMultiplier = (value: WorldGenerationSettings['settlementDensity']): number =>
  value === 'sparse' ? 0.7 : value === 'dense' ? 1.45 : 1

export const historyYears = (value: WorldGenerationSettings['historyDepth']): number =>
  value === 'young' ? 260 : value === 'ancient' ? 1450 : 720
