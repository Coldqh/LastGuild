import {
  CULTURES,
  GOVERNMENTS,
  MONSTER_SPECIES,
  REALM_COLORS,
  REALM_PREFIXES,
  REALM_SUFFIXES,
  SETTLEMENT_NOUNS,
  SETTLEMENT_PREFIXES,
  SITE_NOUNS,
  SITE_PREFIXES,
} from '../data/content'
import type {
  BiomeId,
  HistoricalEvent,
  MonsterPopulation,
  Realm,
  Settlement,
  Site,
  WorldData,
  WorldTile,
} from '../types/game'
import { coordinateNoise, RNG } from './rng'

const WIDTH = 36
const HEIGHT = 24

const tileId = (x: number, y: number) => `${x}:${y}`

function smoothNoise(seed: string, x: number, y: number, scale: number, salt: string): number {
  const sx = x / scale
  const sy = y / scale
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const tx = sx - x0
  const ty = sy - y0
  const fade = (t: number) => t * t * (3 - 2 * t)
  const a = coordinateNoise(seed, x0, y0, salt)
  const b = coordinateNoise(seed, x0 + 1, y0, salt)
  const c = coordinateNoise(seed, x0, y0 + 1, salt)
  const d = coordinateNoise(seed, x0 + 1, y0 + 1, salt)
  const ab = a + (b - a) * fade(tx)
  const cd = c + (d - c) * fade(tx)
  return ab + (cd - ab) * fade(ty)
}

function layeredNoise(seed: string, x: number, y: number, salt: string): number {
  return (
    smoothNoise(seed, x, y, 10, `${salt}:large`) * 0.5 +
    smoothNoise(seed, x, y, 5, `${salt}:medium`) * 0.3 +
    smoothNoise(seed, x, y, 2.4, `${salt}:small`) * 0.2
  )
}

function classifyBiome(elevation: number, moisture: number, temperature: number, magic: number): BiomeId {
  if (elevation < 0.3) return 'ocean'
  if (elevation < 0.34) return 'coast'
  if (elevation > 0.82) return 'mountains'
  if (magic > 0.91 && elevation > 0.38) return 'ashlands'
  if (temperature < 0.24) return 'tundra'
  if (moisture < 0.23 && temperature > 0.5) return 'desert'
  if (moisture > 0.76 && elevation < 0.55) return 'swamp'
  if (elevation > 0.68) return 'hills'
  if (moisture > 0.66) return 'ancient_forest'
  if (moisture > 0.46) return 'forest'
  return 'plains'
}

function travelCostFor(biome: BiomeId): number {
  return {
    ocean: 99,
    coast: 1.5,
    plains: 1,
    forest: 1.5,
    ancient_forest: 2,
    hills: 1.7,
    mountains: 3,
    swamp: 2.6,
    desert: 2,
    tundra: 2.2,
    ashlands: 2.8,
  }[biome]
}

function habitability(tile: WorldTile): number {
  if (tile.biome === 'ocean' || tile.biome === 'mountains' || tile.biome === 'ashlands') return -100
  const biomeBonus: Record<BiomeId, number> = {
    ocean: -100,
    coast: 1.4,
    plains: 2,
    forest: 1.3,
    ancient_forest: 0.7,
    hills: 1,
    mountains: -4,
    swamp: -1,
    desert: -1.2,
    tundra: -1.4,
    ashlands: -3,
  }
  return biomeBonus[tile.biome] + tile.moisture * 1.2 + (1 - Math.abs(tile.temperature - 0.55))
}

function distance(a: WorldTile, b: WorldTile): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 1.12)
}

function createRealmName(rng: RNG): string {
  return `${rng.pick(REALM_PREFIXES)}${rng.pick(REALM_SUFFIXES)}`
}

function createSettlementName(rng: RNG): string {
  return `${rng.pick(SETTLEMENT_PREFIXES)} ${rng.pick(SETTLEMENT_NOUNS)}`
}

