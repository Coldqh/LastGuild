export type BiomeId =
  | 'ocean'
  | 'coast'
  | 'plains'
  | 'forest'
  | 'ancient_forest'
  | 'hills'
  | 'mountains'
  | 'swamp'
  | 'desert'
  | 'tundra'
  | 'ashlands'

export type KnowledgeLevel = 0 | 1 | 2 | 3 | 4 | 5
export type CharacterStatus = 'available' | 'expedition' | 'recovering' | 'missing' | 'dead' | 'retired'
export type ExpeditionStatus = 'planned' | 'active' | 'returning' | 'completed' | 'missing' | 'failed'
export type ViewId = 'headquarters' | 'world' | 'roster' | 'expeditions' | 'archive'

export interface WorldTile {
  id: string
  x: number
  y: number
  elevation: number
  moisture: number
  temperature: number
  biome: BiomeId
  danger: number
  travelCost: number
  knowledge: KnowledgeLevel
  stateId?: string
  settlementId?: string
  siteId?: string
  monsterPopulationId?: string
}

export interface Realm {
  id: string
  name: string
  government: string
  capitalId: string
  color: string
  culture: string
  ruler: string
  attitude: number
  wealth: number
  military: number
  stability: number
  description: string
}

export interface Settlement {
  id: string
  name: string
  tileId: string
  realmId: string
  kind: 'village' | 'town' | 'city' | 'capital' | 'fortress' | 'monastery'
  population: number
  prosperity: number
  safety: number
  traits: string[]
  isGuildHome?: boolean
}

export interface Site {
  id: string
  name: string
  tileId: string
  type: 'ruins' | 'dungeon' | 'tower' | 'tomb' | 'mine' | 'shrine' | 'anomaly' | 'lair'
  origin: string
  age: number
  danger: number
  depth: number
  state: 'unknown' | 'rumored' | 'discovered' | 'surveyed' | 'cleared'
  monsterTags: string[]
  rewards: string[]
  truth: string
}

export interface MonsterSpecies {
  id: string
  name: string
  origin: 'natural' | 'magical' | 'undead' | 'construct' | 'planar' | 'civilized'
  habitats: BiomeId[]
  threat: number
  behavior: string
  weakness: string
}

export interface MonsterPopulation {
  id: string
  speciesId: string
  tileId: string
  size: number
  aggression: number
  movement: number
}

export interface WorldData {
  seed: string
  width: number
  height: number
  tiles: WorldTile[]
  realms: Realm[]
  settlements: Settlement[]
  sites: Site[]
  monsterSpecies: MonsterSpecies[]
  monsterPopulations: MonsterPopulation[]
  startSettlementId: string
  history: HistoricalEvent[]
}

export interface HistoricalEvent {
  id: string
  year: number
  title: string
  description: string
  tags: string[]
}

export interface CharacterStats {
  strength: number
  agility: number
  endurance: number
  intellect: number
  will: number
  presence: number
}

export interface CharacterSkills {
  combat: number
  survival: number
  scouting: number
  medicine: number
  arcana: number
  history: number
  cartography: number
  diplomacy: number
  leadership: number
}

export interface CharacterMemory {
  id: string
  title: string
  intensity: number
  valence: 'positive' | 'negative' | 'mixed'
  year: number
}

export interface Character {
  id: string
  name: string
  portraitSeed: number
  age: number
  ancestry: string
  culture: string
  profession: string
  level: number
  status: CharacterStatus
  employed: boolean
  salary: number
  health: number
  fatigue: number
  stress: number
  loyalty: number
  fame: number
  traits: string[]
  ambition: string
  fear: string
  stats: CharacterStats
  skills: CharacterSkills
  injuries: string[]
  relationships: Record<string, number>
  memories: CharacterMemory[]
  expeditions: number
  discoveries: number
}

export interface GuildRoom {
  id: string
  name: string
  level: number
  condition: number
  capacity: number
  maintenance: number
  description: string
  effect: string
  upgradeCost: number
}

export interface GuildData {
  name: string
  rank: number
  treasury: number
  debt: number
  debtInterest: number
  reputation: number
  scientificAuthority: number
  adventurerPrestige: number
  politicalInfluence: number
  stability: number
  supplies: number
  medicine: number
  artifacts: number
  knowledge: Record<string, number>
  rooms: GuildRoom[]
  maxActiveExpeditions: number
  daysSincePayment: number
}

export interface ExpeditionLogEntry {
  day: number
  title: string
  text: string
  type: 'travel' | 'event' | 'combat' | 'discovery' | 'injury' | 'death' | 'report'
}

export interface Expedition {
  id: string
  name: string
  status: ExpeditionStatus
  objectiveType: string
  objectiveText: string
  targetTileId: string
  memberIds: string[]
  leaderId: string
  route: string[]
  routeIndex: number
  progress: number
  departureDay: number
  expectedDays: number
  daysElapsed: number
  food: number
  medicine: number
  morale: number
  cohesion: number
  riskPolicy: 'cautious' | 'standard' | 'bold'
  retreatThreshold: number
  budget: number
  reward: number
  logs: ExpeditionLogEntry[]
  discoveries: string[]
  casualties: string[]
}

export interface Opportunity {
  id: string
  title: string
  type: string
  description: string
  source: string
  targetTileId: string
  reward: number
  deadlineDay: number
  dangerEstimate: number
  knowledgeRequirement: number
  accepted: boolean
}

export interface ChronicleEntry {
  id: string
  day: number
  year: number
  title: string
  text: string
  category: 'guild' | 'expedition' | 'world' | 'character' | 'discovery'
  importance: number
}

export interface GameState {
  version: number
  seed: string
  day: number
  year: number
  season: number
  guild: GuildData
  world: WorldData
  characters: Character[]
  expeditions: Expedition[]
  opportunities: Opportunity[]
  chronicle: ChronicleEntry[]
}
