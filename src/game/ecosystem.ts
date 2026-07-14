import type {
  BiomeId,
  EcologyPopulation,
  EcologySpecies,
  EcosystemEvent,
  GameState,
  ResourceDeposit,
  ResourceKind,
  WorldData,
  WorldGenerationSettings,
  WorldTile,
} from '../types/game'
import { coordinateNoise, RNG } from './rng'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const round1 = (value: number) => Math.round(value * 10) / 10
const tileKey = (speciesId: string, tileId: string) => `${speciesId}@${tileId}`

const BIOME_FERTILITY: Record<BiomeId, number> = {
  ocean: 0,
  coast: 58,
  plains: 76,
  forest: 70,
  ancient_forest: 82,
  hills: 48,
  mountains: 18,
  swamp: 64,
  desert: 14,
  tundra: 22,
  ashlands: 8,
}

const BIOME_VEGETATION: Record<BiomeId, number> = {
  ocean: 4,
  coast: 46,
  plains: 68,
  forest: 82,
  ancient_forest: 94,
  hills: 52,
  mountains: 18,
  swamp: 78,
  desert: 12,
  tundra: 24,
  ashlands: 5,
}

const RESOURCE_BY_BIOME: Record<BiomeId, ResourceKind[]> = {
  ocean: ['fish', 'salt'],
  coast: ['fish', 'salt', 'timber'],
  plains: ['fertile_soil', 'game', 'fresh_water'],
  forest: ['timber', 'game', 'herbs'],
  ancient_forest: ['timber', 'herbs', 'crystal', 'game'],
  hills: ['stone', 'iron', 'game'],
  mountains: ['stone', 'iron', 'crystal'],
  swamp: ['herbs', 'fresh_water', 'game'],
  desert: ['salt', 'stone', 'crystal'],
  tundra: ['game', 'fish', 'stone'],
  ashlands: ['obsidian', 'crystal', 'iron'],
}

const RENEWABLE_RESOURCES = new Set<ResourceKind>(['fresh_water', 'fertile_soil', 'timber', 'game', 'fish', 'herbs'])

const BASE_SPECIES: EcologySpecies[] = [
  { id: 'red-deer', name: 'Красный олень', kind: 'herbivore', habitats: ['plains', 'forest', 'ancient_forest', 'hills'], foodSpeciesIds: [], temperatureRange: [0.26, 0.82], moistureRange: [0.3, 0.92], reproduction: 0.09, migration: 0.72, danger: 0.2, magical: false },
  { id: 'steppe-aurochs', name: 'Степной тур', kind: 'herbivore', habitats: ['plains', 'hills'], foodSpeciesIds: [], temperatureRange: [0.32, 0.9], moistureRange: [0.18, 0.72], reproduction: 0.055, migration: 0.5, danger: 0.8, magical: false },
  { id: 'marsh-grazer', name: 'Болотный травояд', kind: 'herbivore', habitats: ['swamp', 'coast'], foodSpeciesIds: [], temperatureRange: [0.38, 0.9], moistureRange: [0.68, 1], reproduction: 0.08, migration: 0.42, danger: 0.4, magical: false },
  { id: 'tundra-elk', name: 'Тундровый лось', kind: 'herbivore', habitats: ['tundra', 'hills'], foodSpeciesIds: [], temperatureRange: [0.02, 0.48], moistureRange: [0.18, 0.8], reproduction: 0.045, migration: 0.82, danger: 0.6, magical: false },
  { id: 'stone-goat', name: 'Каменный козёл', kind: 'herbivore', habitats: ['hills', 'mountains'], foodSpeciesIds: [], temperatureRange: [0.12, 0.72], moistureRange: [0.08, 0.72], reproduction: 0.065, migration: 0.58, danger: 0.3, magical: false },
  { id: 'dune-runner', name: 'Песчаный бегун', kind: 'herbivore', habitats: ['desert', 'ashlands'], foodSpeciesIds: [], temperatureRange: [0.58, 1], moistureRange: [0, 0.34], reproduction: 0.075, migration: 0.84, danger: 0.25, magical: false },
  { id: 'grey-wolf', name: 'Серый волк', kind: 'predator', habitats: ['plains', 'forest', 'ancient_forest', 'hills', 'tundra'], foodSpeciesIds: ['red-deer', 'steppe-aurochs', 'tundra-elk', 'stone-goat'], temperatureRange: [0.08, 0.82], moistureRange: [0.12, 0.92], reproduction: 0.038, migration: 0.68, danger: 1.1, magical: false },
  { id: 'cave-bear', name: 'Пещерный медведь', kind: 'predator', habitats: ['forest', 'ancient_forest', 'hills', 'mountains'], foodSpeciesIds: ['red-deer', 'stone-goat'], temperatureRange: [0.12, 0.78], moistureRange: [0.24, 0.9], reproduction: 0.018, migration: 0.32, danger: 1.8, magical: false },
  { id: 'marsh-cat', name: 'Болотная рысь', kind: 'predator', habitats: ['swamp', 'forest', 'coast'], foodSpeciesIds: ['marsh-grazer', 'red-deer'], temperatureRange: [0.34, 0.9], moistureRange: [0.48, 1], reproduction: 0.032, migration: 0.55, danger: 0.9, magical: false },
  { id: 'bone-vulture', name: 'Костяной стервятник', kind: 'scavenger', habitats: ['plains', 'hills', 'desert', 'ashlands', 'mountains'], foodSpeciesIds: [], temperatureRange: [0.2, 1], moistureRange: [0, 0.75], reproduction: 0.06, migration: 0.9, danger: 0.45, magical: false },
]

