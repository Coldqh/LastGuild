import type {
  DiscoveryRecord,
  GameState,
  HistoricalEvent,
  HistoricalMapSnapshot,
  KnowledgeSpread,
  KnowledgeSpreadStage,
  RouteStatus,
  Settlement,
  Site,
  WorldGenerationSettings,
  WorldRoute,
  WorldWar,
} from '../types/game'
import { coordinateNoise, RNG } from './rng'
import { loadPreferences, type AppPreferences } from './preferences'
import { ecosystemMonthTick } from './ecosystem'
import { societyYearTick } from './society'
import { createInitialPoliticalWars, politicsMonthTick } from './politics'

const STAGES: KnowledgeSpreadStage[] = ['found', 'verified', 'published', 'contested', 'spreading', 'used']
const GOODS = ['зерно', 'соль', 'железо', 'древесина', 'лекарства', 'ткань', 'книги', 'магические реагенты']
const CAUSES = ['спор о границе', 'контроль перевала', 'права на древний договор', 'борьба за серебряные шахты', 'религиозная претензия', 'защита торгового пути']
const GOALS = ['захватить пограничные крепости', 'вынудить соседа признать старые права', 'перерезать торговую сеть', 'овладеть священным местом', 'получить доступ к магическому ресурсу']

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const absoluteTick = (year: number, day: number) => year * 360 + day

function settingMultiplier(value: string, low: number, normal: number, high: number): number {
  if (['slow', 'rare', 'stable', 'limited'].includes(value)) return low
  if (['fast', 'frequent', 'harsh', 'dramatic'].includes(value)) return high
  return normal
}

function snapshotFromState(state: Pick<GameState, 'year' | 'world'>, title: string): HistoricalMapSnapshot {
  return {
    id: `snapshot-${state.year}-${title.replace(/\s+/g, '-').toLowerCase()}`,
    year: state.year,
    title,
    realmByTile: Object.fromEntries(state.world.tiles.map((tile) => [tile.id, tile.stateId])),
    settlementStates: Object.fromEntries(state.world.settlements.map((settlement) => [settlement.id, {
      realmId: settlement.realmId,
      population: settlement.population,
      prosperity: settlement.prosperity,
      status: settlement.status,
    }])),
    routeStates: Object.fromEntries(state.world.routes.map((route) => [route.id, route.status])),
    eventIds: state.world.history.filter((event) => event.year === state.year).map((event) => event.id),
  }
}

function historicalSnapshot(seed: string, year: number, world: GameState['world'], index: number): HistoricalMapSnapshot {
  const realmByTile: Record<string, string | undefined> = {}
  for (const tile of world.tiles) {
    if (!tile.stateId || tile.biome === 'ocean') { realmByTile[tile.id] = tile.stateId; continue }
    const noise = coordinateNoise(seed, tile.x, tile.y, `history-snapshot-${index}`)
    realmByTile[tile.id] = noise < 0.1 + index * 0.025 ? undefined : tile.stateId
  }
  const ageScale = Math.max(0.22, 1 - (912 - year) / 900)
  return {
    id: `snapshot-generated-${year}`,
    year,
    title: year < 600 ? 'Древняя эпоха' : year < 830 ? 'Эпоха старых королевств' : 'Преддверие современной карты',
    realmByTile,
    settlementStates: Object.fromEntries(world.settlements.map((settlement) => [settlement.id, {
      realmId: settlement.realmId,
      population: Math.max(80, Math.round(settlement.population * ageScale)),
      prosperity: clamp(settlement.prosperity - Math.round((912 - year) / 35)),
      status: settlement.foundedYear > year ? 'ruined' : 'active',
    }])),
    routeStates: Object.fromEntries(world.routes.map((route) => [route.id, route.establishedYear > year ? 'abandoned' : 'active'])),
    eventIds: world.history.filter((event) => event.year <= year && event.year > year - 80).map((event) => event.id),
  }
}

