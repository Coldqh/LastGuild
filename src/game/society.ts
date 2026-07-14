import type {
  BiomeId,
  CultureProfile,
  GameState,
  HistoricalEvent,
  PeopleGroup,
  PopulationCommunity,
  ResourceKind,
  Settlement,
  SettlementSpecialization,
  SocietyEvent,
  SocietyState,
  WorldData,
  WorldGenerationSettings,
  WorldTile,
} from '../types/game'
import { RNG } from './rng'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const round1 = (value: number) => Math.round(value * 10) / 10
const START_YEAR = 912

const VALUE_POOL = ['родовая память', 'гостеприимство', 'ремесло', 'личная честь', 'учёность', 'договоры', 'воинская служба', 'священные места']
const TABOO_POOL = ['осквернение могил', 'охота в священный сезон', 'нарушение клятвы гостя', 'продажа родовой земли', 'магия без свидетелей', 'рубка древних деревьев']
const RESOURCE_LABELS: Record<ResourceKind, string> = {
  fresh_water: 'вода', fertile_soil: 'плодородная земля', timber: 'древесина', game: 'дичь', fish: 'рыба', stone: 'камень', iron: 'железо', salt: 'соль', herbs: 'травы', crystal: 'кристаллы', obsidian: 'обсидиан',
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

function tileDistance(a: WorldTile, b: WorldTile): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 1.12)
}

function ancestryForBiome(biome: BiomeId, rng: RNG): string {
  if (biome === 'mountains' || biome === 'hills') return rng.pick(['Дворф', 'Человек', 'Гном'])
  if (biome === 'forest' || biome === 'ancient_forest') return rng.pick(['Эльф', 'Человек', 'Полурослик'])
  if (biome === 'swamp') return rng.pick(['Человек', 'Полуорк', 'Тифлинг'])
  if (biome === 'ashlands') return rng.pick(['Тифлинг', 'Драконорождённый', 'Человек'])
  if (biome === 'desert') return rng.pick(['Человек', 'Тифлинг', 'Драконорождённый'])
  if (biome === 'tundra') return rng.pick(['Человек', 'Полуорк', 'Дворф'])
  return rng.pick(['Человек', 'Полурослик', 'Полуорк'])
}

function subsistenceForBiome(biome: BiomeId): string {
  if (biome === 'coast') return 'рыболовство и каботажная торговля'
  if (biome === 'plains') return 'земледелие и скотоводство'
  if (biome === 'forest' || biome === 'ancient_forest') return 'лесные промыслы и охота'
  if (biome === 'hills' || biome === 'mountains') return 'горное ремесло и пастбища'
  if (biome === 'swamp') return 'рыболовство, травничество и болотные промыслы'
  if (biome === 'desert') return 'караваны и скотоводство у источников'
  if (biome === 'tundra') return 'сезонная охота и кочевое животноводство'
  if (biome === 'ashlands') return 'добыча редких минералов и защищённые оазисы'
  return 'смешанное хозяйство'
}

function architectureForBiome(biome: BiomeId): string {
  if (biome === 'mountains' || biome === 'hills') return 'каменные дома, террасы и укреплённые проходы'
  if (biome === 'forest' || biome === 'ancient_forest') return 'дерево, высокие крыши и поселения среди старых рощ'
  if (biome === 'swamp') return 'свайные дома, настилы и каналы'
  if (biome === 'desert' || biome === 'ashlands') return 'толстые стены, внутренние дворы и закрытые водохранилища'
  if (biome === 'coast') return 'каменные набережные, склады и маячные башни'
  if (biome === 'tundra') return 'низкие утеплённые дома и общие залы'
  return 'деревянные кварталы, амбары и земляные укрепления'
}

function resourceKindsFor(world: WorldData, tileIds: string[]): ResourceKind[] {
  const totals = new Map<ResourceKind, number>()
  for (const deposit of world.resourceDeposits) {
    if (!tileIds.includes(deposit.tileId)) continue
    totals.set(deposit.kind, (totals.get(deposit.kind) ?? 0) + deposit.abundance * deposit.accessibility / 100)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([kind]) => kind)
}