function neighborIds(tile: WorldTile, world: Pick<WorldData, 'width' | 'height'>): string[] {
  const offsets = tile.x % 2 === 0
    ? [[1, -1], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 0]]
    : [[1, 0], [1, 1], [0, -1], [0, 1], [-1, 0], [-1, 1]]
  return offsets
    .map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy }))
    .filter(({ x, y }) => x >= 0 && y >= 0 && x < world.width && y < world.height)
    .map(({ x, y }) => `${x}:${y}`)
}

function profileTerrain(world: WorldData): WorldTile[] {
  const tileMap = new Map(world.tiles.map((tile) => [tile.id, tile]))
  return world.tiles.map((tile) => {
    const neighbors = neighborIds(tile, world).map((id) => tileMap.get(id)).filter((entry): entry is WorldTile => Boolean(entry))
    const slope = neighbors.length ? neighbors.reduce((sum, entry) => sum + Math.abs(entry.elevation - tile.elevation), 0) / neighbors.length : 0
    const riverNearby = tile.hasRiver || neighbors.some((entry) => entry.hasRiver)
    const coastWater = tile.biome === 'coast' || tile.biome === 'ocean' ? 12 : 0
    const waterAvailability = clamp(tile.moisture * 68 + (riverNearby ? 28 : 0) + coastWater - slope * 22)
    const temperatureComfort = clamp(100 - Math.abs(tile.temperature - 0.56) * 145)
    const soilFertility = clamp(BIOME_FERTILITY[tile.biome] + tile.moisture * 16 + temperatureComfort * 0.08 + (riverNearby ? 12 : 0) - slope * 55 - (tile.magic > 0.82 ? 10 : 0))
    const vegetation = clamp(BIOME_VEGETATION[tile.biome] * 0.72 + soilFertility * 0.22 + waterAvailability * 0.16 - slope * 24)
    const resourceRichness = clamp(22 + tile.elevation * 38 + tile.magic * 24 + (riverNearby ? 8 : 0) + (tile.biome === 'mountains' || tile.biome === 'hills' ? 18 : 0))
    const ecosystemHealth = tile.biome === 'ocean' ? clamp(55 + waterAvailability * 0.25) : clamp((vegetation + soilFertility + waterAvailability) / 3)
    return { ...tile, slope: round1(slope * 100), soilFertility: round1(soilFertility), waterAvailability: round1(waterAvailability), vegetation: round1(vegetation), resourceRichness: round1(resourceRichness), ecosystemHealth: round1(ecosystemHealth) }
  })
}

function createResourceDeposits(seed: string, tiles: WorldTile[]): ResourceDeposit[] {
  const deposits: ResourceDeposit[] = []
  for (const tile of tiles) {
    const rng = new RNG(`${seed}:resources:${tile.id}`)
    const available = RESOURCE_BY_BIOME[tile.biome]
    const count = tile.biome === 'ocean' ? (rng.bool(0.5) ? 1 : 0) : tile.resourceRichness > 75 && rng.bool(0.36) ? 2 : rng.bool(0.54) ? 1 : 0
    for (const kind of rng.shuffle(available).slice(0, count)) {
      const renewable = RENEWABLE_RESOURCES.has(kind)
      const ecologyBonus = kind === 'fertile_soil' ? tile.soilFertility : kind === 'fresh_water' || kind === 'fish' ? tile.waterAvailability : kind === 'timber' || kind === 'herbs' || kind === 'game' ? tile.vegetation : tile.resourceRichness
      deposits.push({
        id: `deposit-${tile.id}-${kind}`,
        tileId: tile.id,
        kind,
        abundance: round1(clamp(ecologyBonus * rng.float(0.72, 1.18))),
        accessibility: round1(clamp(82 - tile.slope * 0.6 - tile.travelCost * 8 + rng.float(-8, 8))),
        renewable,
        regeneration: renewable ? round1(rng.float(0.18, 0.8)) : 0,
        discovered: tile.knowledge >= 3,
      })
    }
  }
  return deposits
}