function createWar(seed: string, year: number, day: number, state: Pick<GameState, 'world'>, index: number): WorldWar | undefined {
  const rng = new RNG(`${seed}:war:${year}:${day}:${index}`)
  const candidates = state.world.realms.flatMap((realm) => Object.entries(realm.relations)
    .filter(([, relation]) => relation < -18)
    .map(([otherId, relation]) => ({ realm, otherId, relation })))
  if (!candidates.length) return undefined
  candidates.sort((a, b) => a.relation - b.relation)
  const pair = rng.pick(candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2))))
  const defender = state.world.realms.find((realm) => realm.id === pair.otherId)
  if (!defender) return undefined
  const front = state.world.settlements
    .filter((settlement) => settlement.realmId === defender.id && settlement.status !== 'ruined')
    .sort((a, b) => a.safety - b.safety)
    .slice(0, 2)
  return {
    id: `war-${year}-${day}-${index}`,
    name: `${rng.pick(['Война', 'Кампания', 'Спор', 'Поход'])} за ${rng.pick(['Северный предел', 'Старый тракт', 'Серебряные ворота', 'Долину трёх рек'])}`,
    attackerRealmId: pair.realm.id,
    defenderRealmId: defender.id,
    cause: rng.pick(CAUSES), goal: rng.pick(GOALS), status: 'preparing',
    startedYear: year, startedDay: day, progress: 0,
    attackerExhaustion: rng.int(0, 10), defenderExhaustion: rng.int(0, 10),
    attackerSupply: clamp(pair.realm.wealth + pair.realm.military / 2), defenderSupply: clamp(defender.wealth + defender.military / 2),
    frontSettlementIds: front.map((settlement) => settlement.id), capturedSettlementIds: [], casualties: 0,
  }
}

export function initializeLivingWorld(seed: string, world: GameState['world'], settings: WorldGenerationSettings) {
  const currentYear = 912
  const span = settings.historyDepth === 'ancient' ? 900 : settings.historyDepth === 'young' ? 180 : 520
  const snapshotYears = [currentYear - span, currentYear - Math.round(span * 0.45), currentYear]
  const historySnapshots = snapshotYears.map((year, index) => historicalSnapshot(seed, year, world, index))
  const wars = createInitialPoliticalWars(seed, world, settings, currentYear)
  return { wars, knowledgeSpreads: [] as KnowledgeSpread[], historySnapshots }
}

function ensureKnowledgeSpreads(state: GameState): GameState {
  const known = new Set(state.knowledgeSpreads.map((spread) => spread.discoveryId))
  const additions = state.discoveries.filter((discovery) => !known.has(discovery.id)).map((discovery): KnowledgeSpread => ({
    id: `knowledge-${discovery.id}`, discoveryId: discovery.id, title: discovery.title, stage: 'found', progress: 0,
    credibility: clamp(discovery.evidenceQuality), controversy: Math.max(5, 70 - discovery.evidenceQuality), knownRealmIds: [], interestedFactionIds: [],
    startedYear: state.year, startedDay: state.day, lastUpdate: 'Сведения существуют только внутри гильдии.',
  }))
  return additions.length ? { ...state, knowledgeSpreads: [...state.knowledgeSpreads, ...additions] } : state
}

