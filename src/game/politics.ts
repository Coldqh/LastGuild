import type {
  AppPreferences,
} from './preferences'
import type {
  GameState,
  HistoricalEvent,
  PoliticalEvent,
  PoliticalSimulationState,
  Realm,
  RealmArmy,
  RealmObjective,
  RealmObjectiveKind,
  Settlement,
  TerritoryControlStatus,
  WarType,
  WorldData,
  WorldGenerationSettings,
  WorldTile,
  WorldWar,
} from '../types/game'
import { RNG } from './rng'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const round1 = (value: number) => Math.round(value * 10) / 10

const GOVERNMENTS = {
  league: ['торговая лига', 'союз городов', 'купеческая республика'],
  tribal: ['племенной союз', 'совет кланов', 'кочевая конфедерация'],
  religious: ['теократия', 'храмовое княжество', 'священный союз'],
  feudal: ['княжество', 'королевство', 'наследственная монархия'],
} as const

const OBJECTIVE_LABELS: Record<RealmObjectiveKind, string> = {
  secure_border: 'укрепить уязвимую границу',
  control_route: 'взять под контроль торговый путь',
  capture_resource: 'получить стратегический ресурс',
  recover_claim: 'вернуть спорную землю',
  subjugate_neighbor: 'подчинить слабого соседа',
  suppress_revolt: 'подавить сопротивление провинций',
  clear_monsters: 'очистить земли от чудовищ',
  gain_river_access: 'получить выход к большой реке',
}

function neighborIds(tile: WorldTile, world: Pick<WorldData, 'width' | 'height'>): string[] {
  const offsets = tile.x % 2 === 0
    ? [[1, -1], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 0]]
    : [[1, 0], [1, 1], [0, -1], [0, 1], [-1, 0], [-1, 1]]
  return offsets
    .map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy }))
    .filter(({ x, y }) => x >= 0 && y >= 0 && x < world.width && y < world.height)
    .map(({ x, y }) => `${x}:${y}`)
}

function distance(a: WorldTile, b: WorldTile): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 1.12)
}

function governmentFor(realm: Realm, settlements: Settlement[], world: WorldData, rng: RNG): string {
  const capital = settlements.find((entry) => entry.id === realm.capitalId) ?? settlements[0]
  const culture = world.cultures.find((entry) => entry.id === capital?.cultureId)
  const trade = settlements.reduce((sum, entry) => sum + entry.tradeAccess, 0) / Math.max(1, settlements.length)
  const population = settlements.reduce((sum, entry) => sum + entry.population, 0)
  if (culture?.religion.includes('храм') && settlements.some((entry) => entry.kind === 'monastery')) return rng.pick([...GOVERNMENTS.religious])
  if (trade > 62 && settlements.length >= 3) return rng.pick([...GOVERNMENTS.league])
  if (population < 18000 || settlements.length <= 2) return rng.pick([...GOVERNMENTS.tribal])
  return rng.pick([...GOVERNMENTS.feudal])
}

function nearestSettlement(tile: WorldTile, settlements: Settlement[], tileMap: Map<string, WorldTile>): { settlement?: Settlement; distance: number } {
  let best: Settlement | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const settlement of settlements) {
    const settlementTile = tileMap.get(settlement.tileId)
    if (!settlementTile) continue
    const d = distance(tile, settlementTile)
    if (d < bestDistance) { best = settlement; bestDistance = d }
  }
  return { settlement: best, distance: bestDistance }
}

function controlStatus(strength: number, core: boolean, occupied: boolean, claimed: boolean): TerritoryControlStatus {
  if (occupied) return 'occupied'
  if (claimed && strength < 58) return 'contested'
  if (core && strength >= 62) return 'core'
  if (strength >= 55) return 'controlled'
  if (strength >= 24) return 'frontier'
  return 'unclaimed'
}

function computeSupply(tile: WorldTile, realmId: string, world: WorldData, settlements: Settlement[], tileMap: Map<string, WorldTile>): number {
  const own = settlements.filter((entry) => entry.realmId === realmId && entry.status !== 'ruined' && !entry.occupationRealmId)
  if (!own.length) return 0
  const nearest = nearestSettlement(tile, own, tileMap)
  const routeBonus = world.routes.some((route) => route.status === 'active' && route.tileIds.includes(tile.id)) ? 22 : 0
  const terrainPenalty = tile.travelCost * 7 + tile.slope * 18 + tile.danger * 2.5
  return clamp(100 - nearest.distance * 9 - terrainPenalty + routeBonus)
}