function monsterEcologySpecies(world: WorldData): EcologySpecies[] {
  return world.monsterSpecies.map((species) => ({
    id: species.id,
    name: species.name,
    kind: 'monster' as const,
    habitats: species.habitats,
    foodSpeciesIds: BASE_SPECIES.filter((entry) => entry.kind === 'herbivore').map((entry) => entry.id),
    temperatureRange: [0.04, 0.98] as [number, number],
    moistureRange: [0.02, 1] as [number, number],
    reproduction: clamp(0.042 - species.threat * 0.003, 0.008, 0.035),
    migration: clamp(0.34 + species.movement * 0.09, 0.25, 0.9),
    danger: species.threat,
    magical: species.origin !== 'natural',
  }))
}

function suitability(species: EcologySpecies, tile: WorldTile): number {
  if (tile.biome === 'ocean') return species.habitats.includes('ocean') ? 1 : 0
  const habitat = species.habitats.includes(tile.biome) ? 1 : 0.12
  const [tempMin, tempMax] = species.temperatureRange
  const [moistureMin, moistureMax] = species.moistureRange
  const tempFit = tile.temperature >= tempMin && tile.temperature <= tempMax ? 1 : clamp(1 - Math.min(Math.abs(tile.temperature - tempMin), Math.abs(tile.temperature - tempMax)) * 3, 0, 1)
  const moistureFit = tile.moisture >= moistureMin && tile.moisture <= moistureMax ? 1 : clamp(1 - Math.min(Math.abs(tile.moisture - moistureMin), Math.abs(tile.moisture - moistureMax)) * 3, 0, 1)
  const terrainFit = species.kind === 'herbivore' ? tile.vegetation / 100 : species.kind === 'monster' ? (tile.magic * 0.45 + tile.resourceRichness / 180 + tile.danger / 24) : tile.ecosystemHealth / 100
  const magicFit = species.magical ? 0.45 + tile.magic * 0.75 : 1 - Math.max(0, tile.magic - 0.82) * 0.7
  return clamp((habitat * 0.42 + tempFit * 0.2 + moistureFit * 0.16 + terrainFit * 0.22) * magicFit, 0, 1.15)
}

function baseCapacity(species: EcologySpecies, tile: WorldTile, prey = 0): number {
  const fit = suitability(species, tile)
  if (species.kind === 'herbivore') return Math.max(2, fit * (tile.vegetation * 1.25 + tile.waterAvailability * 0.42))
  if (species.kind === 'predator') return Math.max(1, fit * (5 + prey * 0.16))
  if (species.kind === 'scavenger') return Math.max(1, fit * (8 + tile.danger * 2.2 + prey * 0.08))
  return Math.max(1, fit * (4 + tile.magic * 16 + tile.resourceRichness * 0.08))
}