function applyKnowledgeUse(state: GameState, spread: KnowledgeSpread, discovery: DiscoveryRecord, rng: RNG): GameState {
  const impact = settingMultiplier(state.settings.discoveryImpact, 0.55, 1, 1.65)
  const tile = state.world.tiles.find((entry) => entry.id === discovery.tileId)
  const nearest = state.world.settlements
    .filter((settlement) => settlement.status !== 'ruined')
    .sort((a, b) => {
      const ta = state.world.tiles.find((entry) => entry.id === a.tileId)
      const tb = state.world.tiles.find((entry) => entry.id === b.tileId)
      return Math.hypot((ta?.x ?? 0) - (tile?.x ?? 0), (ta?.y ?? 0) - (tile?.y ?? 0)) - Math.hypot((tb?.x ?? 0) - (tile?.x ?? 0), (tb?.y ?? 0) - (tile?.y ?? 0))
    })
  const target = nearest[0]
  const second = nearest.find((entry) => entry.realmId !== target?.realmId) ?? nearest[1]
  let routes = state.world.routes
  let settlements = state.world.settlements
  let realms = state.world.realms
  let eventText = 'Открытие вошло в политическую и научную жизнь региона.'
  if ((discovery.type === 'route' || discovery.summary.toLowerCase().includes('маршрут')) && target && second && tile) {
    const route: WorldRoute = {
      id: `discovery-route-${discovery.id}`, name: `${target.name} — ${second.name}: путь гильдии`, type: 'trade',
      tileIds: [target.tileId, tile.id, second.tileId], importance: Math.max(2, Math.round(discovery.value / 25)),
      originSettlementId: target.id, destinationSettlementId: second.id,
      goods: Array.from(new Set([...target.production, ...second.production])).slice(0, 4), income: Math.round((25 + discovery.value) * impact),
      safety: clamp(45 + discovery.evidenceQuality / 2), seasonality: rng.int(5, 35), status: 'active', establishedYear: state.year,
    }
    if (!routes.some((entry) => entry.id === route.id)) routes = [...routes, route]
    settlements = settlements.map((settlement) => [target.id, second.id].includes(settlement.id) ? { ...settlement, prosperity: clamp(settlement.prosperity + 7 * impact), growth: settlement.growth + 3 * impact } : settlement)
    eventText = `Новый путь связал ${target.name} и ${second.name}. Купцы меняют старые маршруты.`
  } else if (discovery.type === 'document') {
    realms = realms.map((realm) => realm.id === tile?.stateId ? { ...realm, stability: clamp(realm.stability - 6 * impact), currentIssue: `спор из-за документа «${discovery.title}»` } : realm)
    eventText = 'Документ вошёл в политический спор и поставил под вопрос официальную историю.'
  } else if (target) {
    settlements = settlements.map((settlement) => settlement.id === target.id ? { ...settlement, prosperity: clamp(settlement.prosperity + 4 * impact), unrest: clamp(settlement.unrest + 2 * impact), growth: settlement.growth + 1 } : settlement)
    eventText = `К ${target.name} прибывают учёные, чиновники и искатели наживы.`
  }
  const event: HistoricalEvent = {
    id: `history-use-${discovery.id}`, year: state.year, title: `Открытие используется: ${discovery.title}`, description: eventText,
    tags: ['discovery', discovery.id], severity: Math.min(5, Math.max(2, Math.round(discovery.value / 25))), kind: 'discovery',
    cause: 'публикация и распространение сведений гильдии', consequence: eventText,
    publicVersion: `Гильдия доказала ценность открытия «${discovery.title}».`, hiddenTruth: discovery.disposition === 'secret' ? 'Часть сведений была скрыта от публики.' : undefined,
    realmIds: tile?.stateId ? [tile.stateId] : [], settlementIds: target ? [target.id] : [], siteIds: discovery.siteId ? [discovery.siteId] : [],
  }
  return {
    ...state,
    world: { ...state.world, routes, settlements, realms, history: [...state.world.history, event].slice(-650) },
    chronicle: [...state.chronicle, { id: `chronicle-${event.id}`, year: state.year, day: state.day, title: event.title, text: event.description, category: 'world', importance: event.severity ?? 3 }],
  }
}

