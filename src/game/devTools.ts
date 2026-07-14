import type { GameState, WorldCrisis, WorldWar } from '../types/game'
import { advanceDays } from './simulation'
import { simulateEcosystemYears } from './ecosystem'
import { simulateSocietyYears } from './society'
import { politicsMonthTick } from './politics'
import { DEFAULT_APP_PREFERENCES } from './preferences'

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
  faunaChange: number
  ecosystemHealth: number
  peoples: number
  cultures: number
  societyMigrations: number
  foundedSettlements: number
  abandonedSettlements: number
  livingRealms: number
  armies: number
  soldiers: number
  contestedTiles: number
  occupations: number
  realmCollapses: number
  largestRealmShare: number
  militaryPopulationShare: number
  longestWarYears: number
  historicalYears: number
  historicalEvents: number
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

function advanceWorldAudit(state: GameState, years: number): GameState {
  if (years <= 2) return advanceDays(preparedAuditState(state), years * 360)
  let next = preparedAuditState(state)
  const epochYears = years >= 100 ? 5 : years >= 30 ? 3 : 2
  const endYear = state.year + years
  for (let epochStart = state.year; epochStart < endYear; epochStart += epochYears) {
    const epochEndYear = Math.min(endYear, epochStart + epochYears)
    const environmentYear = epochEndYear - 1
    let world = simulateEcosystemYears(next.world, next.seed, next.settings, 1, environmentYear)
    world = simulateSocietyYears(world, next.seed, next.settings, 1, environmentYear)
    next = { ...next, world }
    // Politics still advances year by year: otherwise a five-year audit epoch can hide a decade-long war.
    for (let year = epochStart; year < epochEndYear; year += 1) {
      next = { ...next, year, day: 1 }
      for (const day of [90, 180, 270, 360]) next = politicsMonthTick({ ...next, day }, DEFAULT_APP_PREFERENCES)
    }
    next = { ...next, year: epochEndYear, day: 1 }
  }
  return next
}

export function runSimulationAudit(state: GameState, years: number): SimulationAuditResult {
  const safeYears = Math.max(1, Math.min(500, Math.round(years)))
  const startPopulation = state.world.settlements.reduce((sum, settlement) => sum + settlement.population, 0)
  const startFauna = state.world.ecologyPopulations.reduce((sum, population) => sum + population.amount, 0)
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const simulated = advanceWorldAudit(state, safeYears)
  const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const endPopulation = simulated.world.settlements.reduce((sum, settlement) => sum + settlement.population, 0)
  const endFauna = simulated.world.ecologyPopulations.reduce((sum, population) => sum + population.amount, 0)
  const landTiles = simulated.world.tiles.filter((tile) => tile.biome !== 'ocean')
  const ecosystemHealth = landTiles.length ? landTiles.reduce((sum, tile) => sum + tile.ecosystemHealth, 0) / landTiles.length : 0
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
  const faunaRatio = startFauna > 0 ? endFauna / startFauna : 1
  if (faunaRatio < 0.3) warnings.push('Фауна сократилась более чем на 70%.')
  if (faunaRatio > 4) warnings.push('Фауна растёт слишком быстро.')
  if (ecosystemHealth < 28) warnings.push('Среднее здоровье экосистемы критически низкое.')
  if (simulated.world.peoples.length === 0 || simulated.world.cultures.length === 0) warnings.push('Народы или культуры не были созданы.')
  if (simulated.world.society.abandonments > simulated.world.settlements.length * 0.55) warnings.push('Слишком много поселений было покинуто.')
  const livingRealms = simulated.world.realms.filter((realm) => !realm.collapsedYear).length
  const contestedTiles = simulated.world.tiles.filter((tile) => tile.controlStatus === 'contested' || tile.controlStatus === 'occupied').length
  const soldiers = simulated.world.armies.reduce((sum, army) => sum + army.soldiers, 0)
  const controlledLand = simulated.world.tiles.filter((tile) => tile.biome !== 'ocean' && tile.controllerRealmId)
  const realmTileCounts = controlledLand.reduce((map, tile) => { map.set(tile.controllerRealmId!, (map.get(tile.controllerRealmId!) ?? 0) + 1); return map }, new Map<string, number>())
  const largestRealmShare = controlledLand.length ? Math.max(0, ...realmTileCounts.values()) / controlledLand.length : 0
  const militaryPopulationShare = endPopulation > 0 ? soldiers / endPopulation : 0
  const longestWarYears = simulated.wars.reduce((longest, war) => {
    const endTick = (war.endedYear ?? simulated.year) * 360 + (war.endedDay ?? simulated.day)
    const startTick = war.startedYear * 360 + war.startedDay
    return Math.max(longest, (endTick - startTick) / 360)
  }, 0)
  if (livingRealms === 0) warnings.push('Все государства распались.')
  if (livingRealms > state.world.realms.filter((realm) => !realm.collapsedYear).length * 2.5) warnings.push('Число государств растёт слишком быстро.')
  if (contestedTiles > simulated.world.tiles.filter((tile) => tile.biome !== 'ocean').length * 0.42) warnings.push('Слишком большая часть мира постоянно спорная или оккупированная.')
  if (simulated.world.politics.realmCollapses > Math.max(8, simulated.world.realms.length * 1.5)) warnings.push('Государства распадаются слишком часто.')
  if (largestRealmShare > 0.72) warnings.push('Одна держава контролирует более 72% управляемой суши.')
  if (militaryPopulationShare > 0.16) warnings.push('Армии забирают слишком большую долю населения.')
  if (longestWarYears > 9) warnings.push('Одна из войн длится больше девяти лет.')
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
    faunaChange: Math.round((startFauna > 0 ? endFauna / startFauna - 1 : 0) * 100),
    ecosystemHealth: Math.round(ecosystemHealth),
    peoples: simulated.world.peoples.length,
    cultures: simulated.world.cultures.length,
    societyMigrations: simulated.world.society.migrations,
    foundedSettlements: simulated.world.society.foundations,
    abandonedSettlements: simulated.world.society.abandonments,
    livingRealms,
    armies: simulated.world.armies.filter((army) => army.status !== 'broken').length,
    soldiers,
    contestedTiles,
    occupations: simulated.world.politics.occupations,
    realmCollapses: simulated.world.politics.realmCollapses,
    largestRealmShare: Math.round(largestRealmShare * 100),
    militaryPopulationShare: Math.round(militaryPopulationShare * 1000) / 10,
    longestWarYears: Math.round(longestWarYears * 10) / 10,
    historicalYears: simulated.world.historicalSimulation?.yearsSimulated ?? 0,
    historicalEvents: simulated.world.history.length,
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
      peoples: state.world.peoples.length,
      cultures: state.world.cultures.length,
      communities: state.world.communities.length,
      fauna: Math.round(state.world.ecosystem.totalFauna),
      armies: state.world.armies.length,
      soldiers: state.world.armies.reduce((sum, army) => sum + army.soldiers, 0),
      contestedTiles: state.world.tiles.filter((tile) => tile.controlStatus === 'contested' || tile.controlStatus === 'occupied').length,
      realmCollapses: state.world.politics.realmCollapses,
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
