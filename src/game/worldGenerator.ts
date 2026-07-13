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
  WorldGenerationSettings,
  WorldRoute,
  WorldTile,
} from '../types/game'
import { coordinateNoise, RNG } from './rng'
import { densityMultiplier, historyYears, worldSize } from './worldSettings'

const tileId = (x: number, y: number) => `${x}:${y}`
const neighborOffsets = (x: number): number[][] =>
  x % 2 === 0
    ? [[1, -1], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 0]]
    : [[1, 0], [1, 1], [0, -1], [0, 1], [-1, 0], [-1, 1]]

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

function classifyBiome(
  elevation: number,
  moisture: number,
  temperature: number,
  magic: number,
  settings: WorldGenerationSettings,
): BiomeId {
  if (elevation < 0.3) return 'ocean'
  if (elevation < 0.34) return 'coast'
  if (elevation > 0.82) return 'mountains'
  const ashThreshold = settings.magicLevel === 'wild' ? 0.78 : settings.magicLevel === 'rare' ? 0.98 : 0.91
  if (magic > ashThreshold && elevation > 0.38) return 'ashlands'
  const coldThreshold = settings.climate === 'harsh' ? 0.31 : 0.24
  if (temperature < coldThreshold) return 'tundra'
  const dryThreshold = settings.climate === 'temperate' ? 0.17 : 0.23
  if (moisture < dryThreshold && temperature > 0.5) return 'desert'
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

function findWorldPath(tiles: WorldTile[], fromId: string, toId: string, river = false): string[] {
  if (fromId === toId) return [fromId]
  const tileMap = new Map(tiles.map((tile) => [tile.id, tile]))
  const destination = tileMap.get(toId)
  const start = tileMap.get(fromId)
  if (!destination || !start) return []
  const frontier: Array<{ id: string; priority: number }> = [{ id: fromId, priority: 0 }]
  const cost = new Map<string, number>([[fromId, 0]])
  const cameFrom = new Map<string, string>()

  while (frontier.length) {
    frontier.sort((a, b) => a.priority - b.priority)
    const currentId = frontier.shift()!.id
    if (currentId === toId) break
    const current = tileMap.get(currentId)
    if (!current) continue
    for (const [dx, dy] of neighborOffsets(current.x)) {
      const next = tileMap.get(tileId(current.x + dx, current.y + dy))
      if (!next) continue
      if (!river && next.biome === 'ocean') continue
      const terrain = river
        ? Math.max(0.15, 1 + (next.elevation - current.elevation) * 9)
        : next.travelCost + next.danger * 0.025
      const nextCost = (cost.get(currentId) ?? 0) + terrain
      if (!cost.has(next.id) || nextCost < cost.get(next.id)!) {
        cost.set(next.id, nextCost)
        cameFrom.set(next.id, currentId)
        frontier.push({ id: next.id, priority: nextCost + distance(next, destination) * 0.7 })
      }
    }
  }

  if (!cameFrom.has(toId)) return []
  const path = [toId]
  let cursor = toId
  while (cursor !== fromId) {
    cursor = cameFrom.get(cursor)!
    path.unshift(cursor)
  }
  return path
}

function createRoutes(seed: string, tiles: WorldTile[], settlements: Settlement[]): WorldRoute[] {
  const rng = new RNG(`${seed}:routes`)
  const tileMap = new Map(tiles.map((tile) => [tile.id, tile]))
  const routes: WorldRoute[] = []
  const usedPairs = new Set<string>()
  const important = settlements.filter((settlement) => ['capital', 'city', 'town', 'fortress'].includes(settlement.kind))

  for (const settlement of important) {
    const origin = tileMap.get(settlement.tileId)
    if (!origin) continue
    const neighbors = important
      .filter((candidate) => candidate.id !== settlement.id)
      .map((candidate) => ({ settlement: candidate, tile: tileMap.get(candidate.tileId)! }))
      .filter((entry) => entry.tile)
      .sort((a, b) => distance(origin, a.tile) - distance(origin, b.tile))
      .slice(0, settlement.kind === 'capital' ? 3 : 1)

    for (const target of neighbors) {
      const pair = [settlement.id, target.settlement.id].sort().join(':')
      if (usedPairs.has(pair)) continue
      usedPairs.add(pair)
      const path = findWorldPath(tiles, settlement.tileId, target.settlement.tileId)
      if (path.length < 2) continue
      for (const id of path) {
        const tile = tileMap.get(id)
        if (tile) {
          tile.hasRoad = true
          tile.travelCost = Math.max(0.7, tile.travelCost * 0.72)
        }
      }
      routes.push({
        id: `road-${routes.length + 1}`,
        name: `${settlement.name} — ${target.settlement.name}`,
        type: settlement.kind === 'capital' || target.settlement.kind === 'capital' ? 'trade' : 'road',
        tileIds: path,
        importance: settlement.kind === 'capital' ? 3 : 1,
      })
    }
  }

  const riverSources = rng
    .shuffle(tiles.filter((tile) => tile.elevation > 0.69 && tile.biome !== 'ocean'))
    .slice(0, Math.max(3, Math.round(tiles.length / 550)))
  const oceanTiles = tiles.filter((tile) => tile.biome === 'ocean' || tile.biome === 'coast')
  for (const source of riverSources) {
    const mouth = [...oceanTiles].sort((a, b) => distance(source, a) - distance(source, b))[0]
    if (!mouth) continue
    const path = findWorldPath(tiles, source.id, mouth.id, true)
    if (path.length < 5) continue
    for (const id of path) {
      const tile = tileMap.get(id)
      if (tile) tile.hasRiver = true
    }
    routes.push({ id: `river-${routes.length + 1}`, name: `Река ${rng.pick(['Серая', 'Длинная', 'Лунная', 'Каменная', 'Тихая', 'Красная'])}`, type: 'river', tileIds: path, importance: 2 })
  }
  return routes
}

function createHistory(
  seed: string,
  realms: Realm[],
  sites: Site[],
  settings: WorldGenerationSettings,
): HistoricalEvent[] {
  const rng = new RNG(`${seed}:history`)
  const events: HistoricalEvent[] = []
  const currentYear = 912
  const span = historyYears(settings.historyDepth)
  const countBase = settings.historyDepth === 'young' ? 7 : settings.historyDepth === 'ancient' ? 18 : 12
  const conflictBonus = settings.conflictLevel === 'war_torn' ? 6 : settings.conflictLevel === 'turbulent' ? 3 : 0
  const templates = [
    ['Основание', 'Несколько поселений объединились вокруг безопасного пути и общего рынка.', ['state']],
    ['Великий поход', 'Армия пересекла регион и оставила цепь крепостей, братских могил и спорных границ.', ['war']],
    ['Раскол веры', 'Жрецы разделились из-за древнего текста. Новая ересь пережила гонения.', ['religion']],
    ['Падение династии', 'Правящий дом исчез после переворота. Несколько семей до сих пор спорят о наследстве.', ['dynasty']],
    ['Чума серых свечей', 'Болезнь опустошила торговые города и изменила старые дороги.', ['plague']],
    ['Пепельная катастрофа', 'Неудачный ритуал выжег землю и породил нестабильные зоны.', ['magic', 'catastrophe']],
    ['Дворфийский исход', 'Подземные кланы покинули шахты после пробуждения древнего механизма.', ['migration']],
    ['Эльфийское отступление', 'Лесные дворы закрыли границы после убийства послов.', ['diplomacy']],
    ['Голодный год', 'Неурожай заставил тысячи людей уйти на восток и основать новые поселения.', ['famine', 'migration']],
    ['Война за перевалы', 'Два государства десятилетиями делили горные дороги и серебряные шахты.', ['war', 'trade']],
    ['Исчезновение экспедиции', 'Королевские картографы перестали выходить на связь возле древних руин.', ['expedition']],
    ['Открытие торгового пути', 'Новая дорога обогатила один город и разорила старый речной порт.', ['trade']],
  ] as const
  const eventCount = Math.min(28, countBase + conflictBonus)
  for (let index = 0; index < eventCount; index += 1) {
    const realm = rng.pick(realms)
    const rival = rng.pick(realms.filter((candidate) => candidate.id !== realm.id))
    const site = rng.pick(sites)
    const template = rng.pick(templates)
    const templateTags = template[2] as readonly string[]
    const ageFraction = (index + rng.float(0.15, 0.9)) / eventCount
    const year = currentYear - Math.round(span * ageFraction)
    let description = template[1]
    if (templateTags.includes('war')) description += ` Главными противниками были ${realm.name} и ${rival?.name ?? 'соседние княжества'}.`
    if (templateTags.includes('expedition')) description += ` Последний лагерь находился у места «${site.name}».`
    if (templateTags.includes('state')) description += ` Так началась история государства ${realm.name}.`
    events.push({
      id: `hist-${index + 1}`,
      year,
      title: `${template[0]}: ${rng.pick([realm.name, site.name, 'Северный предел', 'Долина трёх рек'])}`,
      description,
      tags: [...templateTags, realm.id, site.id],
      severity: templateTags.includes('catastrophe') || templateTags.includes('war') ? rng.int(3, 5) : rng.int(1, 4),
    })
  }
  return events.sort((a, b) => a.year - b.year)
}

export function generateWorld(seed: string, settings: WorldGenerationSettings): WorldData {
  const rng = new RNG(`${seed}:world`)
  const { width, height } = worldSize(settings)
  const tiles: WorldTile[] = []
  const dangerMultiplier = settings.monsterDensity === 'dense' ? 1.2 : settings.monsterDensity === 'sparse' ? 0.82 : 1
  const conflictDanger = settings.conflictLevel === 'war_torn' ? 1.4 : settings.conflictLevel === 'turbulent' ? 0.6 : 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edgeX = Math.abs(x / (width - 1) - 0.5) * 2
      const edgeY = Math.abs(y / (height - 1) - 0.5) * 2
      const edgeFalloff = Math.max(edgeX ** 2.2, edgeY ** 2.2) * 0.31
      const continental = layeredNoise(seed, x, y, 'elevation')
      const ridge = Math.abs(smoothNoise(seed, x, y, 7, 'ridge') - 0.5) * 0.28
      const elevation = Math.max(0, Math.min(1, continental * 0.95 + ridge - edgeFalloff + 0.04))
      const moistureShift = settings.climate === 'temperate' ? 0.07 : settings.climate === 'harsh' ? -0.05 : 0
      const moisture = Math.max(0, Math.min(1, layeredNoise(seed, x, y, 'moisture') + (elevation < 0.4 ? 0.12 : 0) + moistureShift))
      const latitudeTemperature = 1 - Math.abs(y / (height - 1) - 0.5) * (settings.climate === 'harsh' ? 1.65 : 1.35)
      const temperature = Math.max(0, Math.min(1, latitudeTemperature * 0.7 + layeredNoise(seed, x, y, 'temperature') * 0.3 - elevation * 0.25))
      const magicRaw = layeredNoise(seed, x, y, 'magic')
      const magic = Math.max(0, Math.min(1, magicRaw + (settings.magicLevel === 'wild' ? 0.14 : settings.magicLevel === 'rare' ? -0.16 : 0)))
      const biome = classifyBiome(elevation, moisture, temperature, magic, settings)
      const rawDanger = layeredNoise(seed, x, y, 'danger') * 5 + (biome === 'ashlands' ? 3 : 0) + (biome === 'mountains' ? 1 : 0) + conflictDanger
      const baseDanger = biome === 'ocean' ? 0 : Math.round(rawDanger * dangerMultiplier * 10) / 10

      tiles.push({
        id: tileId(x, y), x, y, elevation, moisture, temperature, magic, biome,
        danger: Math.min(10, Math.max(1, baseDanger)),
        travelCost: travelCostFor(biome),
        knowledge: 0,
      })
    }
  }

  const landTiles = tiles.filter((tile) => tile.biome !== 'ocean' && tile.biome !== 'mountains' && tile.biome !== 'ashlands')
  const minRealmDistance = Math.max(5.5, Math.sqrt(width * height) / Math.max(2.2, settings.realmCount * 0.65))
  let capitalTiles = chooseSpacedTiles(rng, [...landTiles].sort((a, b) => habitability(b) - habitability(a)).slice(0, Math.min(700, landTiles.length)), settings.realmCount, minRealmDistance)
  if (capitalTiles.length < settings.realmCount) capitalTiles = [...capitalTiles, ...chooseSpacedTiles(rng, landTiles.filter((tile) => !capitalTiles.includes(tile)), settings.realmCount - capitalTiles.length, 3)]

  const faiths = ['Храм Девяти Огней', 'Культ Старых Корней', 'Церковь Небесного Закона', 'Путь Каменных Предков', 'Собор Лунной Завесы']
  const issues = ['спор о наследовании', 'набеги чудовищ', 'религиозный раскол', 'голод на окраинах', 'война за перевал', 'мятеж пограничных баронов', 'магическая эпидемия']
  const realms: Realm[] = capitalTiles.map((capital, index) => ({
    id: `realm-${index + 1}`,
    name: createRealmName(rng),
    government: rng.pick(GOVERNMENTS),
    capitalId: `settlement-capital-${index + 1}`,
    color: REALM_COLORS[index % REALM_COLORS.length],
    culture: rng.pick(CULTURES),
    ruler: `${rng.pick(['Король', 'Княгиня', 'Архонт', 'Магистр', 'Советница', 'Воевода'])} ${rng.pick(['Эдран', 'Мирель', 'Торвен', 'Кассия', 'Рагнар', 'Селена'])}`,
    attitude: rng.int(-20, 35),
    wealth: rng.int(35, 80),
    military: rng.int(30, 85),
    stability: rng.int(settings.conflictLevel === 'war_torn' ? 24 : 40, settings.conflictLevel === 'calm' ? 95 : 86),
    description: `Государство выросло вокруг ${capital.biome === 'coast' ? 'морской торговли' : 'старых сухопутных маршрутов'} и контролирует несколько пограничных земель.`,
    dominantFaith: rng.pick(faiths),
    currentIssue: rng.pick(issues),
    relations: {},
  }))

  for (const realm of realms) {
    for (const other of realms) {
      if (other.id === realm.id) continue
      const conflictShift = settings.conflictLevel === 'war_torn' ? -35 : settings.conflictLevel === 'calm' ? 20 : -5
      realm.relations[other.id] = Math.max(-100, Math.min(100, rng.int(-45, 55) + conflictShift))
    }
  }

  for (const tile of landTiles) {
    let nearestIndex = 0
    let nearestScore = Number.POSITIVE_INFINITY
    capitalTiles.forEach((capital, index) => {
      const score = distance(tile, capital) + coordinateNoise(seed, tile.x, tile.y, `border-${index}`) * 4.2
      if (score < nearestScore) { nearestScore = score; nearestIndex = index }
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

  const settlementMultiplier = densityMultiplier(settings.settlementDensity)
  const secondaryTarget = Math.max(10, Math.round((width * height) / 48 * settlementMultiplier))
  const secondaryCandidates = [...landTiles].filter((tile) => !tile.settlementId).sort((a, b) => habitability(b) - habitability(a))
  const secondaryTiles = chooseSpacedTiles(rng, secondaryCandidates.slice(0, Math.min(1000, secondaryCandidates.length)), secondaryTarget, settings.settlementDensity === 'dense' ? 2.4 : 3.2)
  secondaryTiles.forEach((tile, index) => {
    const realmId = tile.stateId ?? realms[0].id
    const roll = rng.next()
    const kind: Settlement['kind'] = roll > 0.92 ? 'city' : roll > 0.82 ? 'fortress' : roll > 0.53 ? 'town' : roll > 0.48 ? 'monastery' : 'village'
    const population = kind === 'city' ? rng.int(11000, 24000) : kind === 'town' ? rng.int(3000, 11000) : kind === 'fortress' ? rng.int(900, 3500) : rng.int(250, 1800)
    const settlement: Settlement = {
      id: `settlement-${index + 1}`,
      name: createSettlementName(rng), tileId: tile.id, realmId, kind, population,
      prosperity: rng.int(25, 75), safety: rng.int(25, 80),
      traits: rng.shuffle(['лесопилки', 'серебряный рудник', 'паломники', 'пограничный рынок', 'старый мост', 'охотники', 'болотные травы', 'магическая школа']).slice(0, rng.int(1, 2)),
    }
    settlements.push(settlement)
    tile.settlementId = settlement.id
  })

  const startCandidates = settlements.filter((settlement) => settlement.kind === 'village' || settlement.kind === 'town').sort((a, b) => a.prosperity - b.prosperity)
  const startSettlement = startCandidates[Math.min(2, startCandidates.length - 1)] ?? settlements[Math.min(4, settlements.length - 1)]
  startSettlement.isGuildHome = true

  const ruinMultiplier = densityMultiplier(settings.ruinDensity)
  const historyMultiplier = settings.historyDepth === 'ancient' ? 1.35 : settings.historyDepth === 'young' ? 0.75 : 1
  const siteTarget = Math.max(14, Math.round((width * height) / 36 * ruinMultiplier * historyMultiplier))
  const siteCandidates = tiles.filter((tile) => tile.biome !== 'ocean' && !tile.settlementId && tile.danger >= 2.5)
  const siteTiles = chooseSpacedTiles(rng, siteCandidates, siteTarget, settings.ruinDensity === 'dense' ? 1.15 : 1.7)
  const siteTypes: Site['type'][] = ['ruins', 'dungeon', 'tower', 'tomb', 'mine', 'shrine', 'anomaly', 'lair']
  const layerPool = ['первоначальный комплекс', 'военная перестройка', 'заброшенный уровень', 'логово новых обитателей', 'скрытая глубинная зона']
  const sites: Site[] = siteTiles.map((tile, index) => {
    const type = rng.pick(siteTypes)
    const depth = rng.int(1, settings.historyDepth === 'ancient' ? 7 : 5)
    const site: Site = {
      id: `site-${index + 1}`,
      name: createSiteName(rng), tileId: tile.id, type,
      origin: rng.pick(['дворфийская пограничная крепость', 'эльфийское святилище', 'лаборатория павшей магократии', 'город времён Войны двух корон', 'неизвестная подземная культура', 'храм исчезнувшей династии']),
      age: rng.int(settings.historyDepth === 'young' ? 40 : 80, settings.historyDepth === 'ancient' ? 2400 : 1200),
      danger: Math.min(10, Math.round(tile.danger + rng.float(0, 3))), depth,
      state: rng.bool(0.2) ? 'rumored' : 'unknown',
      monsterTags: rng.shuffle(MONSTER_SPECIES.map((species) => species.id)).slice(0, rng.int(1, 2)),
      rewards: rng.shuffle(['древние карты', 'исторические документы', 'магический артефакт', 'редкие минералы', 'рунический ключ', 'останки неизвестного вида']).slice(0, 2),
      truth: rng.pick(['нижний уровень ещё запечатан', 'официальная история объекта ложна', 'обитатели защищают древний договор', 'внутри работает нестабильный портал', 'руины стоят поверх более древнего комплекса']),
      layers: rng.shuffle(layerPool).slice(0, Math.min(depth, rng.int(2, 5))),
    }
    tile.siteId = site.id
    return site
  })

  const monsterMultiplier = densityMultiplier(settings.monsterDensity)
  const monsterTarget = Math.max(18, Math.round((width * height) / 30 * monsterMultiplier))
  const monsterPopulations: MonsterPopulation[] = []
  const monsterCandidates = rng.shuffle(tiles.filter((tile) => tile.biome !== 'ocean' && !tile.settlementId))
  for (const tile of monsterCandidates) {
    const matching = MONSTER_SPECIES.filter((species) => species.habitats.includes(tile.biome))
    if (!matching.length || monsterPopulations.length >= monsterTarget) continue
    const species = rng.pick(matching)
    const population: MonsterPopulation = {
      id: `population-${monsterPopulations.length + 1}`,
      speciesId: species.id, tileId: tile.id,
      size: rng.int(3, settings.monsterDensity === 'dense' ? 36 : 24),
      aggression: rng.int(settings.conflictLevel === 'war_torn' ? 35 : 20, 90),
      movement: rng.int(0, 3),
    }
    monsterPopulations.push(population)
    tile.monsterPopulationId = population.id
    tile.danger = Math.min(10, tile.danger + species.threat * (settings.monsterDensity === 'dense' ? 0.46 : 0.35))
  }

  const routes = createRoutes(seed, tiles, settlements)
  const startTile = tiles.find((tile) => tile.id === startSettlement.tileId)!
  for (const tile of tiles) {
    const d = distance(tile, startTile)
    const base = settings.startingKnowledge
    if (d <= 2.5) tile.knowledge = Math.min(5, base + 2) as WorldTile['knowledge']
    else if (d <= 5) tile.knowledge = Math.min(4, base) as WorldTile['knowledge']
    else if (d <= 8 && rng.bool(0.35 + base * 0.08)) tile.knowledge = 1
    else if (tile.siteId && sites.find((site) => site.id === tile.siteId)?.state === 'rumored') tile.knowledge = 1
  }

  return {
    seed, width, height, tiles, realms, settlements, sites, routes,
    monsterSpecies: MONSTER_SPECIES,
    monsterPopulations,
    startSettlementId: startSettlement.id,
    history: createHistory(seed, realms, sites, settings),
  }
}