function tickKnowledge(state: GameState, rng: RNG): GameState {
  let next = ensureKnowledgeSpreads(state)
  const speed = settingMultiplier(next.settings.worldChangeSpeed, 0.65, 1, 1.5)
  const updated: KnowledgeSpread[] = []
  for (const spread of next.knowledgeSpreads) {
    if (spread.stage === 'used') { updated.push(spread); continue }
    const discovery = next.discoveries.find((entry) => entry.id === spread.discoveryId)
    if (!discovery) { updated.push(spread); continue }
    if (discovery.disposition === 'archived' && spread.stage === 'verified') {
      updated.push({ ...spread, progress: 100, lastUpdate: 'Открытие подтверждено, но остаётся в закрытом архиве гильдии.' })
      continue
    }
    const dispositionRate = discovery.disposition === 'published' ? 18 : discovery.disposition === 'sold' ? 13 : discovery.disposition === 'archived' ? 5 : discovery.disposition === 'secret' ? 2 : 7
    let progress = spread.progress + (dispositionRate + discovery.evidenceQuality / 12 + rng.float(-3, 4)) * speed
    let stage: KnowledgeSpreadStage = spread.stage
    if (discovery.disposition === 'secret' && stage === 'verified' && progress >= 100 && !rng.bool(0.22)) progress = 92
    let lastUpdate = spread.lastUpdate
    let knownRealmIds = [...spread.knownRealmIds]
    let controversy = spread.controversy
    if (progress >= 100) {
      progress -= 100
      const nextIndex = Math.min(STAGES.length - 1, STAGES.indexOf(stage) + 1)
      stage = discovery.disposition === 'secret' && stage === 'verified' ? 'contested' : STAGES[nextIndex]
      const tile = next.world.tiles.find((entry) => entry.id === discovery.tileId)
      if (tile?.stateId && !knownRealmIds.includes(tile.stateId)) knownRealmIds.push(tile.stateId)
      if (stage === 'verified') lastUpdate = 'Архивисты подтвердили основные доказательства.'
      if (stage === 'published') lastUpdate = 'Сведения опубликованы и покинули стены гильдии.'
      if (stage === 'contested') { lastUpdate = discovery.disposition === 'secret' ? 'Сведения утекли из закрытого архива и появились в виде противоречивых слухов.' : 'Фракции и учёные оспаривают трактовку открытия.'; controversy = clamp(controversy + rng.int(8, 22)) }
      if (stage === 'spreading') lastUpdate = 'Копии, слухи и карты расходятся между государствами.'
      if (stage === 'used') {
        lastUpdate = 'Открытие используется в торговле, политике или освоении территории.'
        next = applyKnowledgeUse(next, spread, discovery, rng)
      }
    }
    updated.push({ ...spread, stage, progress: clamp(progress), credibility: clamp(spread.credibility + (stage === 'verified' ? 5 : 0)), controversy, knownRealmIds, lastUpdate })
  }
  return { ...next, knowledgeSpreads: updated }
}