function createEcologyPopulations(seed: string, world: WorldData, species: EcologySpecies[]): EcologyPopulation[] {
  const speciesMap = new Map(species.map((entry) => [entry.id, entry]))
  const tileMap = new Map(world.tiles.map((tile) => [tile.id, tile]))
  const populations: EcologyPopulation[] = []

  for (const tile of world.tiles) {
    if (tile.biome === 'ocean') continue
    const rng = new RNG(`${seed}:fauna:${tile.id}`)
    const herbivores = BASE_SPECIES.filter((entry) => entry.kind === 'herbivore' && suitability(entry, tile) >= 0.42)
    if (herbivores.length && rng.bool(0.72)) {
      const chosen = rng.pick(herbivores)
      const capacity = baseCapacity(chosen, tile)
      populations.push({ id: `eco-${chosen.id}-${tile.id}`, speciesId: chosen.id, tileId: tile.id, amount: round1(capacity * rng.float(0.28, 0.82)), carryingCapacity: round1(capacity), health: rng.int(58, 94), migrationPressure: rng.int(0, 22), lastChange: 0 })
      if (herbivores.length > 1 && rng.bool(0.16)) {
        const second = rng.pick(herbivores.filter((entry) => entry.id !== chosen.id))
        const secondCapacity = baseCapacity(second, tile) * 0.58
        populations.push({ id: `eco-${second.id}-${tile.id}`, speciesId: second.id, tileId: tile.id, amount: round1(secondCapacity * rng.float(0.2, 0.62)), carryingCapacity: round1(secondCapacity), health: rng.int(55, 91), migrationPressure: rng.int(0, 25), lastChange: 0 })
      }
    }
    const prey = populations.filter((entry) => entry.tileId === tile.id && speciesMap.get(entry.speciesId)?.kind === 'herbivore').reduce((sum, entry) => sum + entry.amount, 0)
    const predators = BASE_SPECIES.filter((entry) => entry.kind === 'predator' && suitability(entry, tile) >= 0.42)
    if (prey > 18 && predators.length && rng.bool(0.27)) {
      const chosen = rng.pick(predators)
      const capacity = baseCapacity(chosen, tile, prey)
      populations.push({ id: `eco-${chosen.id}-${tile.id}`, speciesId: chosen.id, tileId: tile.id, amount: round1(Math.max(1, capacity * rng.float(0.24, 0.7))), carryingCapacity: round1(capacity), health: rng.int(52, 88), migrationPressure: rng.int(0, 25), lastChange: 0 })
    }
    const scavenger = BASE_SPECIES.find((entry) => entry.id === 'bone-vulture')!
    if (suitability(scavenger, tile) >= 0.4 && rng.bool(0.18)) {
      const capacity = baseCapacity(scavenger, tile, prey)
      populations.push({ id: `eco-${scavenger.id}-${tile.id}`, speciesId: scavenger.id, tileId: tile.id, amount: round1(Math.max(1, capacity * rng.float(0.2, 0.58))), carryingCapacity: round1(capacity), health: rng.int(48, 86), migrationPressure: rng.int(0, 30), lastChange: 0 })
    }
  }

  for (const monster of world.monsterPopulations) {
    const tile = tileMap.get(monster.tileId)
    const ecologySpecies = speciesMap.get(monster.speciesId)
    if (!tile || !ecologySpecies) continue
    const capacity = Math.max(monster.size, baseCapacity(ecologySpecies, tile))
    populations.push({
      id: `eco-${monster.id}`,
      speciesId: monster.speciesId,
      tileId: monster.tileId,
      amount: monster.size,
      carryingCapacity: round1(capacity),
      health: clamp(72 - monster.aggression * 0.12 + coordinateNoise(seed, tile.x, tile.y, `monster-health-${monster.id}`) * 18),
      migrationPressure: clamp(monster.movement * 12),
      lastChange: 0,
      sourceMonsterPopulationId: monster.id,
    })
  }
  return populations
}

function updateSummary(world: WorldData, year: number, day: number, events: EcosystemEvent[], previous = world.ecosystem) {
  const totalFauna = world.ecologyPopulations.reduce((sum, entry) => sum + entry.amount, 0)
  const averageHealth = world.ecologyPopulations.length ? world.ecologyPopulations.reduce((sum, entry) => sum + entry.health, 0) / world.ecologyPopulations.length : 0
  return {
    initializedYear: previous?.initializedYear ?? year,
    lastTickYear: year,
    lastTickDay: day,
    totalFauna: Math.round(totalFauna),
    averageHealth: round1(averageHealth),
    migrations: (previous?.migrations ?? 0) + events.filter((entry) => entry.kind === 'migration').length,
    collapses: (previous?.collapses ?? 0) + events.filter((entry) => entry.kind === 'population_collapse').length,
    extinctions: previous?.extinctions ?? 0,
    recentEvents: [...(previous?.recentEvents ?? []), ...events].slice(-80),
  }
}

export function initializeEcosystem(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = 912): WorldData {
  const tiles = profileTerrain(input)
  const profiled: WorldData = {
    ...input,
    tiles,
    resourceDeposits: createResourceDeposits(seed, tiles),
    ecologySpecies: [...BASE_SPECIES, ...monsterEcologySpecies({ ...input, tiles })],
    ecologyPopulations: [],
    ecosystem: { initializedYear: currentYear - 8, lastTickYear: currentYear - 8, lastTickDay: 1, totalFauna: 0, averageHealth: 0, migrations: 0, collapses: 0, extinctions: 0, recentEvents: [] },
  }
  profiled.ecologyPopulations = createEcologyPopulations(seed, profiled, profiled.ecologySpecies)
  profiled.ecosystem = updateSummary(profiled, currentYear - 8, 1, [], profiled.ecosystem)
  return simulateEcosystemYears(profiled, seed, settings, 8, currentYear - 8)
}

export function ensureEcosystem(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = 912): WorldData {
  if (!input.resourceDeposits?.length || !input.ecologySpecies?.length || !input.ecologyPopulations || !input.ecosystem || input.tiles.some((tile) => tile.soilFertility === undefined)) {
    return initializeEcosystem(seed, input, settings, currentYear)
  }
  return input
}