function createSiteName(rng: RNG): string {
  return `${rng.pick(SITE_PREFIXES)} ${rng.pick(SITE_NOUNS)}`
}

function chooseSpacedTiles(rng: RNG, tiles: WorldTile[], count: number, minDistance: number): WorldTile[] {
  const candidates = rng.shuffle(tiles)
  const result: WorldTile[] = []
  for (const tile of candidates) {
    if (result.every((existing) => distance(existing, tile) >= minDistance)) result.push(tile)
    if (result.length >= count) break
  }
  return result
}

function createHistory(seed: string, realms: Realm[], sites: Site[]): HistoricalEvent[] {
  const rng = new RNG(`${seed}:history`)
  const events: HistoricalEvent[] = []
  const currentYear = 912
  const oldRealm = rng.pick(realms)
  const rival = rng.pick(realms.filter((realm) => realm.id !== oldRealm.id))
  const ruin = rng.pick(sites)

  events.push(
    {
      id: 'hist-founding',
      year: currentYear - rng.int(420, 560),
      title: `Возвышение ${oldRealm.name}`,
      description: `${oldRealm.name} возникло после объединения пограничных крепостей вокруг безопасного речного пути.`,
      tags: ['state', oldRealm.id],
    },
    {
      id: 'hist-war',
      year: currentYear - rng.int(170, 250),
      title: `Война двух корон`,
      description: `${oldRealm.name} и ${rival.name} сражались за горные перевалы и месторождения серебра. Несколько дорог были разрушены.`,
      tags: ['war', oldRealm.id, rival.id],
    },
    {
      id: 'hist-cataclysm',
      year: currentYear - rng.int(80, 150),
      title: `Пепельный разлом`,
      description: `Неудачный магический ритуал изменил целый район. После катастрофы появились новые чудовища и нестабильные руины.`,
      tags: ['magic', 'catastrophe'],
    },
    {
      id: 'hist-site',
      year: currentYear - rng.int(35, 70),
      title: `Исчезновение экспедиции у «${ruin.name}»`,
      description: `Королевский отряд картографов перестал выходить на связь. Его журналы так и не были найдены.`,
      tags: ['expedition', ruin.id],
    },
  )
  return events.sort((a, b) => a.year - b.year)
}