function tickEconomy(state: GameState, rng: RNG, preferences: AppPreferences): GameState {
  const volatility = settingMultiplier(state.settings.economyVolatility, 0.55, 1, 1.65)
  const growthSetting = settingMultiplier(state.settings.cityGrowth, 0.55, 1, 1.45)
  const activeWars = state.wars.filter((war) => war.status === 'active' || war.status === 'preparing')
  const routes = state.world.routes.map((route) => {
    if (route.type === 'river') return route
    const origin = state.world.settlements.find((entry) => entry.id === route.originSettlementId)
    const destination = state.world.settlements.find((entry) => entry.id === route.destinationSettlementId)
    const matches = origin && destination
      ? origin.production.filter((good) => destination.demand.includes(good)).length + destination.production.filter((good) => origin.demand.includes(good)).length
      : 0
    const warPressure = activeWars.some((war) => war.frontSettlementIds.some((id) => [origin?.id, destination?.id].includes(id))) ? 28 : 0
    const routeDanger = route.tileIds.reduce((sum, id) => sum + (state.world.tiles.find((tile) => tile.id === id)?.danger ?? 0), 0) / Math.max(1, route.tileIds.length)
    const targetSafety = clamp(62 + route.importance * 2.5 - routeDanger * 3.2 - warPressure)
    const safety = clamp(route.safety * 0.82 + targetSafety * 0.18 + rng.float(-2.5, 2.5) * volatility)
    const status: RouteStatus = safety < 18 ? 'abandoned' : safety < 42 ? 'disrupted' : 'active'
    const activity = status === 'active' ? 1 : status === 'disrupted' ? 0.35 : 0
    const income = Math.max(0, Math.round((route.importance * 12 + matches * 20 + rng.float(-8, 12)) * activity))
    return { ...route, safety, status, income }
  })

  const settlements = state.world.settlements.map((settlement) => {
    if (settlement.status === 'ruined') return settlement
    const connected = routes.filter((route) => [route.originSettlementId, route.destinationSettlementId].includes(settlement.id) && route.type !== 'river')
    const tradeIncome = connected.reduce((sum, route) => sum + route.income / 2, 0)
    const disruptions = connected.filter((route) => route.status !== 'active').length
    const foodProduction = settlement.production.includes('зерно') || settlement.production.includes('рыба') || settlement.production.includes('скот')
    const foodTarget = clamp(45 + (foodProduction ? 24 : -4) + tradeIncome / 18 - disruptions * 9)
    const foodSecurity = clamp(settlement.foodSecurity * 0.84 + foodTarget * 0.16 + rng.float(-2, 2) * volatility)
    const tradeBalance = Math.round(tradeIncome - settlement.demand.length * 8 - disruptions * 10)
    const rawGrowth = (tradeBalance / 45 + (settlement.safety - 50) / 30 + (foodSecurity - 50) / 35 - settlement.unrest / 55) * growthSetting
    const baseGrowth = Math.max(-10, Math.min(8, rawGrowth + rng.float(-1.5, 1.5) * volatility))
    const carryingCapacity: Record<Settlement['kind'], number> = { village: 7000, town: 26000, city: 76000, capital: 170000, fortress: 11000, monastery: 6500 }
    const capacity = carryingCapacity[settlement.kind]
    const capacityRoom = Math.max(0.08, 1 - settlement.population / capacity)
    const overcrowding = settlement.population > capacity ? (settlement.population / capacity - 1) * 8 : 0
    const growth = baseGrowth > 0 ? baseGrowth * capacityRoom : baseGrowth - overcrowding
    const calculatedPopulation = Math.max(0, Math.round(settlement.population * (1 + growth / 4200)))
    const prosperityTarget = clamp(42 + tradeBalance / 5 + settlement.safety / 4 + foodSecurity / 5)
    const calculatedProsperity = clamp(settlement.prosperity * 0.9 + prosperityTarget * 0.1 + growth / 8)
    const population = preferences.economicDeclineEnabled ? calculatedPopulation : Math.max(settlement.population, calculatedPopulation)
    const prosperity = preferences.economicDeclineEnabled ? calculatedProsperity : Math.max(settlement.prosperity, calculatedProsperity)
    const stableFood = preferences.economicDeclineEnabled ? foodSecurity : Math.max(settlement.foodSecurity, foodSecurity)
    const calculatedUnrest = clamp(settlement.unrest + (stableFood < 30 ? 5 : -1) + (prosperity < 25 ? 3 : -1) + disruptions - settlement.safety / 80)
    const unrest = preferences.economicDeclineEnabled ? calculatedUnrest : Math.min(settlement.unrest, calculatedUnrest)
    const wouldRuin = population < 70 || (prosperity < 5 && stableFood < 12 && unrest > 88)
    const status: Settlement['status'] = preferences.cityDestructionEnabled && wouldRuin ? 'ruined' : population < 700 || prosperity < 22 ? 'declining' : 'active'
    return { ...settlement, population, prosperity, foodSecurity: stableFood, tradeBalance, growth: preferences.economicDeclineEnabled ? growth : Math.max(0, growth), unrest, status }
  })
  const realms = state.world.realms.map((realm) => {
    const owned = settlements.filter((settlement) => settlement.realmId === realm.id && settlement.status !== 'ruined')
    const trade = owned.reduce((sum, settlement) => sum + settlement.tradeBalance, 0)
    const unrest = owned.length ? owned.reduce((sum, settlement) => sum + settlement.unrest, 0) / owned.length : 100
    const wealth = clamp(realm.wealth + trade / 450)
    const stability = clamp(realm.stability - Math.max(0, unrest - 55) / 35 + (unrest < 30 ? 0.5 : 0))
    return { ...realm, wealth: preferences.economicDeclineEnabled ? wealth : Math.max(realm.wealth, wealth), stability: preferences.economicDeclineEnabled ? stability : Math.max(realm.stability, stability) }
  })
  return { ...state, world: { ...state.world, routes, settlements, realms } }
}