function advanceEcosystemMonth(world: WorldData, seed: string, settings: WorldGenerationSettings, year: number, monthIndex: number): WorldData {
  const rng = new RNG(`${seed}:ecosystem:${year}:${monthIndex}`)
  const tileMap = new Map(world.tiles.map((tile) => [tile.id, tile]))
  const speciesMap = new Map(world.ecologySpecies.map((entry) => [entry.id, entry]))
  const populationsByTile = new Map<string, EcologyPopulation[]>()
  for (const population of world.ecologyPopulations) {
    const list = populationsByTile.get(population.tileId) ?? []
    list.push(population)
    populationsByTile.set(population.tileId, list)
  }
  const seasonalGrowth = [0.34, 0.38, 0.5, 0.72, 1, 1.12, 1.06, 0.92, 0.72, 0.56, 0.42, 0.34][monthIndex % 12]
  const weatherByTile = new Map<string, { drought: number; flood: number; stress: number }>()
  for (const tile of world.tiles) {
    const weather = coordinateNoise(seed, tile.x + year * 7, tile.y + monthIndex * 13, 'ecosystem-weather')
    const drought = weather < 0.095 ? (0.095 - weather) * 360 : 0
    const flood = weather > 0.93 && tile.moisture > 0.5 ? (weather - 0.93) * 330 : 0
    const winterStress = monthIndex <= 1 || monthIndex >= 10 ? Math.max(0, 0.32 - tile.temperature) * 45 : 0
    weatherByTile.set(tile.id, { drought, flood, stress: clamp(drought + flood * 0.55 + winterStress, 0, 48) })
  }
  const predationByTile = new Map<string, number>()
  for (const [tileId, populations] of populationsByTile) {
    const pressure = populations.reduce((sum, population) => {
      const species = speciesMap.get(population.speciesId)
      return sum + (species?.kind === 'predator' || species?.kind === 'monster' ? population.amount * (species.danger + 0.4) : 0)
    }, 0)
    predationByTile.set(tileId, pressure)
  }

  const updated: EcologyPopulation[] = world.ecologyPopulations.map((population) => {
    const species = speciesMap.get(population.speciesId)
    const tile = tileMap.get(population.tileId)
    if (!species || !tile) return population
    const local = populationsByTile.get(tile.id) ?? []
    const prey = local.filter((entry) => species.foodSpeciesIds.includes(entry.speciesId) || (species.kind === 'monster' && speciesMap.get(entry.speciesId)?.kind === 'herbivore')).reduce((sum, entry) => sum + entry.amount, 0)
    const capacity = baseCapacity(species, tile, prey)
    const load = capacity > 0 ? population.amount / capacity : 2
    const weather = weatherByTile.get(tile.id) ?? { drought: 0, flood: 0, stress: 0 }
    const fit = suitability(species, tile) * (1 - weather.stress / 125)
    const preyFactor = species.kind === 'predator' || species.kind === 'monster' ? clamp(prey / Math.max(8, population.amount * 2.4), 0.15, 1.15) : 1
    const reproduction = population.amount * species.reproduction * seasonalGrowth * fit * preyFactor * Math.max(-0.3, 1 - load)
    const predation = species.kind === 'herbivore' ? (predationByTile.get(tile.id) ?? 0) * 0.018 * clamp(population.amount / 20, 0.25, 1.2) : 0
    const starvation = load > 1 ? population.amount * (load - 1) * 0.045 : species.kind !== 'herbivore' && preyFactor < 0.35 ? population.amount * 0.035 : 0
    const randomLoss = population.amount * rng.float(0, 0.012)
    const nextAmount = Math.max(0, population.amount + reproduction - predation - starvation - randomLoss)
    const desiredHealth = clamp(48 + fit * 44 + preyFactor * 12 - Math.max(0, load - 0.85) * 28 - weather.stress * 0.62)
    const health = clamp(population.health + (desiredHealth - population.health) * 0.18 + rng.float(-2.2, 2.2))
    const migrationPressure = clamp((load - 0.72) * 70 + (55 - health) * 0.75 + (1 - fit) * 45 + (species.kind === 'herbivore' ? (predationByTile.get(tile.id) ?? 0) * 0.45 : 0))
    return { ...population, amount: round1(nextAmount), carryingCapacity: round1(capacity), health: round1(health), migrationPressure: round1(migrationPressure), lastChange: round1(nextAmount - population.amount) }
  })

  const localPopulationEvents: EcosystemEvent[] = []
  for (const population of updated) {
    const previous = world.ecologyPopulations.find((entry) => entry.id === population.id)
    const species = speciesMap.get(population.speciesId)
    if (!previous || !species || previous.amount < 7) continue
    const ratio = population.amount / Math.max(0.1, previous.amount)
    if (ratio < 0.68) localPopulationEvents.push({ id: `eco-event-local-collapse-${year}-${monthIndex}-${population.id}`, year, day: monthIndex * 30 + 1, kind: 'population_collapse', title: `${species.name}: локальный спад`, description: `В районе ${population.tileId} численность упала с ${Math.round(previous.amount)} до ${Math.round(population.amount)}.`, tileIds: [population.tileId], speciesIds: [species.id], magnitude: clamp((1 - ratio) * 100) })
    else if (ratio > 1.24 && population.amount - previous.amount > 5) localPopulationEvents.push({ id: `eco-event-boom-${year}-${monthIndex}-${population.id}`, year, day: monthIndex * 30 + 1, kind: 'population_boom', title: `${species.name}: рост популяции`, description: `В районе ${population.tileId} численность выросла до ${Math.round(population.amount)}.`, tileIds: [population.tileId], speciesIds: [species.id], magnitude: clamp((ratio - 1) * 100) })
  }

  const merged = new Map<string, EcologyPopulation>()
  const incoming = new Map<string, { amount: number; template: EcologyPopulation; tileId: string }>()
  const events: EcosystemEvent[] = [...localPopulationEvents.slice(0, 12)]
  let migrations = 0
  for (const population of updated) {
    const species = speciesMap.get(population.speciesId)
    const currentTile = tileMap.get(population.tileId)
    if (!species || !currentTile) continue
    let remaining = population.amount
    if (population.migrationPressure > 40 && population.amount >= 4 && rng.bool(clamp(species.migration * population.migrationPressure / 72, 0.12, 0.9))) {
      const candidates = neighborIds(currentTile, world)
        .map((id) => tileMap.get(id))
        .filter((entry): entry is WorldTile => Boolean(entry && entry.biome !== 'ocean'))
        .map((tile) => {
          const sameSpecies = updated.find((entry) => entry.tileId === tile.id && entry.speciesId === species.id)
          const capacity = baseCapacity(species, tile, (populationsByTile.get(tile.id) ?? []).filter((entry) => speciesMap.get(entry.speciesId)?.kind === 'herbivore').reduce((sum, entry) => sum + entry.amount, 0))
          const openSpace = capacity - (sameSpecies?.amount ?? 0)
          return { tile, score: suitability(species, tile) * 80 + openSpace * 0.25 - tile.danger * (species.kind === 'herbivore' ? 2.2 : 0.3) }
        })
        .sort((a, b) => b.score - a.score)
      const destination = candidates[0]
      if (destination && destination.score > suitability(species, currentTile) * 55) {
        const moved = round1(population.amount * clamp(0.1 + population.migrationPressure / 240, 0.12, 0.38))
        remaining = round1(population.amount - moved)
        const key = tileKey(population.speciesId, destination.tile.id)
        const existingIncoming = incoming.get(key)
        incoming.set(key, {
          amount: round1((existingIncoming?.amount ?? 0) + moved),
          template: existingIncoming?.template ?? population,
          tileId: destination.tile.id,
        })
        migrations += 1
        if (moved >= 6 || species.kind === 'monster') events.push({ id: `eco-event-migration-${year}-${monthIndex}-${population.id}`, year, day: monthIndex * 30 + 1, kind: 'migration', title: `${species.name}: миграция`, description: `${Math.round(moved)} особей покинули ${currentTile.id} и переместились в ${destination.tile.id}.`, tileIds: [currentTile.id, destination.tile.id], speciesIds: [species.id], magnitude: clamp(moved * (species.danger + 1)) })
      }
    }
    const key = tileKey(population.speciesId, population.tileId)
    const existing = merged.get(key)
    if (existing) merged.set(key, { ...existing, amount: round1(existing.amount + remaining), lastChange: round1(existing.lastChange + population.lastChange) })
    else merged.set(key, { ...population, amount: remaining })
  }

  for (const [key, movement] of incoming) {
    const species = speciesMap.get(movement.template.speciesId)
    const destination = tileMap.get(movement.tileId)
    if (!species || !destination) continue
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, { ...existing, amount: round1(existing.amount + movement.amount), lastChange: round1(existing.lastChange + movement.amount), migrationPressure: clamp(existing.migrationPressure - 12) })
    } else {
      merged.set(key, { ...movement.template, id: `eco-${movement.template.speciesId}-${movement.tileId}`, tileId: movement.tileId, amount: movement.amount, carryingCapacity: round1(baseCapacity(species, destination)), migrationPressure: clamp(movement.template.migrationPressure - 18), lastChange: movement.amount })
    }
  }

  const previousSpeciesTotals = new Map<string, number>()
  for (const population of world.ecologyPopulations) previousSpeciesTotals.set(population.speciesId, (previousSpeciesTotals.get(population.speciesId) ?? 0) + population.amount)
  let ecologyPopulations = [...merged.values()].filter((population) => population.amount >= 0.7)
  const currentSpeciesTotals = new Map<string, number>()
  for (const population of ecologyPopulations) currentSpeciesTotals.set(population.speciesId, (currentSpeciesTotals.get(population.speciesId) ?? 0) + population.amount)
  for (const [speciesId, previousAmount] of previousSpeciesTotals) {
    const currentAmount = currentSpeciesTotals.get(speciesId) ?? 0
    if (previousAmount > 16 && currentAmount < previousAmount * 0.62) {
      const species = speciesMap.get(speciesId)
      events.push({ id: `eco-event-collapse-${year}-${monthIndex}-${speciesId}`, year, day: monthIndex * 30 + 1, kind: 'population_collapse', title: `${species?.name ?? speciesId}: сокращение`, description: `Численность сократилась с ${Math.round(previousAmount)} до ${Math.round(currentAmount)}.`, tileIds: ecologyPopulations.filter((entry) => entry.speciesId === speciesId).map((entry) => entry.tileId).slice(0, 6), speciesIds: [speciesId], magnitude: clamp((1 - currentAmount / previousAmount) * 100) })
    }
  }

  const herbivoreByTile = new Map<string, number>()
  const threatByTile = new Map<string, number>()
  for (const population of ecologyPopulations) {
    const species = speciesMap.get(population.speciesId)
    if (!species) continue
    if (species.kind === 'herbivore') herbivoreByTile.set(population.tileId, (herbivoreByTile.get(population.tileId) ?? 0) + population.amount)
    if (species.kind === 'predator' || species.kind === 'monster') threatByTile.set(population.tileId, (threatByTile.get(population.tileId) ?? 0) + population.amount * species.danger)
  }

  const settlementByTile = new Map(world.settlements.map((entry) => [entry.tileId, entry]))
  const tiles = world.tiles.map((tile) => {
    if (tile.biome === 'ocean') return tile
    const herbivores = herbivoreByTile.get(tile.id) ?? 0
    const exploitation = settlementByTile.has(tile.id) ? 0.9 + (settlementByTile.get(tile.id)?.population ?? 0) / 48000 : 0
    const weather = weatherByTile.get(tile.id) ?? { drought: 0, flood: 0, stress: 0 }
    const waterAvailability = clamp(tile.waterAvailability + tile.moisture * 0.18 + weather.flood * 0.08 - weather.drought * 0.11 - (tile.biome === 'desert' ? 0.08 : 0))
    const climateGrowth = tile.soilFertility * 0.035 + waterAvailability * 0.028
    const grazing = herbivores * 0.035
    const vegetation = clamp(tile.vegetation + climateGrowth * seasonalGrowth - grazing - exploitation - weather.drought * 0.08 - weather.flood * 0.025)
    const threat = threatByTile.get(tile.id) ?? 0
    const ecosystemHealth = clamp((vegetation + tile.soilFertility + waterAvailability) / 3 - Math.max(0, exploitation - 1) * 4 - weather.stress * 0.08)
    const naturalDanger = clamp(1 + threat / 20 + (tile.biome === 'ashlands' ? 3 : 0) + (tile.biome === 'mountains' ? 0.8 : 0), 1, 10)
    return { ...tile, waterAvailability: round1(waterAvailability), vegetation: round1(vegetation), ecosystemHealth: round1(ecosystemHealth), danger: round1(tile.danger * 0.72 + naturalDanger * 0.28) }
  })
  const nextTileMap = new Map(tiles.map((tile) => [tile.id, tile]))

  const deposits = world.resourceDeposits.map((deposit) => {
    const settlement = settlementByTile.get(deposit.tileId)
    const exploited = settlement && settlement.status !== 'ruined'
      ? (deposit.kind === 'timber' && settlement.production.includes('древесина')) || (deposit.kind === 'iron' && settlement.production.includes('железо')) || (deposit.kind === 'stone' && settlement.production.includes('камень')) || (deposit.kind === 'fish' && settlement.production.includes('рыба'))
      : false
    const delta = deposit.renewable ? deposit.regeneration * seasonalGrowth - (exploited ? 0.45 : 0) : exploited ? -0.22 : 0
    return { ...deposit, abundance: round1(clamp(deposit.abundance + delta)) }
  })

  const settlements = world.settlements.map((settlement) => {
    if (settlement.status === 'ruined') return settlement
    const tile = nextTileMap.get(settlement.tileId)
    if (!tile) return settlement
    const localTiles = [tile.id, ...neighborIds(tile, world)]
    const foodBase = localTiles.reduce((sum, id) => sum + (nextTileMap.get(id)?.vegetation ?? 0) + (herbivoreByTile.get(id) ?? 0) * 0.45, 0) / Math.max(1, localTiles.length)
    const threat = localTiles.reduce((sum, id) => sum + (threatByTile.get(id) ?? 0), 0) / Math.max(1, localTiles.length)
    const foodSecurity = clamp(settlement.foodSecurity + (foodBase / 80 - 0.65) * 1.3)
    const safety = clamp(settlement.safety + (3 - threat / 18) * 0.22)
    return { ...settlement, foodSecurity: round1(foodSecurity), safety: round1(safety) }
  })

  const monsterPopulations = world.monsterPopulations.map((monster) => {
    const population = ecologyPopulations.find((entry) => entry.sourceMonsterPopulationId === monster.id)
    if (!population) return { ...monster, size: Math.max(1, Math.round(monster.size * 0.92)) }
    return { ...monster, tileId: population.tileId, size: Math.max(1, Math.round(population.amount)), movement: Math.round(population.migrationPressure / 22), aggression: Math.round(clamp(monster.aggression * 0.75 + (100 - population.health) * 0.25)) }
  })
  const monsterByTile = new Map<string, string>()
  for (const monster of monsterPopulations.sort((a, b) => b.size - a.size)) if (!monsterByTile.has(monster.tileId)) monsterByTile.set(monster.tileId, monster.id)
  const tilesWithMonsters = tiles.map((tile) => ({ ...tile, monsterPopulationId: monsterByTile.get(tile.id) }))

  let next: WorldData = { ...world, tiles: tilesWithMonsters, settlements, resourceDeposits: deposits, ecologyPopulations, monsterPopulations }
  const day = Math.min(360, monthIndex * 30 + 1)
  next.ecosystem = updateSummary(next, year, day, events, { ...world.ecosystem, migrations: world.ecosystem.migrations + migrations - events.filter((entry) => entry.kind === 'migration').length })
  const localExtinctions = [...previousSpeciesTotals.keys()].filter((id) => (previousSpeciesTotals.get(id) ?? 0) >= 4 && (currentSpeciesTotals.get(id) ?? 0) < 0.7).length
  next.ecosystem = { ...next.ecosystem, extinctions: world.ecosystem.extinctions + localExtinctions }
  return next
}