export function generateWorld(seed: string): WorldData {
  const rng = new RNG(`${seed}:world`)
  const tiles: WorldTile[] = []

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const edgeX = Math.abs(x / (WIDTH - 1) - 0.5) * 2
      const edgeY = Math.abs(y / (HEIGHT - 1) - 0.5) * 2
      const edgeFalloff = Math.max(edgeX ** 2.2, edgeY ** 2.2) * 0.31
      const continental = layeredNoise(seed, x, y, 'elevation')
      const ridge = Math.abs(smoothNoise(seed, x, y, 7, 'ridge') - 0.5) * 0.28
      const elevation = Math.max(0, Math.min(1, continental * 0.95 + ridge - edgeFalloff + 0.04))
      const moisture = Math.max(0, Math.min(1, layeredNoise(seed, x, y, 'moisture') + (elevation < 0.4 ? 0.12 : 0)))
      const latitudeTemperature = 1 - Math.abs(y / (HEIGHT - 1) - 0.5) * 1.35
      const temperature = Math.max(0, Math.min(1, latitudeTemperature * 0.7 + layeredNoise(seed, x, y, 'temperature') * 0.3 - elevation * 0.25))
      const magic = layeredNoise(seed, x, y, 'magic')
      const biome = classifyBiome(elevation, moisture, temperature, magic)
      const baseDanger = biome === 'ocean' ? 0 : Math.round((layeredNoise(seed, x, y, 'danger') * 5 + (biome === 'ashlands' ? 3 : 0) + (biome === 'mountains' ? 1 : 0)) * 10) / 10

      tiles.push({
        id: tileId(x, y),
        x,
        y,
        elevation,
        moisture,
        temperature,
        biome,
        danger: Math.min(10, Math.max(1, baseDanger)),
        travelCost: travelCostFor(biome),
        knowledge: 0,
      })
    }
  }

  const landTiles = tiles.filter((tile) => tile.biome !== 'ocean' && tile.biome !== 'mountains' && tile.biome !== 'ashlands')
  const capitalTiles = chooseSpacedTiles(rng, [...landTiles].sort((a, b) => habitability(b) - habitability(a)).slice(0, 220), 4, 9)
  const realms: Realm[] = capitalTiles.map((capital, index) => ({
    id: `realm-${index + 1}`,
    name: createRealmName(rng),
    government: rng.pick(GOVERNMENTS),
    capitalId: `settlement-capital-${index + 1}`,
    color: REALM_COLORS[index % REALM_COLORS.length],
    culture: rng.pick(CULTURES),
    ruler: `${rng.pick(['Король', 'Княгиня', 'Архонт', 'Магистр', 'Советница'])} ${rng.pick(['Эдран', 'Мирель', 'Торвен', 'Кассия', 'Рагнар', 'Селена'])}`,
    attitude: rng.int(-20, 35),
    wealth: rng.int(35, 80),
    military: rng.int(30, 85),
    stability: rng.int(40, 90),
    description: `Государство выросло вокруг ${capital.biome === 'coast' ? 'морской торговли' : 'старых сухопутных маршрутов'} и контролирует несколько пограничных земель.`,
  }))

  for (const tile of landTiles) {
    let nearestIndex = 0
    let nearestScore = Number.POSITIVE_INFINITY
    capitalTiles.forEach((capital, index) => {
      const score = distance(tile, capital) + coordinateNoise(seed, tile.x, tile.y, `border-${index}`) * 4.2
      if (score < nearestScore) {
        nearestScore = score
        nearestIndex = index
      }
    })
    tile.stateId = realms[nearestIndex]?.id
  }

  const settlements: Settlement[] = []
  capitalTiles.forEach((capital, index) => {
    const settlement: Settlement = {
      id: `settlement-capital-${index + 1}`,
      name: createSettlementName(rng),
      tileId: capital.id,
      realmId: realms[index].id,
      kind: 'capital',
      population: rng.int(18000, 52000),
      prosperity: rng.int(60, 90),
      safety: rng.int(60, 88),
      traits: rng.shuffle(['рынок артефактов', 'старые стены', 'университет', 'великий храм', 'речной порт']).slice(0, 2),
    }
    settlements.push(settlement)
    capital.settlementId = settlement.id
  })

  const secondaryCandidates = [...landTiles]
    .filter((tile) => !tile.settlementId)
    .sort((a, b) => habitability(b) - habitability(a))
  const secondaryTiles = chooseSpacedTiles(rng, secondaryCandidates.slice(0, 500), 18, 3.2)
  secondaryTiles.forEach((tile, index) => {
    const realmId = tile.stateId ?? realms[0].id
    const roll = rng.next()
    const kind: Settlement['kind'] = roll > 0.84 ? 'fortress' : roll > 0.55 ? 'town' : 'village'
    const population = kind === 'town' ? rng.int(3000, 11000) : kind === 'fortress' ? rng.int(900, 3500) : rng.int(250, 1800)
    const settlement: Settlement = {
      id: `settlement-${index + 1}`,
      name: createSettlementName(rng),
      tileId: tile.id,
      realmId,
      kind,
      population,
      prosperity: rng.int(25, 75),
      safety: rng.int(25, 80),
      traits: rng.shuffle(['лесопилки', 'серебряный рудник', 'паломники', 'пограничный рынок', 'старый мост', 'охотники', 'болотные травы']).slice(0, rng.int(1, 2)),
    }
    settlements.push(settlement)
    tile.settlementId = settlement.id
  })

  const startCandidates = settlements
    .filter((settlement) => settlement.kind === 'village' || settlement.kind === 'town')
    .sort((a, b) => a.prosperity - b.prosperity)
  const startSettlement = startCandidates[Math.min(2, startCandidates.length - 1)] ?? settlements[4]
  startSettlement.isGuildHome = true

  const siteCandidates = tiles.filter((tile) => tile.biome !== 'ocean' && !tile.settlementId && tile.danger >= 3)
  const spacedSiteTiles = chooseSpacedTiles(rng, siteCandidates, 24, 1.7)
  const siteTileIds = new Set(spacedSiteTiles.map((tile) => tile.id))
  const siteTiles = [...spacedSiteTiles]
  for (const candidate of rng.shuffle(siteCandidates)) {
    if (siteTiles.length >= 24) break
    if (!siteTileIds.has(candidate.id)) {
      siteTiles.push(candidate)
      siteTileIds.add(candidate.id)
    }
  }
  const siteTypes: Site['type'][] = ['ruins', 'dungeon', 'tower', 'tomb', 'mine', 'shrine', 'anomaly', 'lair']
  const sites: Site[] = siteTiles.map((tile, index) => {
    const type = rng.pick(siteTypes)
    const site: Site = {
      id: `site-${index + 1}`,
      name: createSiteName(rng),
      tileId: tile.id,
      type,
      origin: rng.pick(['дворфийская пограничная крепость', 'эльфийское святилище', 'лаборатория павшей магократии', 'город времён Войны двух корон', 'неизвестная подземная культура']),
      age: rng.int(80, 1200),
      danger: Math.min(10, Math.round(tile.danger + rng.float(0, 3))),
      depth: rng.int(1, 5),
      state: rng.bool(0.18) ? 'rumored' : 'unknown',
      monsterTags: rng.shuffle(MONSTER_SPECIES.map((species) => species.id)).slice(0, rng.int(1, 2)),
      rewards: rng.shuffle(['древние карты', 'исторические документы', 'магический артефакт', 'редкие минералы', 'рунический ключ', 'останки неизвестного вида']).slice(0, 2),
      truth: rng.pick(['нижний уровень ещё запечатан', 'официальная история объекта ложна', 'обитатели защищают древний договор', 'внутри работает нестабильный портал', 'руины стоят поверх более древнего комплекса']),
    }
    tile.siteId = site.id
    return site
  })

  const monsterPopulations: MonsterPopulation[] = []
  const monsterCandidates = rng.shuffle(tiles.filter((tile) => tile.biome !== 'ocean' && !tile.settlementId))
  for (const tile of monsterCandidates) {
    const matching = MONSTER_SPECIES.filter((species) => species.habitats.includes(tile.biome))
    if (matching.length === 0 || monsterPopulations.length >= 34) continue
    const species = rng.pick(matching)
    const population: MonsterPopulation = {
      id: `population-${monsterPopulations.length + 1}`,
      speciesId: species.id,
      tileId: tile.id,
      size: rng.int(3, 24),
      aggression: rng.int(20, 90),
      movement: rng.int(0, 3),
    }
    monsterPopulations.push(population)
    tile.monsterPopulationId = population.id
    tile.danger = Math.min(10, tile.danger + species.threat * 0.35)
  }

  const startTile = tiles.find((tile) => tile.id === startSettlement.tileId)!
  for (const tile of tiles) {
    const d = distance(tile, startTile)
    if (d <= 2.5) tile.knowledge = 4
    else if (d <= 5) tile.knowledge = 2
    else if (d <= 8 && rng.bool(0.35)) tile.knowledge = 1
    else if (tile.siteId && sites.find((site) => site.id === tile.siteId)?.state === 'rumored') tile.knowledge = 1
  }

  return {
    seed,
    width: WIDTH,
    height: HEIGHT,
    tiles,
    realms,
    settlements,
    sites,
    monsterSpecies: MONSTER_SPECIES,
    monsterPopulations,
    startSettlementId: startSettlement.id,
    history: createHistory(seed, realms, sites),
  }
}