function createRuinsFromSettlement(state: GameState, settlement: Settlement, cause: string, preferences: AppPreferences): GameState {
  if (!preferences.cityDestructionEnabled) return state
  if (state.world.sites.some((site) => site.tileId === settlement.tileId)) return state
  const site: Site = {
    id: `site-new-ruin-${settlement.id}-${state.year}`, name: `Развалины ${settlement.name}`, tileId: settlement.tileId, type: 'ruins',
    origin: `${settlement.kind} государства ${state.world.realms.find((realm) => realm.id === settlement.lastOwnerRealmId)?.name ?? 'неизвестного владельца'}`,
    age: 0, danger: Math.min(10, 4 + Math.round(settlement.unrest / 20)), depth: 3, state: 'discovered',
    monsterTags: [], rewards: ['городские архивы', 'военные документы', 'оставленное имущество'], truth: `Поселение погибло из-за события: ${cause}.`,
    layers: ['жилой город', 'следы разрушения', 'первые новые обитатели'], zones: [
      { id: `zone-${settlement.id}-gate`, name: 'Разбитые ворота', kind: 'entrance', danger: 3, historyLayer: 'следы разрушения', description: 'Главный вход завален обломками.', connections: [`zone-${settlement.id}-square`], rewards: [], explored: false, secured: false },
      { id: `zone-${settlement.id}-square`, name: 'Мёртвая площадь', kind: 'hall', danger: 5, historyLayer: 'жилой город', description: 'На площади остались следы последних дней.', connections: [`zone-${settlement.id}-gate`, `zone-${settlement.id}-archive`], rewards: ['письма жителей'], explored: false, secured: false },
      { id: `zone-${settlement.id}-archive`, name: 'Сгоревший архив', kind: 'vault', danger: 6, historyLayer: 'следы разрушения', description: 'Под обрушенной крышей могли сохраниться документы.', connections: [`zone-${settlement.id}-square`], rewards: ['городские документы'], explored: false, secured: false },
    ], exploration: 0, campEstablished: false,
  }
  const history: HistoricalEvent = {
    id: `history-ruin-${settlement.id}-${state.year}`, year: state.year, title: `${settlement.name} становится руинами`,
    description: `${settlement.name} больше не функционирует как поселение. ${cause}.`, tags: ['settlement', 'ruins', settlement.id], severity: 5, kind: 'settlement',
    cause, consequence: 'На карте появился новый опасный объект, а жители ушли в соседние земли.', publicVersion: `${settlement.name} погиб в ходе кризиса.`,
    hiddenTruth: 'Часть архивов и имущества могла пережить разрушение.', realmIds: [settlement.realmId], settlementIds: [settlement.id], siteIds: [site.id],
  }
  return {
    ...state,
    world: {
      ...state.world,
      sites: [...state.world.sites, site], history: [...state.world.history, history].slice(-650),
      tiles: state.world.tiles.map((tile) => tile.id === settlement.tileId ? { ...tile, siteId: site.id, settlementId: undefined, danger: Math.min(10, tile.danger + 2) } : tile),
    },
    chronicle: [...state.chronicle, { id: `chronicle-${history.id}`, year: state.year, day: state.day, title: history.title, text: history.description, category: 'world', importance: 5 }],
  }
}