export function simulateEcosystemYears(world: WorldData, seed: string, settings: WorldGenerationSettings, years: number, startYear: number): WorldData {
  let next = world
  const months = Math.max(0, Math.floor(years * 12))
  for (let index = 0; index < months; index += 1) {
    const year = startYear + Math.floor(index / 12)
    next = advanceEcosystemMonth(next, seed, settings, year, index % 12)
  }
  return next
}

export function ecosystemMonthTick(state: GameState): GameState {
  const beforeIds = new Set(state.world.ecosystem.recentEvents.map((entry) => entry.id))
  const monthIndex = Math.max(0, Math.min(11, Math.floor((state.day - 1) / 30)))
  const world = advanceEcosystemMonth(state.world, state.seed, state.settings, state.year, monthIndex)
  const additions = world.ecosystem.recentEvents.filter((entry) => !beforeIds.has(entry.id))
  const important = additions.filter((entry) => entry.magnitude >= 42).slice(-3)
  if (!important.length) return { ...state, world }
  const history = important.map((entry) => ({
    id: `history-${entry.id}`,
    year: entry.year,
    title: entry.title,
    description: entry.description,
    tags: ['ecosystem', entry.kind, ...entry.speciesIds],
    severity: Math.max(1, Math.min(5, Math.ceil(entry.magnitude / 20))),
    kind: entry.kind === 'migration' ? 'migration' as const : 'catastrophe' as const,
    cause: entry.kind === 'migration' ? 'изменение кормовой базы, климата или давления хищников' : 'нарушение устойчивости местной экосистемы',
    consequence: 'Опасность, продовольствие и маршруты в затронутом районе могут измениться.',
    publicVersion: entry.description,
    hiddenTruth: 'Причина определяется взаимодействием климата, ресурсов и соседних популяций.',
    realmIds: [], settlementIds: [], siteIds: [],
  }))
  return {
    ...state,
    world: { ...world, history: [...world.history, ...history].slice(-750) },
    chronicle: [...state.chronicle, ...important.map((entry) => ({ id: `chronicle-${entry.id}`, year: entry.year, day: entry.day, title: entry.title, text: entry.description, category: 'world' as const, importance: Math.max(2, Math.min(5, Math.ceil(entry.magnitude / 20))) }))].slice(-900),
  }
}