function chooseObjective(realm: Realm, world: WorldData, rng: RNG): RealmObjective {
  const ownTiles = world.tiles.filter((tile) => (tile.controllerRealmId ?? tile.stateId) === realm.id && tile.biome !== 'ocean')
  const claims = world.tiles.filter((tile) => tile.claimedByRealmIds?.includes(realm.id) && (tile.controllerRealmId ?? tile.stateId) !== realm.id)
  const contested = claims.filter((tile) => tile.controlStatus === 'contested' || tile.controlStatus === 'occupied')
  const dangerous = ownTiles.filter((tile) => tile.danger >= 7 || Boolean(tile.monsterPopulationId)).sort((a, b) => b.danger - a.danger)
  const riverClaims = claims.filter((tile) => tile.hasRiver)
  const routeClaims = claims.filter((tile) => world.routes.some((route) => route.status === 'active' && route.tileIds.includes(tile.id)))
  const resourceClaims = claims.filter((tile) => tile.resourceRichness > 64).sort((a, b) => b.resourceRichness - a.resourceRichness)
  const unstable = world.settlements.filter((entry) => entry.realmId === realm.id && entry.unrest > 62)

  let kind: RealmObjectiveKind = 'secure_border'
  let targets = claims.slice(0, 5)
  let reason = 'граница государства слабо управляется'
  if (unstable.length) { kind = 'suppress_revolt'; targets = unstable.map((entry) => world.tiles.find((tile) => tile.id === entry.tileId)).filter((entry): entry is WorldTile => Boolean(entry)); reason = 'в провинциях растут беспорядки' }
  else if (contested.length) { kind = 'recover_claim'; targets = contested.slice(0, 5); reason = 'соседи удерживают земли, которые двор считает своими' }
  else if (resourceClaims.length) { kind = 'capture_resource'; targets = resourceClaims.slice(0, 5); reason = 'государству не хватает доступных рудников и материалов' }
  else if (routeClaims.length) { kind = 'control_route'; targets = routeClaims.slice(0, 5); reason = 'торговые потоки проходят вне контроля казны' }
  else if (riverClaims.length) { kind = 'gain_river_access'; targets = riverClaims.slice(0, 5); reason = 'выход к реке улучшит снабжение и торговлю' }
  else if (dangerous.length) { kind = 'clear_monsters'; targets = dangerous.slice(0, 5); reason = 'чудовища нарушают дороги и сбор налогов' }
  else if (realm.military > 65 && realm.stability > 55 && claims.length) { kind = 'subjugate_neighbor'; targets = claims.slice(0, 5); reason = 'правитель считает соседей слабыми' }

  const targetRealmCounts = new Map<string, number>()
  for (const tile of targets) {
    const owner = tile.legalRealmId ?? tile.stateId
    if (owner && owner !== realm.id) targetRealmCounts.set(owner, (targetRealmCounts.get(owner) ?? 0) + 1)
  }
  const targetRealmId = [...targetRealmCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return {
    id: `objective-${realm.id}-${kind}-${realm.foundedYear ?? 0}`,
    kind,
    title: OBJECTIVE_LABELS[kind],
    targetRealmId,
    targetTileIds: targets.map((tile) => tile.id),
    targetSettlementIds: world.settlements.filter((entry) => targets.some((tile) => tile.id === entry.tileId)).map((entry) => entry.id),
    priority: clamp(45 + targets.length * 7 + rng.int(-8, 14)),
    progress: 0,
    reason,
    createdYear: 912,
  }
}

function createArmy(seed: string, realm: Realm, index: number, settlements: Settlement[], world: WorldData): RealmArmy {
  const rng = new RNG(`${seed}:army:${realm.id}:${index}`)
  const capital = settlements.find((entry) => entry.id === realm.capitalId) ?? settlements[0]
  const baseSoldiers = Math.max(180, Math.round((realm.manpower ?? realm.military * 85) * (index === 0 ? .34 : .18)))
  return {
    id: `army-${realm.id}-${index + 1}`,
    realmId: realm.id,
    name: index === 0 ? `Главное войско ${realm.name}` : `${rng.pick(['Пограничный', 'Речной', 'Северный', 'Южный'])} корпус`,
    tileId: capital?.tileId ?? world.tiles.find((tile) => tile.stateId === realm.id)?.id ?? world.tiles[0].id,
    homeSettlementId: capital?.id ?? settlements[0]?.id ?? '',
    status: index === 0 ? 'garrison' : 'frontline',
    soldiers: baseSoldiers,
    quality: clamp(realm.military * .55 + rng.int(10, 28)),
    morale: clamp(realm.stability * .55 + realm.legitimacy! * .3 + rng.int(5, 18)),
    supply: 88,
    experience: rng.int(5, 42),
    movement: 1,
    casualties: 0,
    objectiveId: realm.objective?.id,
  }
}

function relationFor(a: Realm, b: Realm, world: WorldData): number {
  const aTiles = world.tiles.filter((tile) => (tile.controllerRealmId ?? tile.stateId) === a.id)
  const bSet = new Set(world.tiles.filter((tile) => (tile.controllerRealmId ?? tile.stateId) === b.id).map((tile) => tile.id))
  let sharedBorder = 0
  let claims = 0
  for (const tile of aTiles) {
    if (neighborIds(tile, world).some((id) => bSet.has(id))) sharedBorder += 1
    if (tile.claimedByRealmIds?.includes(b.id)) claims += 1
  }
  const cultural = a.culture === b.culture ? 18 : -5
  const trade = world.routes.filter((route) => {
    const origin = world.settlements.find((entry) => entry.id === route.originSettlementId)
    const destination = world.settlements.find((entry) => entry.id === route.destinationSettlementId)
    return origin && destination && new Set([origin.realmId, destination.realmId]).has(a.id) && new Set([origin.realmId, destination.realmId]).has(b.id)
  }).length * 8
  const old = a.relations[b.id] ?? 0
  return clamp(old * .45 + cultural + trade - sharedBorder * 1.2 - claims * 5, -100, 100)
}

export function initializePolitics(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = 912): WorldData {
  if (input.politics && input.armies?.length && input.realms.every((realm) => realm.objective && realm.coreTileIds)) return input
  const rng = new RNG(`${seed}:politics:init`)
  const tileMap = new Map(input.tiles.map((tile) => [tile.id, tile]))
  let settlements = input.settlements.map((settlement) => ({
    ...settlement,
    legalRealmId: settlement.legalRealmId ?? settlement.realmId,
    loyalty: settlement.loyalty ?? clamp(78 - settlement.unrest * .55 + settlement.safety * .25),
    fortification: settlement.fortification ?? (settlement.kind === 'fortress' ? 82 : settlement.kind === 'capital' ? 58 : settlement.kind === 'city' ? 38 : 16),
    garrison: settlement.garrison ?? Math.max(20, Math.round(settlement.population * (settlement.kind === 'fortress' ? .12 : .025))),
    taxValue: settlement.taxValue ?? round1(settlement.population * settlement.prosperity / 12000),
    resistance: settlement.resistance ?? 0,
  }))

  let realms: Realm[] = input.realms.map((realm) => {
    const owned = settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')
    const population = owned.reduce((sum, entry) => sum + entry.population, 0)
    const government = governmentFor(realm, owned, input, rng)
    return {
      ...realm,
      government,
      governmentType: government,
      foundedYear: realm.foundedYear ?? Math.max(1, Math.min(...owned.map((entry) => entry.foundedYear), currentYear - 30) - rng.int(5, 80)),
      legitimacy: realm.legitimacy ?? clamp(realm.stability * .75 + rng.int(8, 24)),
      taxCapacity: realm.taxCapacity ?? clamp(owned.reduce((sum, entry) => sum + entry.tradeAccess + entry.prosperity, 0) / Math.max(1, owned.length * 2)),
      administrativeReach: realm.administrativeReach ?? clamp(42 + owned.length * 5 + realm.wealth * .2),
      warExhaustion: realm.warExhaustion ?? 0,
      treasury: realm.treasury ?? Math.round(realm.wealth * 24 + population / 45),
      manpower: realm.manpower ?? Math.max(600, Math.round(population * (.035 + realm.military / 5000))),
      cohesion: realm.cohesion ?? clamp(realm.stability * .65 + (owned.length ? owned.reduce((sum, entry) => sum + (entry.loyalty ?? 50), 0) / owned.length * .35 : 0)),
      coreTileIds: [], claimTileIds: [], subjectRealmIds: realm.subjectRealmIds ?? [],
      relations: { ...realm.relations },
    }
  })

  const realmSettlements = new Map(realms.map((realm) => [realm.id, settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')]))
  let tiles: WorldTile[] = input.tiles.map((tile): WorldTile => {
    if (tile.biome === 'ocean') return { ...tile, controlStatus: 'unclaimed' as const, controlStrength: 0, supplyAccess: 0, claimedByRealmIds: [] as string[] }
    const ownerId = tile.stateId
    if (!ownerId) return { ...tile, legalRealmId: undefined, controllerRealmId: undefined, controlStrength: 0, controlStatus: 'unclaimed' as const, supplyAccess: 0, resistance: 0, fortification: 0, claimedByRealmIds: [] as string[] }
    const realm = realms.find((entry) => entry.id === ownerId)
    const owned = realmSettlements.get(ownerId) ?? []
    const capital = owned.find((entry) => entry.id === realm?.capitalId)
    const capitalTile = capital ? tileMap.get(capital.tileId) : undefined
    const nearest = nearestSettlement(tile, owned, tileMap)
    const cultureMatch = owned.some((entry) => entry.cultureId === tile.dominantCultureId) ? 12 : tile.dominantCultureId ? -8 : 0
    const road = input.routes.some((route) => route.status === 'active' && route.tileIds.includes(tile.id)) ? 16 : 0
    const fortification = tile.settlementId ? settlements.find((entry) => entry.id === tile.settlementId)?.fortification ?? 0 : 0
    const strength = clamp(86 - nearest.distance * 8 - tile.travelCost * 5 - tile.danger * 2 + cultureMatch + road + fortification * .18 + (realm?.administrativeReach ?? 50) * .18)
    const core = Boolean(capitalTile && distance(tile, capitalTile) <= 3.2)
    const supplyAccess = computeSupply(tile, ownerId, input, settlements, tileMap)
    return {
      ...tile,
      legalRealmId: ownerId,
      controllerRealmId: ownerId,
      controlStrength: round1(strength),
      controlStatus: controlStatus(strength, core, false, false),
      supplyAccess: round1(supplyAccess),
      resistance: round1(clamp((tile.migrationPressure ?? 0) * .4 + (cultureMatch < 0 ? 24 : 0))),
      fortification: round1(fortification),
      claimedByRealmIds: [],
    }
  })

  const tileById = new Map(tiles.map((tile) => [tile.id, tile]))
  for (const realm of realms) {
    const own = tiles.filter((tile) => tile.controllerRealmId === realm.id && tile.biome !== 'ocean')
    const core = own.filter((tile) => tile.controlStatus === 'core').map((tile) => tile.id)
    const candidates = new Map<string, WorldTile>()
    for (const tile of own) for (const id of neighborIds(tile, input)) {
      const neighbor = tileById.get(id)
      if (!neighbor || neighbor.biome === 'ocean' || neighbor.controllerRealmId === realm.id) continue
      const strategic = neighbor.hasRiver || neighbor.resourceRichness > 56 || Boolean(neighbor.settlementId) || input.routes.some((route) => route.tileIds.includes(neighbor.id))
      if (strategic) candidates.set(neighbor.id, neighbor)
    }
    const claims = [...candidates.values()].sort((a, b) => (b.resourceRichness + (b.settlementId ? 35 : 0) + (b.hasRiver ? 15 : 0)) - (a.resourceRichness + (a.settlementId ? 35 : 0) + (a.hasRiver ? 15 : 0))).slice(0, Math.max(3, Math.min(12, Math.round(own.length / 10))))
    realm.coreTileIds = core
    realm.claimTileIds = claims.map((tile) => tile.id)
    for (const claim of claims) claim.claimedByRealmIds = Array.from(new Set([...(claim.claimedByRealmIds ?? []), realm.id]))
  }
  tiles = tiles.map((tile) => {
    const claimed = (tile.claimedByRealmIds?.length ?? 0) > 0 && !tile.claimedByRealmIds?.includes(tile.controllerRealmId ?? '')
    return { ...tile, controlStatus: controlStatus(tile.controlStrength ?? 0, tile.controlStatus === 'core', false, claimed) }
  })

  const provisional: WorldData = { ...input, tiles, settlements, realms, armies: [], politics: input.politics ?? { initializedYear: currentYear, lastTickYear: currentYear, lastTickDay: 1, borderChanges: 0, occupations: 0, warsStarted: 0, warsEnded: 0, realmCollapses: 0, activeClaims: 0, recentEvents: [] } }
  realms = realms.map((realm) => ({ ...realm, objective: chooseObjective(realm, provisional, rng) }))
  realms = realms.map((realm) => ({ ...realm, relations: Object.fromEntries(realms.filter((other) => other.id !== realm.id).map((other) => [other.id, relationFor(realm, other, { ...provisional, realms })])) }))
  const worldWithRealms: WorldData = { ...provisional, realms }
  const armies = realms.flatMap((realm) => {
    if (realm.collapsedYear) return []
    const owned = settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')
    const count = owned.length >= 6 || (realm.manpower ?? 0) > 4500 ? 2 : 1
    return Array.from({ length: count }, (_, index) => createArmy(seed, realm, index, owned, worldWithRealms))
  })
  const politics: PoliticalSimulationState = {
    initializedYear: currentYear,
    lastTickYear: currentYear,
    lastTickDay: 1,
    borderChanges: input.politics?.borderChanges ?? 0,
    occupations: input.politics?.occupations ?? 0,
    warsStarted: input.politics?.warsStarted ?? 0,
    warsEnded: input.politics?.warsEnded ?? 0,
    realmCollapses: input.politics?.realmCollapses ?? 0,
    activeClaims: tiles.reduce((sum, tile) => sum + (tile.claimedByRealmIds?.length ?? 0), 0),
    recentEvents: input.politics?.recentEvents ?? [],
  }
  return { ...worldWithRealms, armies, politics }
}

export function ensurePolitics(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = 912): WorldData {
  return initializePolitics(seed, input, settings, currentYear)
}

function warTypeFor(objective: RealmObjective): WarType {
  if (objective.kind === 'control_route') return 'trade'
  if (objective.kind === 'subjugate_neighbor') return 'conquest'
  if (objective.kind === 'recover_claim') return 'border'
  if (objective.kind === 'suppress_revolt') return 'civil'
  return 'border'
}

function frontTiles(attackerId: string, defenderId: string, world: WorldData): WorldTile[] {
  const defenderTiles = new Set(world.tiles.filter((tile) => tile.controllerRealmId === defenderId).map((tile) => tile.id))
  return world.tiles.filter((tile) => tile.controllerRealmId === attackerId && neighborIds(tile, world).some((id) => defenderTiles.has(id)))
    .flatMap((tile) => neighborIds(tile, world).map((id) => world.tiles.find((entry) => entry.id === id)).filter((entry): entry is WorldTile => Boolean(entry?.controllerRealmId === defenderId)))
    .filter((tile, index, array) => array.findIndex((entry) => entry.id === tile.id) === index)
}

export function createInitialPoliticalWars(seed: string, world: WorldData, settings: WorldGenerationSettings, currentYear = 912): WorldWar[] {
  const rng = new RNG(`${seed}:politics:initial-wars`)
  const desired = settings.conflictLevel === 'war_torn' || settings.warFrequency === 'frequent' ? 2 : settings.conflictLevel === 'calm' || settings.warFrequency === 'rare' ? 0 : 1
  const candidates = world.realms
    .filter((realm) => !realm.collapsedYear && realm.objective?.targetRealmId)
    .map((realm) => ({ realm, target: world.realms.find((entry) => entry.id === realm.objective?.targetRealmId), relation: realm.relations[realm.objective?.targetRealmId ?? ''] ?? 0 }))
    .filter((entry) => entry.target && entry.relation < -20)
    .sort((a, b) => a.relation - b.relation)
  const wars: WorldWar[] = []
  for (const entry of candidates) {
    if (wars.length >= desired || !entry.target || !entry.realm.objective) break
    const target = entry.target
    if (wars.some((war) => [war.attackerRealmId, war.defenderRealmId].includes(entry.realm.id) || [war.attackerRealmId, war.defenderRealmId].includes(target.id))) continue
    const fronts = frontTiles(entry.realm.id, target.id, world)
    const frontSettlements = world.settlements.filter((settlement) => fronts.some((tile) => tile.id === settlement.tileId)).map((entry) => entry.id)
    wars.push({
      id: `war-${currentYear}-1-${wars.length + 1}`,
      name: `${rng.pick(['Пограничная война', 'Поход', 'Спор'])}: ${entry.realm.name} — ${target.name}`,
      attackerRealmId: entry.realm.id,
      defenderRealmId: target.id,
      cause: entry.realm.objective.reason,
      goal: entry.realm.objective.title,
      type: warTypeFor(entry.realm.objective),
      status: 'preparing',
      startedYear: currentYear,
      startedDay: 1,
      progress: 0,
      warScore: 0,
      attackerExhaustion: 0,
      defenderExhaustion: 0,
      attackerSupply: 82,
      defenderSupply: 82,
      frontSettlementIds: frontSettlements,
      frontTileIds: fronts.map((tile) => tile.id),
      capturedSettlementIds: [],
      occupiedTileIds: [],
      claimedSettlementIds: entry.realm.objective.targetSettlementIds,
      casualties: 0,
      attackerArmyIds: world.armies.filter((army) => army.realmId === entry.realm.id).map((army) => army.id),
      defenderArmyIds: world.armies.filter((army) => army.realmId === target.id).map((army) => army.id),
    })
  }
  return wars
}

function nextStepToward(current: WorldTile, target: WorldTile, world: WorldData, realmId: string): WorldTile | undefined {
  return neighborIds(current, world)
    .map((id) => world.tiles.find((tile) => tile.id === id))
    .filter((tile): tile is WorldTile => Boolean(tile && tile.biome !== 'ocean'))
    .sort((a, b) => {
      const aAccess = a.controllerRealmId === realmId || a.controlStatus === 'occupied' ? -1.5 : 0
      const bAccess = b.controllerRealmId === realmId || b.controlStatus === 'occupied' ? -1.5 : 0
      return distance(a, target) + a.travelCost * .18 + a.danger * .08 + aAccess - (distance(b, target) + b.travelCost * .18 + b.danger * .08 + bAccess)
    })[0]
}

function updateArmies(state: GameState, wars: WorldWar[], rng: RNG): RealmArmy[] {
  const tileMap = new Map(state.world.tiles.map((tile) => [tile.id, tile]))
  const armyCountByRealm = new Map<string, number>()
  for (const army of state.world.armies) armyCountByRealm.set(army.realmId, (armyCountByRealm.get(army.realmId) ?? 0) + 1)
  return state.world.armies.map((army) => {
    const realm = state.world.realms.find((entry) => entry.id === army.realmId)
    if (!realm || realm.collapsedYear) return { ...army, status: 'broken' as const, soldiers: 0 }
    const war = wars.find((entry) => entry.status !== 'ended' && (entry.attackerRealmId === army.realmId || entry.defenderRealmId === army.realmId))
    const home = state.world.settlements.find((entry) => entry.id === army.homeSettlementId)
    const targetStrength = Math.max(180, Math.round((realm.manpower ?? realm.military * 80) * .5 / Math.max(1, armyCountByRealm.get(realm.id) ?? 1)))
    if (army.soldiers <= 0) {
      if (war || (realm.treasury ?? 0) < 80 || (realm.manpower ?? 0) < 180) return { ...army, status: 'broken' as const, soldiers: 0, supply: Math.max(0, army.supply - 1) }
      const rebuilt = Math.min(targetStrength, Math.max(120, Math.round((realm.manpower ?? 0) * .025)))
      return { ...army, tileId: home?.tileId ?? army.tileId, status: 'garrison' as const, soldiers: rebuilt, morale: 38, supply: 70, warId: undefined, targetTileId: undefined }
    }
    const current = tileMap.get(army.tileId)
    const targetId = war?.frontTileIds?.find((id) => {
      const tile = tileMap.get(id)
      return tile && (entrySide(war, army.realmId) === 'attacker' ? tile.controllerRealmId === war.defenderRealmId : tile.controllerRealmId === war.attackerRealmId || tile.controlStatus === 'occupied')
    }) ?? (!war ? realm.objective?.targetTileIds[0] : undefined)
    const target = targetId ? tileMap.get(targetId) : undefined
    let tileId = army.tileId
    let status: RealmArmy['status'] = war ? 'frontline' : 'garrison'
    if (current && target && current.id !== target.id) {
      const step = nextStepToward(current, target, state.world, army.realmId)
      if (step) { tileId = step.id; status = 'moving' }
    } else if (!war && home && army.tileId !== home.tileId) {
      const homeTile = tileMap.get(home.tileId)
      if (current && homeTile) {
        const step = nextStepToward(current, homeTile, state.world, army.realmId)
        if (step) { tileId = step.id; status = 'moving' }
      }
    }
    const tile = tileMap.get(tileId)
    const supplyAccess = tile?.supplyAccess ?? 30
    const supply = clamp(army.supply + supplyAccess / (war ? 20 : 12) - (war ? 6.2 : .8) - (tile?.travelCost ?? 2) * .45)
    const attrition = supply < 18 ? rng.int(2, Math.max(3, Math.round(army.soldiers * .007))) : 0
    const recruits = !war && army.soldiers < targetStrength
      ? Math.min(targetStrength - army.soldiers, Math.max(6, Math.round(targetStrength * .016)))
      : 0
    const soldiers = Math.max(0, army.soldiers - attrition + recruits)
    return {
      ...army,
      tileId,
      targetTileId: targetId,
      warId: war?.id,
      status: soldiers <= 0 ? 'broken' : supply < 8 ? 'retreating' : status,
      supply: round1(supply),
      morale: round1(clamp(army.morale + (supply > 55 ? .7 : -1.5) + (recruits > 0 ? .25 : 0) - attrition / Math.max(20, army.soldiers) * 100)),
      soldiers,
      casualties: army.casualties + attrition,
    }
  })
}

function entrySide(war: WorldWar, realmId: string): 'attacker' | 'defender' {
  return war.attackerRealmId === realmId ? 'attacker' : 'defender'
}

function armiesPower(armies: RealmArmy[], realmId: string, front: WorldTile[], world: WorldData): number {
  const tileMap = new Map(world.tiles.map((tile) => [tile.id, tile]))
  return armies.filter((army) => army.realmId === realmId && army.status !== 'broken').reduce((sum, army) => {
    const tile = tileMap.get(army.tileId)
    const nearFront = tile && front.some((entry) => distance(tile, entry) <= 2.2)
    const readiness = army.soldiers * (.45 + army.quality / 140) * (.35 + army.morale / 150) * (.3 + army.supply / 140)
    return sum + readiness * (nearFront ? 1 : .18)
  }, 0)
}

function createPoliticalHistory(event: PoliticalEvent): HistoricalEvent {
  return {
    id: `history-${event.id}`,
    year: event.year,
    title: event.title,
    description: event.description,
    tags: ['politics', event.kind, ...event.realmIds],
    severity: Math.max(1, Math.min(5, Math.ceil(event.magnitude / 20))),
    kind: event.kind === 'occupation' || event.kind === 'peace' ? 'war' : 'state',
    cause: 'изменение реального контроля, снабжения и политических целей',
    consequence: event.description,
    publicVersion: event.description,
    hiddenTruth: 'Событие стало результатом накопленного давления границ, снабжения и внутренней устойчивости.',
    realmIds: event.realmIds,
    settlementIds: event.settlementIds,
    siteIds: [],
  }
}

function processWars(state: GameState, armies: RealmArmy[], rng: RNG, preferences: AppPreferences): { world: WorldData; wars: WorldWar[]; events: PoliticalEvent[] } {
  let world = { ...state.world, armies }
  const events: PoliticalEvent[] = []
  const wars = state.wars.map((war) => {
    if (war.status === 'ended') return war
    const attacker = world.realms.find((realm) => realm.id === war.attackerRealmId)
    const defender = world.realms.find((realm) => realm.id === war.defenderRealmId)
    if (!attacker || !defender || attacker.collapsedYear || defender.collapsedYear) return { ...war, status: 'ended' as const, peaceTerms: 'Война прекратилась после распада одной из сторон.' }
    const fronts = frontTiles(attacker.id, defender.id, world)
    const attackerPower = armiesPower(armies, attacker.id, fronts, world) + attacker.military * 35
    const defenderPower = armiesPower(armies, defender.id, fronts, world) + defender.military * 35
    const supplyA = armies.filter((army) => army.realmId === attacker.id).reduce((sum, army) => sum + army.supply, 0) / Math.max(1, armies.filter((army) => army.realmId === attacker.id).length)
    const supplyD = armies.filter((army) => army.realmId === defender.id).reduce((sum, army) => sum + army.supply, 0) / Math.max(1, armies.filter((army) => army.realmId === defender.id).length)
    const delta = clamp((attackerPower - defenderPower) / Math.max(180, attackerPower + defenderPower) * 32 + rng.float(-5, 5), -12, 12)
    let score = clamp((war.warScore ?? war.progress) + delta, -100, 100)
    let tiles = world.tiles
    let settlements = world.settlements
    let occupied = [...(war.occupiedTileIds ?? [])]
    let captured = [...war.capturedSettlementIds]
    let lastEvent = war.lastEvent
    if (preferences.borderChangesEnabled && score > 18 && fronts.length) {
      const target = [...fronts].sort((a, b) => (a.controlStrength ?? 0) - (b.controlStrength ?? 0))[0]
      if (target && target.controllerRealmId === defender.id) {
        occupied = Array.from(new Set([...occupied, target.id]))
        tiles = tiles.map((tile) => tile.id === target.id ? {
          ...tile,
          stateId: attacker.id,
          controllerRealmId: attacker.id,
          legalRealmId: tile.legalRealmId ?? defender.id,
          controlStatus: 'occupied' as const,
          controlStrength: 24,
          resistance: clamp((tile.resistance ?? 20) + 42),
          supplyAccess: Math.min(tile.supplyAccess ?? 30, 42),
        } : tile)
        const targetSettlement = settlements.find((entry) => entry.tileId === target.id)
        if (targetSettlement) {
          captured = Array.from(new Set([...captured, targetSettlement.id]))
          settlements = settlements.map((entry) => entry.id === targetSettlement.id ? { ...entry, occupationRealmId: attacker.id, resistance: clamp((entry.resistance ?? 0) + 45), safety: clamp(entry.safety - 18), unrest: clamp(entry.unrest + 25) } : entry)
        }
        score = 8
        lastEvent = `${attacker.name} заняло ${targetSettlement?.name ?? 'пограничную территорию'}.`
        events.push({ id: `politics-occupation-${war.id}-${target.id}-${state.year}-${state.day}`, year: state.year, day: state.day, kind: 'occupation', title: lastEvent, description: `Военное присутствие ещё не означает законного присоединения. Сопротивление территории: ${Math.round((target.resistance ?? 20) + 42)}.`, realmIds: [attacker.id, defender.id], tileIds: [target.id], settlementIds: targetSettlement ? [targetSettlement.id] : [], magnitude: 70 })
      }
    }
    world = { ...world, tiles, settlements }
    const exhaustionA = clamp(war.attackerExhaustion + 1.5 + Math.max(0, -delta) * .22 + (supplyA < 35 ? 4 : 0))
    const exhaustionD = clamp(war.defenderExhaustion + 1.5 + Math.max(0, delta) * .22 + (supplyD < 35 ? 4 : 0))
    const casualties = war.casualties + Math.round(Math.max(8, Math.min(900, (attackerPower + defenderPower) / 140 * rng.float(.4, 1.2))))
    const duration = (state.year - war.startedYear) * 12 + Math.max(0, Math.floor((state.day - war.startedDay) / 30))
    const ended = exhaustionA > 88 || exhaustionD > 88 || supplyA < 9 || supplyD < 9 || duration > 72
    if (!ended) return { ...war, status: war.status === 'preparing' ? 'active' as const : war.status, progress: score, warScore: score, frontTileIds: fronts.map((tile) => tile.id), attackerSupply: round1(supplyA), defenderSupply: round1(supplyD), attackerExhaustion: round1(exhaustionA), defenderExhaustion: round1(exhaustionD), casualties, occupiedTileIds: occupied, capturedSettlementIds: captured, lastEvent }

    const attackerWon = score > 10 || exhaustionD > exhaustionA + 12
    const formalized = attackerWon ? occupied.slice(0, Math.max(1, Math.ceil(occupied.length * .55))) : []
    if (formalized.length) {
      world = {
        ...world,
        tiles: world.tiles.map((tile) => formalized.includes(tile.id) ? { ...tile, legalRealmId: attacker.id, controllerRealmId: attacker.id, stateId: attacker.id, controlStatus: 'frontier' as const, resistance: clamp((tile.resistance ?? 50) - 18), claimedByRealmIds: (tile.claimedByRealmIds ?? []).filter((id) => id !== attacker.id) } : tile),
        settlements: world.settlements.map((entry) => formalized.some((tileId) => entry.tileId === tileId) ? { ...entry, lastOwnerRealmId: entry.realmId, realmId: attacker.id, legalRealmId: attacker.id, occupationRealmId: undefined, loyalty: 28, resistance: 52 } : entry),
      }
    } else if (!attackerWon) {
      world = {
        ...world,
        tiles: world.tiles.map((tile) => occupied.includes(tile.id) ? { ...tile, controllerRealmId: defender.id, stateId: defender.id, controlStatus: 'frontier' as const, resistance: clamp((tile.resistance ?? 40) - 22) } : tile),
        settlements: world.settlements.map((entry) => captured.includes(entry.id) ? { ...entry, occupationRealmId: undefined, resistance: clamp((entry.resistance ?? 40) - 18) } : entry),
      }
    }
    const terms = formalized.length ? `${attacker.name} получает ${formalized.length} пограничных территорий.` : 'Стороны возвращаются к прежней границе.'
    events.push({ id: `politics-peace-${war.id}-${state.year}-${state.day}`, year: state.year, day: state.day, kind: 'peace', title: `Завершена ${war.name}`, description: `${terms} Потери: ${casualties.toLocaleString('ru-RU')}.`, realmIds: [attacker.id, defender.id], tileIds: formalized, settlementIds: captured, magnitude: 85 })
    return { ...war, status: 'ended' as const, progress: score, warScore: score, attackerSupply: round1(supplyA), defenderSupply: round1(supplyD), attackerExhaustion: round1(exhaustionA), defenderExhaustion: round1(exhaustionD), casualties, occupiedTileIds: occupied, capturedSettlementIds: captured, peaceTerms: terms, lastEvent: terms }
  })
  return { world, wars, events }
}

function maybeStartWar(state: GameState, world: WorldData, wars: WorldWar[], rng: RNG): { wars: WorldWar[]; event?: PoliticalEvent } {
  const active = wars.filter((war) => war.status !== 'ended')
  const limit = state.settings.warFrequency === 'frequent' ? Math.max(2, Math.ceil(world.realms.length / 3)) : state.settings.warFrequency === 'rare' ? 1 : 2
  if (active.length >= limit || state.day % 120 !== 0) return { wars }
  const chance = state.settings.warFrequency === 'frequent' ? .42 : state.settings.warFrequency === 'rare' ? .08 : .21
  if (!rng.bool(chance)) return { wars }
  const candidate = world.realms
    .filter((realm) => !realm.collapsedYear && realm.objective?.targetRealmId && !active.some((war) => [war.attackerRealmId, war.defenderRealmId].includes(realm.id)))
    .map((realm) => ({ realm, target: world.realms.find((entry) => entry.id === realm.objective?.targetRealmId), relation: realm.relations[realm.objective?.targetRealmId ?? ''] ?? 0 }))
    .filter((entry) => entry.target && entry.relation < -24 && !active.some((war) => [war.attackerRealmId, war.defenderRealmId].includes(entry.target!.id)))
    .sort((a, b) => a.relation - b.relation)[0]
  if (!candidate?.target || !candidate.realm.objective) return { wars }
  const target = candidate.target
  const fronts = frontTiles(candidate.realm.id, target.id, world)
  if (!fronts.length) return { wars }
  const war: WorldWar = {
    id: `war-${state.year}-${state.day}-${wars.length + 1}`,
    name: `${warTypeFor(candidate.realm.objective) === 'trade' ? 'Торговая война' : 'Пограничная война'}: ${candidate.realm.name} — ${target.name}`,
    attackerRealmId: candidate.realm.id,
    defenderRealmId: target.id,
    cause: candidate.realm.objective.reason,
    goal: candidate.realm.objective.title,
    type: warTypeFor(candidate.realm.objective),
    status: 'preparing',
    startedYear: state.year,
    startedDay: state.day,
    progress: 0,
    warScore: 0,
    attackerExhaustion: 0,
    defenderExhaustion: 0,
    attackerSupply: 80,
    defenderSupply: 80,
    frontSettlementIds: world.settlements.filter((entry) => fronts.some((tile) => tile.id === entry.tileId)).map((entry) => entry.id),
    frontTileIds: fronts.map((tile) => tile.id),
    capturedSettlementIds: [],
    occupiedTileIds: [],
    claimedSettlementIds: candidate.realm.objective.targetSettlementIds,
    casualties: 0,
    attackerArmyIds: world.armies.filter((army) => army.realmId === candidate.realm.id).map((army) => army.id),
    defenderArmyIds: world.armies.filter((army) => army.realmId === target.id).map((army) => army.id),
  }
  return {
    wars: [...wars, war],
    event: { id: `politics-war-start-${war.id}`, year: state.year, day: state.day, kind: 'war_started', title: `Начинается ${war.name}`, description: `${war.cause}. Цель: ${war.goal}.`, realmIds: [war.attackerRealmId, war.defenderRealmId], tileIds: war.frontTileIds ?? [], settlementIds: war.frontSettlementIds, magnitude: 80 },
  }
}

function refreshRealmState(world: WorldData, year: number, rng: RNG): WorldData {
  const tileMap = new Map(world.tiles.map((tile) => [tile.id, tile]))
  let settlements = world.settlements.map((settlement) => {
    const tile = tileMap.get(settlement.tileId)
    const occupied = Boolean(settlement.occupationRealmId)
    const loyalty = clamp((settlement.loyalty ?? 55) + (occupied ? -3.5 : 1.2) - settlement.unrest / 45)
    const resistance = clamp((settlement.resistance ?? 0) + (occupied ? 3 : -2))
    return { ...settlement, loyalty: round1(loyalty), resistance: round1(resistance), taxValue: round1(settlement.population * settlement.prosperity / 12000), garrison: Math.max(0, Math.round((settlement.garrison ?? 20) + (settlement.safety - 50) / 18)) }
  })
  let realms = world.realms.map((realm) => {
    if (realm.collapsedYear) return realm
    const owned = settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')
    const controlledTiles = world.tiles.filter((tile) => tile.controllerRealmId === realm.id && tile.biome !== 'ocean')
    const occupiedCapital = owned.find((entry) => entry.id === realm.capitalId)?.occupationRealmId
    const tax = owned.reduce((sum, entry) => sum + (entry.taxValue ?? 0) * (entry.loyalty ?? 50) / 100, 0)
    const frontierCost = controlledTiles.filter((tile) => ['frontier', 'contested', 'occupied'].includes(tile.controlStatus ?? '')).length * .45
    const treasury = Math.max(0, (realm.treasury ?? 0) + tax * 8 - frontierCost - realm.military * .4)
    const unrest = owned.length ? owned.reduce((sum, entry) => sum + entry.unrest, 0) / owned.length : 100
    const legitimacy = clamp((realm.legitimacy ?? 50) + (unrest < 35 ? .7 : -1.4) - (occupiedCapital ? 8 : 0))
    const stability = clamp(realm.stability + (legitimacy - 50) / 50 - Math.max(0, unrest - 55) / 30 - (occupiedCapital ? 6 : 0))
    const manpower = Math.max(0, Math.round(owned.reduce((sum, entry) => sum + entry.population, 0) * (.03 + realm.military / 5500)))
    return { ...realm, treasury: round1(treasury), legitimacy: round1(legitimacy), stability: round1(stability), manpower, cohesion: round1(clamp((realm.cohesion ?? 50) + (stability - 50) / 45)), objective: realm.objective && realm.objective.createdYear >= year - 8 ? realm.objective : chooseObjective(realm, world, rng) }
  })
  return { ...world, settlements, realms }
}

function updateTerritory(world: WorldData): WorldData {
  const tileMap = new Map(world.tiles.map((tile) => [tile.id, tile]))
  const settlements = world.settlements
  const tiles = world.tiles.map((tile) => {
    if (tile.biome === 'ocean' || !tile.controllerRealmId) return tile
    const realm = world.realms.find((entry) => entry.id === tile.controllerRealmId)
    if (!realm || realm.collapsedYear) return { ...tile, stateId: undefined, controllerRealmId: undefined, controlStrength: 0, controlStatus: 'unclaimed' as const, supplyAccess: 0 }
    const ownSettlements = settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')
    const supply = computeSupply(tile, realm.id, world, settlements, tileMap)
    const nearest = nearestSettlement(tile, ownSettlements, tileMap)
    const occupied = tile.legalRealmId !== tile.controllerRealmId
    const claimed = (tile.claimedByRealmIds ?? []).some((id) => id !== tile.controllerRealmId)
    const strength = clamp((tile.controlStrength ?? 45) + supply / 45 - nearest.distance * .18 - (tile.resistance ?? 0) / 38 - tile.danger / 8)
    const core = realm.coreTileIds?.includes(tile.id) ?? false
    return { ...tile, stateId: tile.controllerRealmId, supplyAccess: round1(supply), controlStrength: round1(strength), controlStatus: controlStatus(strength, core, occupied, claimed), resistance: round1(clamp((tile.resistance ?? 0) + (occupied ? 1.8 : -1.1))) }
  })
  return { ...world, tiles }
}


function refreshClaimsAndDiplomacy(world: WorldData, year: number, rng: RNG): WorldData {
  const tileById = new Map(world.tiles.map((tile) => [tile.id, tile]))
  const claimsByTile = new Map<string, Set<string>>()
  const realms = world.realms.map((realm) => {
    if (realm.collapsedYear) return realm
    const own = world.tiles.filter((tile) => tile.controllerRealmId === realm.id && tile.biome !== 'ocean')
    const candidates = new Map<string, WorldTile>()
    for (const tile of own) {
      for (const id of neighborIds(tile, world)) {
        const neighbor = tileById.get(id)
        if (!neighbor || neighbor.biome === 'ocean' || neighbor.controllerRealmId === realm.id) continue
        const strategic = Boolean(neighbor.settlementId) || neighbor.resourceRichness > 52 || neighbor.hasRiver || world.routes.some((route) => route.status === 'active' && route.tileIds.includes(neighbor.id))
        if (strategic) candidates.set(neighbor.id, neighbor)
      }
    }
    const claims = [...candidates.values()]
      .sort((a, b) => (b.resourceRichness + (b.settlementId ? 38 : 0) + (b.hasRiver ? 14 : 0)) - (a.resourceRichness + (a.settlementId ? 38 : 0) + (a.hasRiver ? 14 : 0)))
      .slice(0, Math.max(2, Math.min(12, Math.ceil(own.length / 12))))
    for (const tile of claims) {
      const set = claimsByTile.get(tile.id) ?? new Set<string>()
      set.add(realm.id)
      claimsByTile.set(tile.id, set)
    }
    return { ...realm, claimTileIds: claims.map((tile) => tile.id) }
  })
  const tiles = world.tiles.map((tile) => ({ ...tile, claimedByRealmIds: [...(claimsByTile.get(tile.id) ?? new Set<string>())] }))
  const provisional: WorldData = { ...world, realms, tiles }
  const updatedRealms = realms.map((realm) => {
    if (realm.collapsedYear) return realm
    const relations = Object.fromEntries(realms.filter((other) => other.id !== realm.id && !other.collapsedYear).map((other) => {
      const recalculated = relationFor(realm, other, provisional)
      const previous = realm.relations[other.id] ?? 0
      return [other.id, round1(clamp(previous * .72 + recalculated * .28, -100, 100))]
    }))
    const targetStillValid = realm.objective?.targetTileIds.some((id) => {
      const tile = tiles.find((entry) => entry.id === id)
      return tile && tile.controllerRealmId !== realm.id
    })
    const objective = realm.objective && realm.objective.createdYear >= year - 8 && targetStillValid
      ? { ...realm.objective, progress: round1(clamp(realm.objective.progress + rng.float(-2, 5))) }
      : chooseObjective({ ...realm, relations }, provisional, rng)
    return { ...realm, relations, objective }
  })
  return { ...provisional, realms: updatedRealms, politics: { ...provisional.politics, activeClaims: tiles.reduce((sum, tile) => sum + (tile.claimedByRealmIds?.length ?? 0), 0) } }
}

function maybeFoundRealm(state: GameState, world: WorldData, armies: RealmArmy[], rng: RNG): { world: WorldData; armies: RealmArmy[]; event?: PoliticalEvent } {
  if (state.day !== 360) return { world, armies }
  const realmById = new Map(world.realms.map((realm) => [realm.id, realm]))
  const candidates = world.settlements
    .filter((settlement) => settlement.status !== 'ruined')
    .filter((settlement) => {
      const realm = realmById.get(settlement.realmId)
      const tile = world.tiles.find((entry) => entry.id === settlement.tileId)
      return (!realm || realm.collapsedYear || !tile?.controllerRealmId) && settlement.population >= 1200 && settlement.prosperity >= 34 && settlement.safety >= 28
    })
    .sort((a, b) => (b.population * b.prosperity) - (a.population * a.prosperity))
  const capital = candidates[0]
  if (!capital || !rng.bool(.38)) return { world, armies }
  const capitalTile = world.tiles.find((tile) => tile.id === capital.tileId)
  if (!capitalTile) return { world, armies }
  const culture = world.cultures.find((entry) => entry.id === capital.cultureId)
  const id = `realm-founded-${capital.id}-${state.year}`
  const colorHue = Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0) * 7, 0)) % 360
  const realm: Realm = {
    id,
    name: `${rng.pick(['Княжество', 'Союз', 'Вольная земля', 'Городская лига'])} ${capital.name}`,
    government: capital.tradeAccess > 62 ? 'городская республика' : capital.kind === 'monastery' ? 'храмовое княжество' : 'княжество',
    governmentType: capital.tradeAccess > 62 ? 'городская республика' : capital.kind === 'monastery' ? 'храмовое княжество' : 'княжество',
    capitalId: capital.id,
    color: `hsl(${colorHue} 48% 42%)`,
    culture: culture?.name ?? 'местная культура',
    ruler: `Совет ${capital.name}`,
    attitude: 0,
    wealth: clamp(capital.prosperity * .82),
    military: clamp(22 + capital.safety * .45),
    stability: 44,
    description: `Государство возникло вокруг ${capital.name} после распада прежней власти.`,
    dominantFaith: culture?.religion ?? 'местные культы',
    currentIssue: 'добиться признания границ и собрать налоги',
    relations: Object.fromEntries(world.realms.filter((entry) => !entry.collapsedYear).map((entry) => [entry.id, -8])),
    foundedYear: state.year,
    legitimacy: 38,
    taxCapacity: 32,
    administrativeReach: 34,
    warExhaustion: 0,
    treasury: Math.max(180, Math.round(capital.population * capital.prosperity / 500)),
    manpower: Math.max(300, Math.round(capital.population * .045)),
    cohesion: 46,
    coreTileIds: [],
    claimTileIds: [],
    subjectRealmIds: [],
  }
  const territoryIds = world.tiles.filter((tile) => tile.biome !== 'ocean' && distance(tile, capitalTile) <= 3.4 && (!tile.controllerRealmId || realmById.get(tile.controllerRealmId)?.collapsedYear)).map((tile) => tile.id)
  const settlements = world.settlements.map((settlement) => territoryIds.includes(settlement.tileId) && (!realmById.get(settlement.realmId) || realmById.get(settlement.realmId)?.collapsedYear) ? { ...settlement, realmId: id, legalRealmId: id, occupationRealmId: undefined, loyalty: 52, resistance: 8 } : settlement)
  const tiles = world.tiles.map((tile) => territoryIds.includes(tile.id) ? { ...tile, stateId: id, controllerRealmId: id, legalRealmId: id, controlStatus: distance(tile, capitalTile) <= 2 ? 'core' as const : 'frontier' as const, controlStrength: 48, supplyAccess: 45, resistance: 6 } : tile)
  let nextWorld: WorldData = { ...world, realms: [...world.realms, realm], settlements, tiles }
  const objective = chooseObjective(realm, nextWorld, rng)
  nextWorld = { ...nextWorld, realms: nextWorld.realms.map((entry) => entry.id === id ? { ...entry, objective, coreTileIds: territoryIds.filter((tileId) => {
    const tile = tiles.find((candidate) => candidate.id === tileId)
    return tile ? distance(tile, capitalTile) <= 2 : false
  }) } : entry) }
  const createdRealm = nextWorld.realms.find((entry) => entry.id === id)!
  const army = createArmy(state.seed, createdRealm, 0, settlements.filter((entry) => entry.realmId === id), nextWorld)
  const event: PoliticalEvent = {
    id: `politics-founded-${id}`,
    year: state.year,
    day: state.day,
    kind: 'realm_founded',
    title: `Основано государство ${createdRealm.name}`,
    description: `${capital.name} собрал соседние поселения и объявил новую власть. Контролируемых территорий: ${territoryIds.length}.`,
    realmIds: [id],
    tileIds: territoryIds,
    settlementIds: settlements.filter((entry) => entry.realmId === id).map((entry) => entry.id),
    magnitude: 90,
  }
  return { world: nextWorld, armies: [...armies, army], event }
}

function collapseRealm(state: GameState, world: WorldData, armies: RealmArmy[], rng: RNG): { world: WorldData; armies: RealmArmy[]; event?: PoliticalEvent } {
  if (state.day !== 360) return { world, armies }
  const candidate = world.realms.find((realm) => {
    if (realm.collapsedYear) return false
    const settlements = world.settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')
    const capital = settlements.find((entry) => entry.id === realm.capitalId)
    return settlements.length === 0 || ((realm.legitimacy ?? 50) < 12 && realm.stability < 14) || Boolean(capital?.occupationRealmId && realm.stability < 24)
  })
  if (!candidate) return { world, armies }
  const remaining = world.settlements.filter((entry) => entry.realmId === candidate.id && entry.status !== 'ruined' && !entry.occupationRealmId).sort((a, b) => b.population - a.population)
  const successorCapital = remaining[0]
  if (!successorCapital) {
    const event: PoliticalEvent = { id: `politics-collapse-${candidate.id}-${state.year}`, year: state.year, day: state.day, kind: 'realm_collapsed', title: `Распалось государство ${candidate.name}`, description: 'Последние управляемые поселения потеряны. Земли стали ничейными или заняты соседями.', realmIds: [candidate.id], tileIds: world.tiles.filter((tile) => tile.legalRealmId === candidate.id).map((tile) => tile.id), settlementIds: [], magnitude: 100 }
    return { world: { ...world, realms: world.realms.map((realm) => realm.id === candidate.id ? { ...realm, collapsedYear: state.year, stability: 0, legitimacy: 0, government: 'распавшееся государство' } : realm), tiles: world.tiles.map((tile) => tile.controllerRealmId === candidate.id ? { ...tile, stateId: undefined, controllerRealmId: undefined, controlStatus: 'unclaimed' as const, controlStrength: 0 } : tile) }, armies: armies.filter((army) => army.realmId !== candidate.id), event }
  }
  const capitalTile = world.tiles.find((tile) => tile.id === successorCapital.tileId)!
  const successorId = `realm-successor-${candidate.id}-${state.year}`
  const successor: Realm = {
    ...candidate,
    id: successorId,
    name: `${rng.pick(['Свободное княжество', 'Новый союз', 'Вольная земля'])} ${successorCapital.name}`,
    capitalId: successorCapital.id,
    ruler: `Совет ${successorCapital.name}`,
    government: 'временный союз городов',
    governmentType: 'временный союз городов',
    foundedYear: state.year,
    stability: 38,
    legitimacy: 34,
    treasury: Math.max(120, (candidate.treasury ?? 0) * .25),
    manpower: Math.max(300, Math.round((candidate.manpower ?? 0) * .3)),
    military: Math.max(18, candidate.military * .55),
    wealth: Math.max(20, candidate.wealth * .65),
    collapsedYear: undefined,
    coreTileIds: [],
    claimTileIds: [],
    relations: Object.fromEntries(world.realms.filter((realm) => realm.id !== candidate.id).map((realm) => [realm.id, -5])),
    objective: undefined,
  }
  const successorTiles = world.tiles.filter((tile) => tile.legalRealmId === candidate.id && distance(tile, capitalTile) <= 4.2).map((tile) => tile.id)
  let nextWorld: WorldData = {
    ...world,
    realms: [...world.realms.map((realm) => realm.id === candidate.id ? { ...realm, collapsedYear: state.year, stability: 0, legitimacy: 0, government: 'распавшееся государство' } : realm), successor],
    settlements: world.settlements.map((entry) => entry.realmId === candidate.id && successorTiles.includes(entry.tileId) ? { ...entry, realmId: successorId, legalRealmId: successorId, loyalty: 48, resistance: 12 } : entry),
    tiles: world.tiles.map((tile) => successorTiles.includes(tile.id) ? { ...tile, stateId: successorId, controllerRealmId: successorId, legalRealmId: successorId, controlStatus: distance(tile, capitalTile) <= 2.2 ? 'core' as const : 'frontier' as const, controlStrength: 45, resistance: 8 } : tile.controllerRealmId === candidate.id ? { ...tile, stateId: undefined, controllerRealmId: undefined, controlStatus: 'unclaimed' as const, controlStrength: 0 } : tile),
  }
  nextWorld = initializePolitics(state.seed, { ...nextWorld, armies: [], politics: nextWorld.politics }, state.settings, state.year)
  const successorArmies = nextWorld.armies.filter((army) => army.realmId === successorId)
  const event: PoliticalEvent = { id: `politics-successor-${candidate.id}-${state.year}`, year: state.year, day: state.day, kind: 'realm_collapsed', title: `${candidate.name} распадается`, description: `${successorCapital.name} объявляет новый союз. Остальные провинции остаются без признанной власти.`, realmIds: [candidate.id, successorId], tileIds: successorTiles, settlementIds: [successorCapital.id], magnitude: 100 }
  return { world: nextWorld, armies: [...armies.filter((army) => army.realmId !== candidate.id), ...successorArmies], event }
}

export function politicsMonthTick(state: GameState, preferences: AppPreferences): GameState {
  if (state.day % 30 !== 0) return state
  const rng = new RNG(`${state.seed}:politics:${state.year}:${state.day}`)
  let world = ensurePolitics(state.seed, state.world, state.settings, state.year)
  world = refreshRealmState(world, state.year, rng)
  if (state.day === 360) world = refreshClaimsAndDiplomacy(world, state.year, rng)
  world = updateTerritory(world)
  let wars = state.wars
  let armies = updateArmies({ ...state, world }, wars, rng)
  const processed = preferences.warsEnabled ? processWars({ ...state, world }, armies, rng, preferences) : { world: { ...world, armies }, wars, events: [] as PoliticalEvent[] }
  world = processed.world
  wars = processed.wars
  const started = preferences.warsEnabled ? maybeStartWar(state, world, wars, rng) : { wars }
  wars = started.wars
  const events = [...processed.events, ...(started.event ? [started.event] : [])]
  const collapsed = collapseRealm(state, world, armies, rng)
  world = collapsed.world
  armies = collapsed.armies
  if (collapsed.event) events.push(collapsed.event)
  const founded = maybeFoundRealm(state, world, armies, rng)
  world = founded.world
  armies = founded.armies
  if (founded.event) events.push(founded.event)
  const politics: PoliticalSimulationState = {
    ...world.politics,
    lastTickYear: state.year,
    lastTickDay: state.day,
    borderChanges: world.politics.borderChanges + events.filter((event) => event.kind === 'border_shift').length,
    occupations: world.politics.occupations + events.filter((event) => event.kind === 'occupation').length,
    warsStarted: world.politics.warsStarted + (started.event ? 1 : 0),
    warsEnded: world.politics.warsEnded + events.filter((event) => event.kind === 'peace').length,
    realmCollapses: world.politics.realmCollapses + events.filter((event) => event.kind === 'realm_collapsed').length,
    activeClaims: world.tiles.reduce((sum, tile) => sum + (tile.claimedByRealmIds?.length ?? 0), 0),
    recentEvents: [...world.politics.recentEvents, ...events].slice(-160),
  }
  world = { ...world, armies, politics, history: [...world.history, ...events.map(createPoliticalHistory)].slice(-1100) }
  return {
    ...state,
    world,
    wars,
    chronicle: [...state.chronicle, ...events.filter((event) => event.magnitude >= 60).map((event) => ({ id: `chronicle-${event.id}`, year: event.year, day: event.day, title: event.title, text: event.description, category: 'world' as const, importance: Math.max(3, Math.min(5, Math.ceil(event.magnitude / 20))) }))].slice(-1200),
  }
}

export function politicsSummary(world: WorldData, wars: WorldWar[]) {
  const livingRealms = world.realms.filter((realm) => !realm.collapsedYear)
  const controlled = world.tiles.filter((tile) => tile.controlStatus && tile.controlStatus !== 'unclaimed' && tile.biome !== 'ocean')
  return {
    realms: livingRealms.length,
    activeWars: wars.filter((war) => war.status !== 'ended').length,
    armies: world.armies.filter((army) => army.status !== 'broken').length,
    soldiers: world.armies.reduce((sum, army) => sum + army.soldiers, 0),
    contestedTiles: controlled.filter((tile) => tile.controlStatus === 'contested' || tile.controlStatus === 'occupied').length,
    averageControl: controlled.length ? controlled.reduce((sum, tile) => sum + (tile.controlStrength ?? 0), 0) / controlled.length : 0,
    averageSupply: controlled.length ? controlled.reduce((sum, tile) => sum + (tile.supplyAccess ?? 0), 0) / controlled.length : 0,
  }
}