function tickWars(state: GameState, rng: RNG, preferences: AppPreferences): GameState {
  let next = state
  const wars: WorldWar[] = []
  for (const war of next.wars) {
    if (war.status === 'ended') { wars.push(war); continue }
    const attacker = next.world.realms.find((realm) => realm.id === war.attackerRealmId)
    const defender = next.world.realms.find((realm) => realm.id === war.defenderRealmId)
    if (!attacker || !defender) { wars.push({ ...war, status: 'ended' }); continue }
    const status = war.status === 'preparing' ? 'active' : war.status
    const attackerPower = attacker.military * 0.55 + war.attackerSupply * 0.45 - war.attackerExhaustion * 0.3
    const defenderPower = defender.military * 0.55 + war.defenderSupply * 0.45 - war.defenderExhaustion * 0.3
    let progress = clamp(war.progress + (attackerPower - defenderPower) / 18 + rng.float(-8, 8), -100, 100)
    let captured = [...war.capturedSettlementIds]
    let lastEvent = war.lastEvent
    let settlements = next.world.settlements
    let tiles = next.world.tiles
    if (preferences.borderChangesEnabled && progress > 65) {
      const target = settlements.find((settlement) => war.frontSettlementIds.includes(settlement.id) && settlement.realmId === defender.id && settlement.status !== 'ruined')
      if (target) {
        captured.push(target.id)
        settlements = settlements.map((settlement) => settlement.id === target.id ? { ...settlement, lastOwnerRealmId: settlement.realmId, realmId: attacker.id, safety: clamp(settlement.safety - 24), prosperity: clamp(settlement.prosperity - 15), unrest: clamp(settlement.unrest + 28) } : settlement)
        tiles = tiles.map((tile) => tile.id === target.tileId ? { ...tile, stateId: attacker.id, danger: Math.min(10, tile.danger + 1.5) } : tile)
        progress = 25
        lastEvent = `${attacker.name} захватывает ${target.name}.`
        next = { ...next, world: { ...next.world, settlements, tiles }, chronicle: [...next.chronicle, { id: `chronicle-capture-${war.id}-${target.id}-${next.year}-${next.day}`, year: next.year, day: next.day, title: `Захвачен город ${target.name}`, text: lastEvent, category: 'world', importance: 4 }] }
      }
    }
    const attackerExhaustion = clamp(war.attackerExhaustion + rng.float(2, 7) + Math.max(0, -progress) / 35)
    const defenderExhaustion = clamp(war.defenderExhaustion + rng.float(2, 7) + Math.max(0, progress) / 35)
    const attackerSupply = clamp(war.attackerSupply - rng.float(2, 6))
    const defenderSupply = clamp(war.defenderSupply - rng.float(2, 6))
    const casualties = war.casualties + rng.int(120, 850)
    const ended = attackerExhaustion > 92 || defenderExhaustion > 92 || attackerSupply < 8 || defenderSupply < 8
    wars.push({ ...war, status: ended ? 'ended' : status, progress, attackerExhaustion, defenderExhaustion, attackerSupply, defenderSupply, casualties, capturedSettlementIds: captured, lastEvent: ended ? 'Стороны истощены и подписывают тяжёлое перемирие.' : lastEvent })
    if (ended) {
      const event: HistoricalEvent = { id: `history-war-end-${war.id}`, year: next.year, title: `Завершена ${war.name}`, description: `Война закончилась после ${casualties.toLocaleString('ru-RU')} потерь.`, tags: ['war', war.id], severity: 5, kind: 'war', cause: war.cause, consequence: captured.length ? 'Часть поселений сменила владельца.' : 'Границы почти не изменились, но государства истощены.', publicVersion: 'Правители объявили достигнутый мир победой.', hiddenTruth: 'Ни одна сторона не могла продолжать снабжение армий.', realmIds: [war.attackerRealmId, war.defenderRealmId], settlementIds: captured, siteIds: [] }
      next = { ...next, world: { ...next.world, history: [...next.world.history, event].slice(-650) }, chronicle: [...next.chronicle, { id: `chronicle-${event.id}`, year: next.year, day: next.day, title: event.title, text: event.description, category: 'world', importance: 5 }] }
    }
  }
  next = { ...next, wars }
  const newlyRuined = next.world.settlements.filter((settlement) => settlement.status === 'ruined' && !next.world.sites.some((site) => site.tileId === settlement.tileId))
  if (preferences.cityDestructionEnabled) for (const settlement of newlyRuined.slice(0, 2)) next = createRuinsFromSettlement(next, settlement, 'война, голод и распад управления', preferences)
  return next
}

