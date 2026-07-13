import type { GameState, WorldCrisis, WorldWar } from '../types/game'
import { advanceDays } from './simulation'

export interface SimulationAuditResult {
  years: number
  elapsedMs: number
  startYear: number
  endYear: number
  populationChange: number
  ruinedSettlements: number
  activeWars: number
  collapsedCrises: number
  abandonedRoutes: number
  chronicleEntries: number
  warnings: string[]
}

function preparedAuditState(state: GameState): GameState {
  const activeMemberIds = new Set(state.expeditions.filter((entry) => ['active', 'returning', 'missing'].includes(entry.status)).flatMap((entry) => entry.memberIds))
  return {
    ...structuredClone(state),
    pendingDecision: undefined,
    pendingDebrief: undefined,
    pendingCombat: undefined,
    pendingDungeon: undefined,
    expeditions: state.expeditions.map((entry) => ['active', 'returning', 'missing'].includes(entry.status) ? { ...entry, status: 'failed' as const } : entry),
    characters: state.characters.map((character) => activeMemberIds.has(character.id) && character.status === 'expedition' ? { ...character, status: 'available' as const } : character),
  }
}

export function runSimulationAudit(state: GameState, years: number): SimulationAuditResult {
  const safeYears = Math.max(1, Math.min(100, Math.round(years)))
  const startPopulation = state.world.settlements.reduce((sum, settlement) => sum + settlement.population, 0)
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const simulated = advanceDays(preparedAuditState(state), safeYears * 360)
  const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const endPopulation = simulated.world.settlements.reduce((sum, settlement) => sum + settlement.population, 0)
  const ruinedSettlements = simulated.world.settlements.filter((settlement) => settlement.status === 'ruined').length
  const activeWars = simulated.wars.filter((war) => war.status !== 'ended').length
  const collapsedCrises = simulated.crises.filter((crisis) => crisis.status === 'collapsed').length
  const abandonedRoutes = simulated.world.routes.filter((route) => route.status === 'abandoned').length
  const warnings: string[] = []
  const populationRatio = startPopulation > 0 ? endPopulation / startPopulation : 1
  if (populationRatio < 0.45) warnings.push('Население мира сократилось более чем вдвое.')
  if (populationRatio > 3.5) warnings.push('Население растёт слишком быстро.')
  if (ruinedSettlements > simulated.world.settlements.length * 0.35) warnings.push('Более трети поселений превратились в руины.')
  if (activeWars > Math.max(3, simulated.world.realms.length / 2)) warnings.push('Слишком много одновременных войн.')
  if (abandonedRoutes > simulated.world.routes.length * 0.5) warnings.push('Торговая сеть разрушена более чем наполовину.')
  if (simulated.chronicle.length >= 3000) warnings.push('Хроника достигла опасного размера.')
  if (!warnings.length) warnings.push('Критических перекосов за выбранный период не найдено.')
  return {
    years: safeYears,
    elapsedMs: Math.round(finishedAt - startedAt),
    startYear: state.year,
    endYear: simulated.year,
    populationChange: Math.round((populationRatio - 1) * 100),
    ruinedSettlements,
    activeWars,
    collapsedCrises,
    abandonedRoutes,
    chronicleEntries: simulated.chronicle.length,
    warnings,
  }
}

export function devAddResources(state: GameState): GameState {
  return { ...state, guild: { ...state.guild, treasury: state.guild.treasury + 5000, supplies: state.guild.supplies + 500 } }
}

export function devRevealMap(state: GameState): GameState {
  return { ...state, world: { ...state.world, tiles: state.world.tiles.map((tile) => ({ ...tile, knowledge: 5 as const })) } }
}

export function devHealRoster(state: GameState): GameState {
  return {
    ...state,
    characters: state.characters.map((character) => character.status === 'dead' || character.status === 'missing' ? character : {
      ...character,
      health: 100,
      fatigue: 0,
      stress: 0,
      status: character.status === 'recovering' ? 'available' as const : character.status,
      injuryRecords: character.injuryRecords.map((injury) => ({ ...injury, treated: true, recoveryDays: 0 })),
    }),
  }
}

export function devFinishExpeditions(state: GameState): GameState {
  const active = state.expeditions.filter((entry) => ['active', 'returning', 'missing'].includes(entry.status))
  const memberIds = new Set(active.flatMap((entry) => entry.memberIds))
  return {
    ...state,
    pendingDecision: undefined,
    pendingDebrief: undefined,
    pendingCombat: undefined,
    pendingDungeon: undefined,
    expeditions: state.expeditions.map((entry) => ['active', 'returning', 'missing'].includes(entry.status) ? { ...entry, status: 'failed' as const } : entry),
    characters: state.characters.map((character) => memberIds.has(character.id) && character.status === 'expedition' ? { ...character, status: 'available' as const } : character),
  }
}

export function devCreateCrisis(state: GameState): GameState {
  const realm = state.world.realms[0]
  const settlementIds = state.world.settlements.filter((entry) => entry.realmId === realm?.id).slice(0, 2).map((entry) => entry.id)
  if (!realm) return state
  const crisis: WorldCrisis = {
    id: `dev-crisis-${state.year}-${state.day}-${state.crises.length}`,
    kind: 'magical_storm',
    title: `Отладочная магическая буря: ${realm.name}`,
    description: 'Создано через панель разработчика для проверки событий и интерфейса.',
    realmIds: [realm.id], settlementIds, severity: 65, progress: 40, status: 'active',
    startedYear: state.year, startedDay: state.day, playerContribution: 0,
    effects: ['магические риски растут', 'дороги становятся нестабильными'],
  }
  return { ...state, crises: [...state.crises, crisis] }
}

export function devCreateWar(state: GameState): GameState {
  if (state.world.realms.length < 2) return state
  const [attacker, defender] = [...state.world.realms].sort((a, b) => a.id.localeCompare(b.id))
  const fronts = state.world.settlements.filter((entry) => entry.realmId === defender.id && entry.status !== 'ruined').slice(0, 2).map((entry) => entry.id)
  const war: WorldWar = {
    id: `dev-war-${state.year}-${state.day}-${state.wars.length}`,
    name: `Отладочная война: ${attacker.name} против ${defender.name}`,
    attackerRealmId: attacker.id, defenderRealmId: defender.id,
    cause: 'проверка военной симуляции', goal: 'проверить смену фронта и истощение', status: 'active',
    startedYear: state.year, startedDay: state.day, progress: 45,
    attackerExhaustion: 10, defenderExhaustion: 10, attackerSupply: 80, defenderSupply: 80,
    frontSettlementIds: fronts, capturedSettlementIds: [], casualties: 0,
  }
  return { ...state, wars: [...state.wars, war] }
}

export function downloadDebugLog(state: GameState, audit?: SimulationAuditResult): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    version: state.version,
    seed: state.seed,
    date: { year: state.year, day: state.day },
    counts: {
      characters: state.characters.length,
      expeditions: state.expeditions.length,
      chronicle: state.chronicle.length,
      settlements: state.world.settlements.length,
      routes: state.world.routes.length,
      wars: state.wars.length,
      crises: state.crises.length,
    },
    pending: {
      decision: Boolean(state.pendingDecision), debrief: Boolean(state.pendingDebrief), combat: Boolean(state.pendingCombat), dungeon: Boolean(state.pendingDungeon),
    },
    audit,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `last-guild-debug-${state.seed}-${state.year}-${state.day}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
