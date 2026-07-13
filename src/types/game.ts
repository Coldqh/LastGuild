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
export type CharacterCareerStage = 'recruit' | 'field' | 'veteran' | 'leader' | 'mentor' | 'legend'
export type ExpeditionStatus = 'planned' | 'active' | 'returning' | 'completed' | 'missing' | 'failed'
export type ViewId = 'headquarters' | 'world' | 'roster' | 'expeditions' | 'archive'
export type DifficultyId = 'story' | 'standard' | 'hard' | 'brutal'
export type MapSizeId = 'compact' | 'regional' | 'vast'
export type DensityId = 'sparse' | 'normal' | 'dense'
export type HistoryDepthId = 'young' | 'old' | 'ancient'
export type ConflictLevelId = 'calm' | 'turbulent' | 'war_torn'
export type MagicLevelId = 'rare' | 'common' | 'wild'
export type ClimateId = 'temperate' | 'varied' | 'harsh'
export type WorldPresetId = 'classic' | 'fallen_empires' | 'wild_frontier' | 'age_of_war' | 'custom'
export type DiscoveryDisposition = 'unreviewed' | 'published' | 'archived' | 'sold' | 'secret'
export type ConsequenceStatus = 'pending' | 'resolved'
export type GuildPositionId = 'expedition_master' | 'chief_archivist' | 'quartermaster' | 'chief_healer' | 'mentor' | 'diplomat'
export type CombatRole = 'frontline' | 'skirmisher' | 'ranged' | 'support' | 'controller'
export type CombatStatus = 'active' | 'victory' | 'retreated' | 'defeat'
export type CombatCommandType = 'focus' | 'protect' | 'rally' | 'retreat'
export type CombatUnitStatus = 'ready' | 'wounded' | 'panicked' | 'down' | 'dead'

export interface WorldGenerationSettings {
  preset: WorldPresetId
  mapSize: MapSizeId
  realmCount: number
  settlementDensity: DensityId
  ruinDensity: DensityId
  monsterDensity: DensityId
  historyDepth: HistoryDepthId
  conflictLevel: ConflictLevelId
  magicLevel: MagicLevelId
  climate: ClimateId
  difficulty: DifficultyId
  startingKnowledge: 1 | 2 | 3
}