function maybeSpawnWar(state: GameState, rng: RNG): GameState {
  const active = state.wars.filter((war) => war.status !== 'ended')
  const limit = state.settings.warFrequency === 'frequent' ? Math.max(2, Math.round(state.world.realms.length / 2)) : state.settings.warFrequency === 'rare' ? 1 : 2
  if (active.length >= limit) return state
  const chance = settingMultiplier(state.settings.warFrequency, 0.12, 0.34, 0.65) * settingMultiplier(state.settings.worldChangeSpeed, 0.7, 1, 1.3)
  if (!rng.bool(chance)) return state
  const war = createWar(state.seed, state.year, state.day, state, state.wars.length + 1)
  if (!war) return state
  return { ...state, wars: [...state.wars, war], chronicle: [...state.chronicle, { id: `chronicle-war-start-${war.id}`, year: state.year, day: state.day, title: `Начинается ${war.name}`, text: `${war.cause}. Цель наступающей стороны: ${war.goal}.`, category: 'world', importance: 5 }] }
}

function maybeCatastrophe(state: GameState, rng: RNG, preferences: AppPreferences): GameState {
  const chance = settingMultiplier(state.settings.catastropheFrequency, 0.08, 0.2, 0.42)
  if (!rng.bool(chance)) return state
  const target = rng.pick(state.world.settlements.filter((settlement) => settlement.status !== 'ruined'))
  if (!target) return state
  const kinds = ['магическая буря', 'пожар', 'землетрясение', 'эпидемия', 'наводнение']
  const kind = rng.pick(kinds)
  const severity = rng.int(2, 5)
  const settlements = state.world.settlements.map((settlement) => settlement.id === target.id ? {
    ...settlement,
    population: Math.max(0, Math.round(settlement.population * (1 - severity * 0.045))), prosperity: clamp(settlement.prosperity - severity * 5),
    safety: clamp(settlement.safety - severity * 7), unrest: clamp(settlement.unrest + severity * 8), status: preferences.cityDestructionEnabled && settlement.prosperity - severity * 5 < 8 ? 'ruined' : settlement.status,
  } : settlement)
  const event: HistoricalEvent = { id: `history-catastrophe-${state.year}-${state.day}-${target.id}`, year: state.year, title: `${kind}: ${target.name}`, description: `${kind} поразила ${target.name}. Погибли люди, торговля остановилась, власти ищут виновных.`, tags: ['catastrophe', target.id], severity, kind: 'catastrophe', cause: kind, consequence: 'Поселение потеряло население, безопасность и доход.', publicVersion: `${kind} названа стихийным бедствием.`, hiddenTruth: kind === 'магическая буря' ? 'В эпицентре замечены следы старого ритуала.' : undefined, realmIds: [target.realmId], settlementIds: [target.id], siteIds: [] }
  let next: GameState = { ...state, world: { ...state.world, settlements, history: [...state.world.history, event].slice(-650) }, chronicle: [...state.chronicle, { id: `chronicle-${event.id}`, year: state.year, day: state.day, title: event.title, text: event.description, category: 'world', importance: severity }] }
  const ruined = settlements.find((entry) => entry.id === target.id)?.status === 'ruined'
  if (ruined && preferences.cityDestructionEnabled) next = createRuinsFromSettlement(next, settlements.find((entry) => entry.id === target.id)!, kind, preferences)
  return next
}

function addAnnualSnapshot(state: GameState): GameState {
  const snapshot = snapshotFromState(state, `Карта мира на ${state.year} год`)
  const historySnapshots = [...state.historySnapshots.filter((entry) => entry.year !== state.year), snapshot].sort((a, b) => a.year - b.year).slice(-36)
  return { ...state, historySnapshots }
}

export function livingWorldDayTick(state: GameState): GameState {
  const preferences = loadPreferences()
  let next = ensureKnowledgeSpreads(state)
  if (next.day % 30 === 0) {
    next = ecosystemMonthTick(next)
    next = societyYearTick(next)
    const rng = new RNG(`${next.seed}:living-world:${next.year}:${next.day}`)
    next = tickEconomy(next, rng, preferences)
    next = tickKnowledge(next, rng)
    next = politicsMonthTick(next, preferences)
    if (preferences.crisesEnabled && next.day % 180 === 0) next = maybeCatastrophe(next, rng, preferences)
  }
  if (next.day === 1) next = addAnnualSnapshot(next)
  return next
}