function dominantBiome(world: WorldData, tileIds: string[], fallback: BiomeId = 'plains'): BiomeId {
  const counts = new Map<BiomeId, number>()
  for (const id of tileIds) {
    const tile = world.tiles.find((entry) => entry.id === id)
    if (!tile || tile.biome === 'ocean') continue
    counts.set(tile.biome, (counts.get(tile.biome) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback
}

function specializationFor(world: WorldData, settlement: Settlement, tile: WorldTile): SettlementSpecialization {
  if (settlement.kind === 'fortress') return 'fortress'
  if (settlement.kind === 'monastery') return 'religious'
  if (tile.magic > 0.78) return 'arcane'
  const deposits = world.resourceDeposits.filter((entry) => entry.tileId === tile.id).sort((a, b) => b.abundance - a.abundance)
  const best = deposits[0]?.kind
  if (best === 'fertile_soil' || best === 'fresh_water' || tile.soilFertility > 68) return 'farming'
  if (best === 'fish' || tile.biome === 'coast') return 'fishing'
  if (best === 'iron' || best === 'stone' || best === 'obsidian') return 'mining'
  if (best === 'timber' || tile.biome === 'forest' || tile.biome === 'ancient_forest') return 'forestry'
  const routeCount = world.routes.filter((route) => route.tileIds.includes(tile.id) && route.type !== 'river').length
  if (routeCount > 1 || settlement.kind === 'capital' || settlement.kind === 'city') return 'trade'
  return settlement.kind === 'town' ? 'craft' : 'subsistence'
}

function originReasonFor(specialization: SettlementSpecialization, tile: WorldTile): string {
  if (specialization === 'farming') return tile.hasRiver ? 'основано у реки и плодородных пойм' : 'основано на плодородной земле'
  if (specialization === 'fishing') return 'основано у богатых рыбой вод'
  if (specialization === 'mining') return 'основано возле доступных залежей камня и руды'
  if (specialization === 'forestry') return 'основано ради лесных промыслов и древесины'
  if (specialization === 'trade') return tile.hasRiver ? 'основано у переправы и торгового пути' : 'основано на пересечении дорог'
  if (specialization === 'fortress') return 'основано для контроля границы и прохода'
  if (specialization === 'religious') return 'основано у почитаемого места'
  if (specialization === 'arcane') return 'основано возле устойчивого магического источника'
  if (specialization === 'craft') return 'выросло из ремесленного посада'
  return 'основано как постоянное поселение местных общин'
}

function createCulture(seed: string, world: WorldData, realmId: string, peopleId: string, name: string, tileIds: string[], formedYear: number): CultureProfile {
  const rng = new RNG(`${seed}:culture:${realmId}`)
  const biome = dominantBiome(world, tileIds)
  const resources = resourceKindsFor(world, tileIds)
  return {
    id: `culture-${realmId}`,
    name,
    peopleId,
    originBiome: biome,
    subsistence: subsistenceForBiome(biome),
    architecture: architectureForBiome(biome),
    dress: biome === 'tundra' || biome === 'mountains' ? 'слоёная шерсть, мех и плотные плащи' : biome === 'desert' || biome === 'ashlands' ? 'закрытая лёгкая одежда и защитные повязки' : biome === 'coast' ? 'пропитанные плащи и рабочая парусина' : 'лён, шерсть и местные украшения',
    militaryTradition: biome === 'mountains' || biome === 'hills' ? 'оборона проходов и тяжёлая пехота' : biome === 'forest' || biome === 'ancient_forest' ? 'засады, разведка и дальний бой' : biome === 'plains' ? 'ополчение, конные дозоры и полевые укрепления' : 'малые мобильные отряды и защита поселений',
    religion: rng.pick(['культ предков', 'почитание местных духов', 'храмовая вера городов', 'обеты хранителей путей', 'поклонение небесным светилам']),
    magicAttitude: rng.pick(['магия под надзором', 'магия считается ремеслом', 'магия связана с религиозными обрядами', 'опасная магия запрещена', 'магия воспринимается как часть природы']),
    monsterPolicy: biome === 'ancient_forest' ? 'избегают логов и заключают локальные договоры' : rng.pick(['организуют сезонные охоты', 'платят профессиональным охотникам', 'укрепляют дороги и не преследуют вдали', 'считают крупных чудовищ дурными знамениями']),
    values: rng.shuffle(VALUE_POOL).slice(0, 3),
    taboos: rng.shuffle(TABOO_POOL).slice(0, 2),
    valuedResources: resources.length ? resources : ['fresh_water', 'fertile_soil'],
    settlementStyle: architectureForBiome(biome),
    language: `${name.replace(/ая$|яя$|ская$|цкая$/u, '').trim()}ский говор`,
    formedYear,
    parentCultureIds: [],
  }
}

function createInitialSociety(seed: string, input: WorldData, currentYear: number): WorldData {
  const rng = new RNG(`${seed}:society:init`)
  const peoples: PeopleGroup[] = []
  const cultures: CultureProfile[] = []
  const realmCulture = new Map<string, { people: PeopleGroup; culture: CultureProfile }>()

  for (const realm of input.realms) {
    const realmTiles = input.tiles.filter((tile) => tile.stateId === realm.id && tile.biome !== 'ocean')
    const settlementTiles = input.settlements.filter((entry) => entry.realmId === realm.id).map((entry) => entry.tileId)
    const homeland = (settlementTiles.length ? settlementTiles : realmTiles.map((entry) => entry.id)).slice(0, 12)
    const biome = dominantBiome(input, homeland)
    const peopleId = `people-${realm.id}`
    const culture = createCulture(seed, input, realm.id, peopleId, realm.culture, homeland, Math.max(20, currentYear - rng.int(180, 620)))
    const population = input.settlements.filter((entry) => entry.realmId === realm.id).reduce((sum, entry) => sum + entry.population, 0)
    const people: PeopleGroup = {
      id: peopleId,
      name: `Народ ${realm.name}`,
      ancestry: ancestryForBiome(biome, rng),
      population,
      homelandTileIds: homeland,
      cultureId: culture.id,
      subsistence: culture.subsistence,
      climateAdaptation: biome === 'tundra' || biome === 'mountains' ? 'холод и короткий сезон' : biome === 'desert' || biome === 'ashlands' ? 'жара и нехватка воды' : biome === 'swamp' ? 'сырость и болезни' : 'умеренный климат',
      magicAttitude: culture.magicAttitude,
      migrationPressure: rng.int(5, 24),
      health: rng.int(58, 82),
      relations: { ...realm.relations },
      foundedYear: culture.formedYear,
      status: 'stable',
    }
    peoples.push(people)
    cultures.push(culture)
    realmCulture.set(realm.id, { people, culture })
  }

  const tiles: WorldTile[] = input.tiles.map((tile) => ({ ...tile, dominantPeopleId: undefined, dominantCultureId: undefined, populationDensity: 0, migrationPressure: 0 }))
  const tileMap = new Map(tiles.map((tile) => [tile.id, tile]))
  const settlements = input.settlements.map((settlement) => {
    const tile = tileMap.get(settlement.tileId)!
    const assigned = realmCulture.get(settlement.realmId) ?? realmCulture.values().next().value
    if (!assigned) throw new Error('Society initialization requires at least one realm')
    const specialization = specializationFor(input, settlement, tile)
    const routeCount = input.routes.filter((route) => route.tileIds.includes(tile.id) && route.type !== 'river').length
    const waterSecurity = clamp(tile.waterAvailability + (tile.hasRiver ? 16 : 0) - settlement.population / 12000)
    const materials = clamp(tile.resourceRichness * 0.65 + input.resourceDeposits.filter((entry) => entry.tileId === tile.id && ['timber', 'stone', 'iron'].includes(entry.kind)).reduce((sum, entry) => sum + entry.abundance * 0.12, 0))
    const housing = clamp(48 + settlement.prosperity * 0.38 - settlement.population / 2600)
    const sanitation = clamp(34 + waterSecurity * 0.34 + settlement.prosperity * 0.22 - settlement.population / 3500)
    const tradeAccess = clamp(routeCount * 25 + (settlement.kind === 'capital' ? 28 : settlement.kind === 'city' ? 18 : 0))
    tile.dominantPeopleId = assigned.people.id
    tile.dominantCultureId = assigned.culture.id
    tile.populationDensity = round1(settlement.population / Math.max(1, 100 + tile.travelCost * 80))
    return {
      ...settlement,
      peopleId: assigned.people.id,
      cultureId: assigned.culture.id,
      cultureShares: { [assigned.culture.id]: 100 },
      originReason: originReasonFor(specialization, tile),
      specialization,
      waterSecurity: round1(waterSecurity),
      housing: round1(housing),
      materials: round1(materials),
      labor: round1(clamp(58 + settlement.population / 2500 - settlement.unrest * 0.25)),
      sanitation: round1(sanitation),
      tradeAccess: round1(tradeAccess),
      migrationPressure: round1(clamp((50 - settlement.foodSecurity) * 0.55 + (50 - waterSecurity) * 0.45 + settlement.unrest * 0.22)),
    }
  })

  const communities: PopulationCommunity[] = settlements.map((settlement) => ({
    id: `community-${settlement.id}`,
    peopleId: settlement.peopleId,
    cultureId: settlement.cultureId,
    tileId: settlement.tileId,
    settlementId: settlement.id,
    amount: settlement.population,
    health: round1(clamp((settlement.foodSecurity + settlement.waterSecurity + settlement.sanitation) / 3)),
    foodSecurity: settlement.foodSecurity,
    waterSecurity: settlement.waterSecurity,
    housing: settlement.housing,
    migrationPressure: settlement.migrationPressure,
    status: 'settled',
    lastChange: 0,
  }))

  const society: SocietyState = {
    initializedYear: currentYear,
    lastTickYear: currentYear,
    totalPopulation: settlements.reduce((sum, entry) => sum + entry.population, 0),
    migrations: 0,
    foundations: 0,
    abandonments: 0,
    culturalBlends: 0,
    recentEvents: [],
  }
  return { ...input, tiles, settlements, peoples, cultures, communities, society }
}

function settlementScore(world: WorldData, tile: WorldTile): number {
  if (tile.biome === 'ocean' || tile.biome === 'mountains' || tile.biome === 'ashlands') return -999
  const threats = world.ecologyPopulations.filter((entry) => entry.tileId === tile.id).reduce((sum, entry) => {
    const species = world.ecologySpecies.find((candidate) => candidate.id === entry.speciesId)
    return sum + (species && (species.kind === 'predator' || species.kind === 'monster') ? entry.amount * species.danger : 0)
  }, 0)
  return tile.waterAvailability * 0.34 + tile.soilFertility * 0.26 + tile.vegetation * 0.14 + tile.resourceRichness * 0.12 + tile.ecosystemHealth * 0.14 - tile.slope * 0.25 - threats * 0.04
}

function updateCultureShares(shares: Record<string, number>, cultureId: string, arriving: number, currentPopulation: number): Record<string, number> {
  const total = Math.max(1, currentPopulation + arriving)
  const result: Record<string, number> = {}
  for (const [id, share] of Object.entries(shares)) result[id] = share * currentPopulation / total
  result[cultureId] = (result[cultureId] ?? 0) + arriving / total * 100
  const sum = Object.values(result).reduce((a, b) => a + b, 0) || 1
  for (const id of Object.keys(result)) result[id] = round1(result[id] / sum * 100)
  return result
}

function blendedCulture(seed: string, cultures: CultureProfile[], settlement: Settlement, year: number): CultureProfile | undefined {
  const shares = Object.entries(settlement.cultureShares).sort((a, b) => b[1] - a[1])
  if (shares.length < 2 || shares[1][1] < 24) return undefined
  const parents = shares.slice(0, 2).map(([id]) => cultures.find((entry) => entry.id === id)).filter((entry): entry is CultureProfile => Boolean(entry))
  if (parents.length < 2) return undefined
  const pairId = parents.map((entry) => entry.id).sort().join('-')
  if (cultures.some((entry) => entry.parentCultureIds.slice().sort().join('-') === pairId)) return undefined
  const rng = new RNG(`${seed}:blend:${pairId}:${year}`)
  return {
    ...parents[0],
    id: `culture-mixed-${year}-${settlement.id}`,
    name: `${parents[0].name.split(' ')[0]}-${parents[1].name.split(' ')[0]}ская`,
    peopleId: settlement.peopleId,
    architecture: `${parents[0].architecture}; заметны ${parents[1].architecture}`,
    religion: rng.pick([parents[0].religion, parents[1].religion, `смешение: ${parents[0].religion} и ${parents[1].religion}`]),
    values: [...new Set([...parents[0].values.slice(0, 2), ...parents[1].values.slice(0, 2)])].slice(0, 3),
    taboos: [...new Set([...parents[0].taboos.slice(0, 1), ...parents[1].taboos.slice(0, 1)])],
    valuedResources: [...new Set([...parents[0].valuedResources, ...parents[1].valuedResources])].slice(0, 3),
    formedYear: year,
    parentCultureIds: parents.map((entry) => entry.id),
  }
}

function settlementCapacity(settlement: Settlement, tile: WorldTile, foodSecurity: number, waterSecurity: number, housing: number, tradeAccess: number): number {
  const baseByKind: Record<Settlement['kind'], number> = {
    village: 3200,
    town: 17000,
    city: 52000,
    capital: 105000,
    fortress: 9000,
    monastery: 6500,
  }
  const environment = .55 + foodSecurity / 250 + waterSecurity / 280 + housing / 300 + tradeAccess / 450
  const terrain = tile.biome === 'plains' || tile.biome === 'coast' ? 1.12 : tile.biome === 'mountains' || tile.biome === 'swamp' || tile.biome === 'ashlands' ? .76 : .94
  return Math.max(450, Math.round(baseByKind[settlement.kind] * environment * terrain))
}

function advanceSocietyYear(input: WorldData, seed: string, settings: WorldGenerationSettings, year: number): WorldData {
  const rng = new RNG(`${seed}:society:${year}`)
  const tileMap = new Map(input.tiles.map((tile) => [tile.id, tile]))
  const routeTiles = new Set(input.routes.filter((route) => route.status !== 'abandoned').flatMap((route) => route.tileIds))
  const events: SocietyEvent[] = []
  let settlements = input.settlements.map((settlement) => ({ ...settlement, cultureShares: { ...settlement.cultureShares } }))
  let communities = input.communities.map((community) => ({ ...community }))
  let cultures = [...input.cultures]
  let foundations = 0
  let abandonments = 0
  let migrations = 0
  let culturalBlends = 0
  const migrants: Array<{ from: Settlement; peopleId: string; cultureId: string; amount: number }> = []

  settlements = settlements.map((settlement) => {
    if (settlement.foundedYear > year) return settlement
    if (settlement.status === 'ruined') return settlement
    const tile = tileMap.get(settlement.tileId)
    if (!tile) return settlement
    const neighbors = [tile.id, ...neighborIds(tile, input)]
    const localFood = neighbors.reduce((sum, id) => {
      const entry = tileMap.get(id)
      return sum + (entry ? entry.soilFertility * 0.42 + entry.vegetation * 0.28 + entry.waterAvailability * 0.18 : 0)
    }, 0) / Math.max(1, neighbors.length)
    const localThreat = neighbors.reduce((sum, id) => sum + input.ecologyPopulations.filter((entry) => entry.tileId === id).reduce((inner, population) => {
      const species = input.ecologySpecies.find((candidate) => candidate.id === population.speciesId)
      return inner + (species && (species.kind === 'predator' || species.kind === 'monster') ? population.amount * species.danger : 0)
    }, 0), 0) / Math.max(1, neighbors.length)
    const routeAccess = routeTiles.has(tile.id) ? 62 : settlement.tradeAccess * 0.96
    const foodSecurity = clamp(settlement.foodSecurity * 0.62 + localFood * 0.38 - settlement.population / 18000)
    const waterSecurity = clamp(settlement.waterSecurity * 0.64 + tile.waterAvailability * 0.36 - settlement.population / 24000)
    const materials = clamp(settlement.materials * 0.78 + tile.resourceRichness * 0.22)
    const housing = clamp(settlement.housing + (materials - 48) * 0.035 + settlement.prosperity * 0.012 - settlement.population / 90000)
    const sanitation = clamp(settlement.sanitation + (waterSecurity - 48) * 0.025 - settlement.population / 120000 + (settlement.kind === 'capital' ? 0.3 : 0))
    const safety = clamp(settlement.safety + (5 - localThreat / 22) * 0.18)
    const prosperity = clamp(settlement.prosperity + (routeAccess - 45) * 0.025 + (foodSecurity - 50) * 0.018 - settlement.unrest * 0.008)
    const health = (foodSecurity + waterSecurity + sanitation + safety) / 4
    const capacity = settlementCapacity(settlement, tile, foodSecurity, waterSecurity, housing, routeAccess)
    const capacityRatio = settlement.population / Math.max(1, capacity)
    const naturalGrowth = (health - 50) / 1550 + (prosperity - 50) / 2700
    const capacityPressure = capacityRatio > .72 ? (capacityRatio - .72) * .055 : 0
    const growthRate = clamp(naturalGrowth - capacityPressure, -0.065, settings.cityGrowth === 'fast' ? 0.024 : settings.cityGrowth === 'slow' ? 0.009 : 0.016)
    const population = Math.max(0, Math.round(settlement.population * (1 + growthRate)))
    const migrationPressure = clamp((48 - foodSecurity) * 0.72 + (46 - waterSecurity) * 0.75 + (42 - safety) * 0.58 + settlement.unrest * 0.3 + Math.max(0, population - capacity * .9) / Math.max(90, capacity / 45))
    const outflow = migrationPressure > 58 && population > 180 ? Math.max(10, Math.round(population * clamp((migrationPressure - 48) / 620, 0.015, 0.12))) : 0
    if (outflow > 0) {
      migrants.push({ from: settlement, peopleId: settlement.peopleId, cultureId: settlement.cultureId, amount: outflow })
      migrations += 1
    }
    const remaining = Math.max(0, population - outflow)
    const status = remaining < 70 || (foodSecurity < 8 && waterSecurity < 12) ? 'ruined' as const : remaining < 650 || prosperity < 18 ? 'declining' as const : 'active' as const
    if (status === 'ruined') {
      abandonments += 1
      events.push({ id: `society-abandoned-${settlement.id}-${year}`, year, kind: 'settlement_abandoned', title: `${settlement.name} покинуто`, description: `${settlement.name} потеряло жителей из-за нехватки пищи, воды или безопасности.`, tileIds: [settlement.tileId], settlementIds: [settlement.id], peopleIds: [settlement.peopleId], cultureIds: [settlement.cultureId], magnitude: clamp(100 - health) })
    } else if (growthRate > 0.012 && remaining > settlement.population * 1.01) {
      events.push({ id: `society-growth-${settlement.id}-${year}`, year, kind: 'population_growth', title: `${settlement.name} растёт`, description: `Население увеличилось до ${remaining.toLocaleString('ru-RU')} благодаря устойчивому снабжению.`, tileIds: [settlement.tileId], settlementIds: [settlement.id], peopleIds: [settlement.peopleId], cultureIds: [settlement.cultureId], magnitude: clamp(growthRate * 900) })
    }
    return {
      ...settlement,
      population: remaining,
      prosperity: round1(prosperity), safety: round1(safety), foodSecurity: round1(foodSecurity), waterSecurity: round1(waterSecurity), materials: round1(materials), housing: round1(housing), sanitation: round1(sanitation), tradeAccess: round1(routeAccess), labor: round1(clamp(health + remaining / 7000)), migrationPressure: round1(migrationPressure), growth: round1(growthRate * 100), status,
      abandonedYear: status === 'ruined' ? year : settlement.abandonedYear,
    }
  })

  const occupied = new Set(settlements.filter((entry) => entry.status !== 'ruined').map((entry) => entry.tileId))
  for (const migrant of migrants.sort((a, b) => b.amount - a.amount)) {
    const originTile = tileMap.get(migrant.from.tileId)
    if (!originTile || migrant.amount < 8) continue
    const destinations = settlements
      .filter((entry) => entry.id !== migrant.from.id && entry.status !== 'ruined')
      .map((entry) => ({ settlement: entry, tile: tileMap.get(entry.tileId)! }))
      .filter((entry) => tileDistance(originTile, entry.tile) <= 7)
      .map((entry) => ({ ...entry, score: settlementScore(input, entry.tile) + entry.settlement.tradeAccess * 0.18 - entry.settlement.migrationPressure * 0.35 }))
      .sort((a, b) => b.score - a.score)
    const destination = destinations[0]
    const canFound = input.settlements.length + foundations < Math.max(12, Math.round(input.width * input.height / 30)) && migrant.amount >= 80
    if (destination && destination.score > settlementScore(input, originTile) + 6) {
      settlements = settlements.map((entry) => entry.id === destination.settlement.id ? {
        ...entry,
        population: entry.population + migrant.amount,
        cultureShares: updateCultureShares(entry.cultureShares, migrant.cultureId, migrant.amount, entry.population),
        labor: round1(clamp(entry.labor + migrant.amount / 900)),
      } : entry)
      events.push({ id: `society-migration-${migrant.from.id}-${destination.settlement.id}-${year}`, year, kind: 'migration', title: `Переселение из ${migrant.from.name}`, description: `${migrant.amount.toLocaleString('ru-RU')} человек переселились в ${destination.settlement.name}.`, tileIds: [migrant.from.tileId, destination.settlement.tileId], settlementIds: [migrant.from.id, destination.settlement.id], peopleIds: [migrant.peopleId], cultureIds: [migrant.cultureId], magnitude: clamp(migrant.amount / 20) })
    } else if (canFound) {
      const candidates = input.tiles
        .filter((tile) => !occupied.has(tile.id) && tile.biome !== 'ocean' && tile.stateId === migrant.from.realmId && tileDistance(originTile, tile) <= 6)
        .map((tile) => ({ tile, score: settlementScore(input, tile) }))
        .filter((entry) => entry.score > 42)
        .sort((a, b) => b.score - a.score)
      const target = candidates[0]
      if (target) {
        const id = `settlement-founded-${year}-${foundations + 1}`
        const specialization: SettlementSpecialization = target.tile.soilFertility > 64 ? 'farming' : target.tile.biome === 'coast' ? 'fishing' : target.tile.resourceRichness > 70 ? 'mining' : target.tile.vegetation > 68 ? 'forestry' : 'subsistence'
        const newSettlement: Settlement = {
          id,
          name: `${rng.pick(['Новый', 'Вольный', 'Дальний', 'Речной', 'Каменный'])} ${rng.pick(['Брод', 'Холм', 'Дол', 'Предел', 'Ключ', 'Берег'])}`,
          tileId: target.tile.id,
          realmId: migrant.from.realmId,
          kind: 'village',
          population: migrant.amount,
          prosperity: 28,
          safety: clamp(58 - target.tile.danger * 3),
          traits: ['поселение переселенцев'],
          foundedYear: year,
          status: 'active',
          production: specialization === 'farming' ? ['зерно'] : specialization === 'fishing' ? ['рыба'] : specialization === 'mining' ? ['камень'] : specialization === 'forestry' ? ['древесина'] : ['скот'],
          demand: ['инструменты', 'соль'],
          tradeBalance: -6,
          growth: 1.2,
          foodSecurity: clamp(target.tile.soilFertility * 0.55 + target.tile.vegetation * 0.25),
          unrest: 12,
          peopleId: migrant.peopleId,
          cultureId: migrant.cultureId,
          cultureShares: { [migrant.cultureId]: 100 },
          originReason: originReasonFor(specialization, target.tile),
          specialization,
          waterSecurity: target.tile.waterAvailability,
          housing: 44,
          materials: target.tile.resourceRichness,
          labor: 58,
          sanitation: 40,
          tradeAccess: routeTiles.has(target.tile.id) ? 55 : 12,
          migrationPressure: 18,
          parentSettlementId: migrant.from.id,
        }
        settlements.push(newSettlement)
        communities.push({ id: `community-${id}`, peopleId: migrant.peopleId, cultureId: migrant.cultureId, tileId: target.tile.id, settlementId: id, amount: migrant.amount, health: 55, foodSecurity: newSettlement.foodSecurity, waterSecurity: newSettlement.waterSecurity, housing: newSettlement.housing, migrationPressure: 18, status: 'settled', lastChange: migrant.amount })
        occupied.add(target.tile.id)
        foundations += 1
        events.push({ id: `society-founded-${id}`, year, kind: 'settlement_founded', title: `Основано поселение ${newSettlement.name}`, description: `${newSettlement.name} ${newSettlement.originReason}. Основатели пришли из ${migrant.from.name}.`, tileIds: [migrant.from.tileId, target.tile.id], settlementIds: [migrant.from.id, id], peopleIds: [migrant.peopleId], cultureIds: [migrant.cultureId], magnitude: clamp(migrant.amount / 15) })
      }
    }
  }

  communities = communities.map((community) => {
    const settlement = community.settlementId ? settlements.find((entry) => entry.id === community.settlementId) : undefined
    if (!settlement) return community
    return { ...community, amount: settlement.population, tileId: settlement.tileId, health: round1((settlement.foodSecurity + settlement.waterSecurity + settlement.sanitation) / 3), foodSecurity: settlement.foodSecurity, waterSecurity: settlement.waterSecurity, housing: settlement.housing, migrationPressure: settlement.migrationPressure, status: settlement.status === 'ruined' ? 'migrating' : 'settled', lastChange: settlement.population - community.amount }
  })

  for (const settlement of settlements) {
    if (cultures.length >= input.peoples.length + 8) break
    const blend = blendedCulture(seed, cultures, settlement, year)
    if (!blend) continue
    cultures.push(blend)
    settlement.cultureId = blend.id
    settlement.cultureShares = { [blend.id]: 100 }
    communities = communities.map((entry) => entry.settlementId === settlement.id ? { ...entry, cultureId: blend.id } : entry)
    culturalBlends += 1
    events.push({ id: `society-blend-${settlement.id}-${year}`, year, kind: 'cultural_blend', title: `Новая культура в ${settlement.name}`, description: `Долгое совместное проживание создало ${blend.name} культуру.`, tileIds: [settlement.tileId], settlementIds: [settlement.id], peopleIds: [settlement.peopleId], cultureIds: blend.parentCultureIds.concat(blend.id), magnitude: 55 })
  }

  const peopleTotals = new Map<string, number>()
  for (const settlement of settlements) if (settlement.status !== 'ruined') peopleTotals.set(settlement.peopleId, (peopleTotals.get(settlement.peopleId) ?? 0) + settlement.population)
  const peoples = input.peoples.map((people) => {
    const population = peopleTotals.get(people.id) ?? 0
    const ownSettlements = settlements.filter((entry) => entry.peopleId === people.id && entry.status !== 'ruined')
    const migrationPressure = ownSettlements.length ? ownSettlements.reduce((sum, entry) => sum + entry.migrationPressure, 0) / ownSettlements.length : 100
    const health = ownSettlements.length ? ownSettlements.reduce((sum, entry) => sum + (entry.foodSecurity + entry.waterSecurity + entry.sanitation) / 3, 0) / ownSettlements.length : 0
    return { ...people, population, migrationPressure: round1(migrationPressure), health: round1(health), status: population < Math.max(100, people.population * 0.35) ? 'declining' as const : migrationPressure > 62 ? 'migrating' as const : 'stable' as const }
  })

  const settlementByTile = new Map(settlements.filter((entry) => entry.status !== 'ruined').map((entry) => [entry.tileId, entry]))
  const tiles = input.tiles.map((tile) => {
    const settlement = settlementByTile.get(tile.id)
    if (!settlement) return { ...tile, populationDensity: round1((tile.populationDensity ?? 0) * 0.82), migrationPressure: round1((tile.migrationPressure ?? 0) * 0.86) }
    return { ...tile, settlementId: settlement.id, dominantPeopleId: settlement.peopleId, dominantCultureId: settlement.cultureId, populationDensity: round1(settlement.population / Math.max(50, 70 + tile.travelCost * 70)), migrationPressure: settlement.migrationPressure }
  })

  const historical: HistoricalEvent[] = events.filter((entry) => entry.magnitude >= 36).map((entry) => ({
    id: `history-${entry.id}`,
    year: entry.year,
    title: entry.title,
    description: entry.description,
    tags: ['society', entry.kind, ...entry.peopleIds, ...entry.cultureIds],
    severity: Math.max(1, Math.min(5, Math.ceil(entry.magnitude / 20))),
    kind: entry.kind === 'migration' ? 'migration' : 'settlement',
    cause: entry.kind === 'migration' ? 'давление пищи, воды, безопасности и жилья' : 'долгосрочные изменения населения и среды',
    consequence: entry.description,
    publicVersion: entry.description,
    hiddenTruth: 'Событие возникло из накопленных условий среды, населения и миграционного давления.',
    realmIds: [],
    settlementIds: entry.settlementIds,
    siteIds: [],
  }))

  const society: SocietyState = {
    initializedYear: input.society.initializedYear,
    lastTickYear: year,
    totalPopulation: settlements.filter((entry) => entry.status !== 'ruined').reduce((sum, entry) => sum + entry.population, 0),
    migrations: input.society.migrations + migrations,
    foundations: input.society.foundations + foundations,
    abandonments: input.society.abandonments + abandonments,
    culturalBlends: input.society.culturalBlends + culturalBlends,
    recentEvents: [...input.society.recentEvents, ...events].slice(-120),
  }
  return { ...input, tiles, settlements, peoples, cultures, communities, society, history: [...input.history, ...historical].slice(-900) }
}

export function initializeSociety(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = START_YEAR): WorldData {
  let world = createInitialSociety(seed, input, currentYear)
  const prehistoryYears = settings.historyDepth === 'ancient' ? 120 : settings.historyDepth === 'young' ? 35 : 70
  const firstYear = currentYear - prehistoryYears
  for (let year = firstYear; year < currentYear; year += 1) world = advanceSocietyYear(world, seed, settings, year)
  world.society = { ...world.society, initializedYear: firstYear, lastTickYear: currentYear - 1 }
  return world
}

export function ensureSociety(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = START_YEAR): WorldData {
  if (input.peoples?.length && input.cultures?.length && input.communities?.length && input.society) return input
  return initializeSociety(seed, input, settings, currentYear)
}

export function simulateSocietyYears(world: WorldData, seed: string, settings: WorldGenerationSettings, years: number, startYear: number): WorldData {
  let next = ensureSociety(seed, world, settings, startYear)
  for (let index = 0; index < Math.max(0, Math.floor(years)); index += 1) next = advanceSocietyYear(next, seed, settings, startYear + index)
  return next
}

export function societyYearTick(state: GameState): GameState {
  if (state.day !== 360 || state.world.society.lastTickYear >= state.year) return state
  const before = new Set(state.world.society.recentEvents.map((entry) => entry.id))
  const world = advanceSocietyYear(state.world, state.seed, state.settings, state.year)
  const additions = world.society.recentEvents.filter((entry) => !before.has(entry.id)).filter((entry) => entry.magnitude >= 40).slice(-4)
  if (!additions.length) return { ...state, world }
  return {
    ...state,
    world,
    chronicle: [...state.chronicle, ...additions.map((entry) => ({ id: `chronicle-${entry.id}`, year: entry.year, day: 360, title: entry.title, text: entry.description, category: 'world' as const, importance: Math.max(2, Math.min(5, Math.ceil(entry.magnitude / 20))) }))].slice(-1000),
  }
}

export function societySummary(world: WorldData) {
  const activeSettlements = world.settlements.filter((entry) => entry.status !== 'ruined')
  return {
    totalPopulation: activeSettlements.reduce((sum, entry) => sum + entry.population, 0),
    activeSettlements: activeSettlements.length,
    decliningSettlements: activeSettlements.filter((entry) => entry.status === 'declining').length,
    averageFood: activeSettlements.length ? activeSettlements.reduce((sum, entry) => sum + entry.foodSecurity, 0) / activeSettlements.length : 0,
    averageWater: activeSettlements.length ? activeSettlements.reduce((sum, entry) => sum + entry.waterSecurity, 0) / activeSettlements.length : 0,
    averageMigrationPressure: activeSettlements.length ? activeSettlements.reduce((sum, entry) => sum + entry.migrationPressure, 0) / activeSettlements.length : 0,
  }
}

export function cultureResourceLabel(culture: CultureProfile): string {
  return culture.valuedResources.map((kind) => RESOURCE_LABELS[kind]).join(' · ')
}