export interface WorldTile {
  id: string
  x: number
  y: number
  elevation: number
  moisture: number
  temperature: number
  magic: number
  biome: BiomeId
  danger: number
  travelCost: number
  knowledge: KnowledgeLevel
  hasRoad?: boolean
  hasRiver?: boolean
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
  dominantFaith: string
  currentIssue: string
  relations: Record<string, number>
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

export interface DungeonZone {
  id: string
  name: string
  kind: 'entrance' | 'passage' | 'hall' | 'workshop' | 'sanctum' | 'vault' | 'lair' | 'depths'
  danger: number
  historyLayer: string
  description: string
  connections: string[]
  guardSpeciesId?: string
  trap?: string
  rewards: string[]
  explored: boolean
  secured: boolean
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
  layers: string[]
  zones: DungeonZone[]
  exploration: number
  campEstablished: boolean
}

export interface MonsterSpecies {
  id: string
  name: string
  origin: 'natural' | 'magical' | 'undead' | 'construct' | 'planar' | 'civilized'
  habitats: BiomeId[]
  threat: number
  behavior: string
  weakness: string
  abilities: string[]
  trophy: string
  armor: number
  movement: number
}

export interface MonsterPopulation {
  id: string
  speciesId: string
  tileId: string
  size: number
  aggression: number
  movement: number
  legendary?: boolean
  legendaryName?: string
  history?: string
  scars?: string[]
  lairSiteId?: string
}

export interface WorldRoute {
  id: string
  name: string
  type: 'road' | 'trade' | 'river'
  tileIds: string[]
  importance: number
}

export interface WorldData {
  seed: string
  width: number
  height: number
  tiles: WorldTile[]
  realms: Realm[]
  settlements: Settlement[]
  sites: Site[]
  routes: WorldRoute[]
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
  severity?: number
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
  description: string
  intensity: number
  valence: 'positive' | 'negative' | 'mixed'
  type: 'expedition' | 'loss' | 'rescue' | 'betrayal' | 'discovery' | 'injury' | 'career'
  year: number
  day: number
  expeditionId?: string
  relatedCharacterIds?: string[]
}

export interface CharacterInjuryRecord {
  id: string
  name: string
  severity: 1 | 2 | 3 | 4 | 5
  permanent: boolean
  recoveryDays: number
  effect: string
  sourceExpeditionId?: string
  treated: boolean
}

export interface CombatBehavior {
  role: CombatRole
  preferredRange: number
  aggression: number
  protectWeak: boolean
  retreatAt: number
  conserveAbilities: boolean
}

export interface Character {
  id: string
  name: string
  portraitSeed: number
  age: number
  ancestry: string
  culture: string
  profession: string
  origin: string
  homeSettlementId: string
  level: number
  experience: number
  careerStage: CharacterCareerStage
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
  injuryRecords: CharacterInjuryRecord[]
  relationships: Record<string, number>
  memories: CharacterMemory[]
  expeditions: number
  discoveries: number
  combatBehavior: CombatBehavior
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

export interface GuildPosition {
  id: GuildPositionId
  name: string
  holderId?: string
  description: string
  effect: string
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
  positions: GuildPosition[]
  maxActiveExpeditions: number
  daysSincePayment: number
}

export interface ExpeditionLogEntry {
  day: number
  title: string
  text: string
  type: 'travel' | 'event' | 'combat' | 'discovery' | 'injury' | 'death' | 'report'
}

export interface ExpeditionRiskProfile {
  route: number
  combat: number
  climate: number
  disease: number
  politics: number
  magic: number
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
  riskProfile: ExpeditionRiskProfile
  logs: ExpeditionLogEntry[]
  discoveries: string[]
  casualties: string[]
  reports: ExpeditionReport[]
  battles: number
  dungeonSiteIds: string[]
  officialReportId?: string
  leadDiscovererId?: string
  discoveryDisposition?: DiscoveryDisposition
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
  requiredRoles: string[]
  riskProfile: ExpeditionRiskProfile
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

export interface DiscoveryRecord {
  id: string
  title: string
  type: 'site' | 'route' | 'document' | 'artifact' | 'monster' | 'knowledge'
  expeditionId: string
  tileId: string
  siteId?: string
  createdDay: number
  createdYear: number
  discovererIds: string[]
  leadDiscovererId?: string
  evidenceQuality: number
  value: number
  disposition: DiscoveryDisposition
  summary: string
  consequenceIds: string[]
}

export interface WorldConsequence {
  id: string
  discoveryId: string
  title: string
  text: string
  kind: 'trade' | 'politics' | 'religion' | 'settlement' | 'monsters' | 'reputation'
  status: ConsequenceStatus
  dueTick: number
  magnitude: number
  targetRealmId?: string
  targetSettlementId?: string
}

export interface ExpeditionReport {
  id: string
  authorId: string
  kind: 'official' | 'medical' | 'personal' | 'cartographic'
  title: string
  claim: string
  reliability: number
  contradictsReportId?: string
}

export interface ExpeditionDebrief {
  expeditionId: string
  createdDay: number
  createdYear: number
  success: boolean
  reward: number
  survivorIds: string[]
  casualtyIds: string[]
  injuredIds: string[]
  discoveryIds: string[]
  reports: ExpeditionReport[]
  battles: number
  dungeonSiteIds: string[]
  suggestedLeadId?: string
}

export interface DecisionEffects {
  food?: number
  medicine?: number
  morale?: number
  cohesion?: number
  progress?: number
  guildReputation?: number
  reveal?: boolean
  injuryChance?: number
  discoveryChance?: number
  startCombat?: 'monster' | 'site_guardians'
  combatAdvantage?: number
  startDungeon?: boolean
}

export interface ExpeditionDecisionChoice {
  id: string
  label: string
  description: string
  skill?: keyof CharacterSkills
  difficulty?: number
  successText: string
  failureText?: string
  successEffects: DecisionEffects
  failureEffects?: DecisionEffects
}

export interface ExpeditionDecision {
  id: string
  expeditionId: string
  title: string
  text: string
  locationTileId: string
  choices: ExpeditionDecisionChoice[]
}


export interface CombatGridCell {
  x: number
  y: number
  obstacle?: 'rock' | 'tree' | 'ruin' | 'pit'
}

export interface CombatUnit {
  id: string
  sourceId: string
  name: string
  side: 'guild' | 'enemy'
  x: number
  y: number
  hp: number
  maxHp: number
  armor: number
  attack: number
  range: number
  movement: number
  initiative: number
  morale: number
  role: CombatRole
  status: CombatUnitStatus
  ability?: string
  legendary?: boolean
  damageTaken: number
  kills: number
}

export interface CombatLogEntry {
  round: number
  text: string
  type: 'move' | 'attack' | 'ability' | 'injury' | 'death' | 'morale' | 'command'
}

export interface CombatEncounter {
  id: string
  expeditionId: string
  tileId: string
  siteId?: string
  zoneId?: string
  speciesId: string
  populationId?: string
  title: string
  width: number
  height: number
  round: number
  status: CombatStatus
  commandPoints: number
  cells: CombatGridCell[]
  units: CombatUnit[]
  logs: CombatLogEntry[]
  focusTargetId?: string
  protectedCharacterId?: string
  retreatOrdered: boolean
  advantage: number
}

export interface DungeonExploration {
  id: string
  expeditionId: string
  siteId: string
  currentZoneId: string
  discoveredZoneIds: string[]
  securedZoneIds: string[]
  logs: string[]
}

export interface BestiaryEntry {
  speciesId: string
  sightings: number
  encounters: number
  victories: number
  kills: number
  deathsCaused: number
  knowledge: number
  discoveredWeakness: boolean
  notes: string[]
  legendaryNames: string[]
}

export interface GameState {
  version: number
  seed: string
  settings: WorldGenerationSettings
  day: number
  year: number
  season: number
  guild: GuildData
  world: WorldData
  characters: Character[]
  expeditions: Expedition[]
  opportunities: Opportunity[]
  chronicle: ChronicleEntry[]
  discoveries: DiscoveryRecord[]
  consequences: WorldConsequence[]
  pendingDecision?: ExpeditionDecision
  pendingDebrief?: ExpeditionDebrief
  pendingCombat?: CombatEncounter
  pendingDungeon?: DungeonExploration
  bestiary: BestiaryEntry[]
}
