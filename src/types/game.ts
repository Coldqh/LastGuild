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
export type ViewId = 'headquarters' | 'campaign' | 'hiring' | 'roster' | 'rooms' | 'positions' | 'legacy' | 'world' | 'expeditions' | 'active_expeditions' | 'archive' | 'influence' | 'living_world' | 'lore'
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
export type RivalGuildArchetype = 'royal' | 'academic' | 'hunters' | 'traders' | 'relic_raiders' | 'religious' | 'free_company' | 'secret'
export type RivalGuildStance = 'allied' | 'cooperative' | 'neutral' | 'competitive' | 'hostile'
export type RivalGuildFocus = 'cartography' | 'archaeology' | 'monsters' | 'diplomacy' | 'magic' | 'trade'
export type CrisisKind = 'war' | 'succession' | 'epidemic' | 'religious' | 'monster_migration' | 'trade_collapse' | 'magical_storm' | 'rebellion'
export type CrisisStatus = 'emerging' | 'active' | 'resolved' | 'collapsed'
export type RivalExpeditionStatus = 'preparing' | 'traveling' | 'completed' | 'failed'
export type WorldChangeSpeedId = 'slow' | 'normal' | 'fast'
export type WarFrequencyId = 'rare' | 'normal' | 'frequent'
export type EconomyVolatilityId = 'stable' | 'normal' | 'harsh'
export type CityGrowthId = 'slow' | 'normal' | 'fast'
export type CatastropheFrequencyId = 'rare' | 'normal' | 'frequent'
export type DiscoveryImpactId = 'limited' | 'normal' | 'dramatic'
export type SettlementStatus = 'active' | 'declining' | 'ruined'
export type RouteStatus = 'active' | 'disrupted' | 'abandoned'
export type WarStatus = 'preparing' | 'active' | 'truce' | 'ended'
export type KnowledgeSpreadStage = 'found' | 'verified' | 'published' | 'contested' | 'spreading' | 'used'
export type StoryChainKind = 'lost_expedition' | 'fallen_civilization' | 'legendary_monster' | 'artifact' | 'religious_secret' | 'lost_route' | 'vanished_city' | 'state_conspiracy'
export type StoryChainRarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export type StoryChainStatus = 'dormant' | 'active' | 'completed' | 'failed'
export type StoryStageStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed'
export type ArtifactStatus = 'rumored' | 'lost' | 'located' | 'partial' | 'recovered' | 'destroyed'
export type ArtifactOwnerType = 'lost' | 'guild' | 'realm' | 'rival' | 'faith'
export type ContentValidationSeverity = 'error' | 'warning'

export type CampaignPhaseId = 'survival' | 'regional' | 'discovery' | 'influence' | 'world' | 'institution'
export type CampaignGoalType = 'map_region' | 'find_empire' | 'slay_legend' | 'expose_lie' | 'world_institute' | 'great_artifact'
export type CampaignGoalStatus = 'offered' | 'selected' | 'completed'
export type GuildIdentityPathId = 'scholars' | 'hunters' | 'royal' | 'independent' | 'traders' | 'wardens'
export type ContentEventRarity = 'common' | 'regional' | 'rare' | 'legendary'

export type ResourceKind = 'fresh_water' | 'fertile_soil' | 'timber' | 'game' | 'fish' | 'stone' | 'iron' | 'salt' | 'herbs' | 'crystal' | 'obsidian'
export type EcologySpeciesKind = 'herbivore' | 'predator' | 'scavenger' | 'monster'
export type EcosystemEventKind = 'migration' | 'population_boom' | 'population_collapse' | 'habitat_shift' | 'predator_pressure' | 'resource_change'
export type PeopleStatus = 'stable' | 'migrating' | 'declining' | 'displaced'
export type CommunityStatus = 'settled' | 'migrating' | 'nomadic'
export type SettlementSpecialization = 'subsistence' | 'farming' | 'fishing' | 'mining' | 'forestry' | 'trade' | 'fortress' | 'religious' | 'arcane' | 'craft'
export type SocietyEventKind = 'migration' | 'settlement_founded' | 'settlement_abandoned' | 'cultural_blend' | 'famine' | 'recovery' | 'population_growth'
export type TerritoryControlStatus = 'core' | 'controlled' | 'frontier' | 'contested' | 'occupied' | 'unclaimed'
export type RealmObjectiveKind = 'secure_border' | 'control_route' | 'capture_resource' | 'recover_claim' | 'subjugate_neighbor' | 'suppress_revolt' | 'clear_monsters' | 'gain_river_access'
export type ArmyStatus = 'garrison' | 'moving' | 'frontline' | 'retreating' | 'broken'
export type WarType = 'border' | 'conquest' | 'religious' | 'civil' | 'separatist' | 'dynastic' | 'trade' | 'defensive'
export type PoliticalEventKind = 'realm_founded' | 'realm_collapsed' | 'claim_created' | 'war_started' | 'border_shift' | 'army_moved' | 'occupation' | 'peace' | 'rebellion' | 'vassalage'
export type HistoricalPersonRole = 'founder' | 'ruler' | 'commander' | 'prophet' | 'rebel' | 'scholar' | 'explorer' | 'artifact_creator'


export interface ResourceDeposit {
  id: string
  tileId: string
  kind: ResourceKind
  abundance: number
  accessibility: number
  renewable: boolean
  regeneration: number
  discovered: boolean
}

export interface EcologySpecies {
  id: string
  name: string
  kind: EcologySpeciesKind
  habitats: BiomeId[]
  foodSpeciesIds: string[]
  temperatureRange: [number, number]
  moistureRange: [number, number]
  reproduction: number
  migration: number
  danger: number
  magical: boolean
}

export interface EcologyPopulation {
  id: string
  speciesId: string
  tileId: string
  amount: number
  carryingCapacity: number
  health: number
  migrationPressure: number
  lastChange: number
  sourceMonsterPopulationId?: string
}

export interface EcosystemEvent {
  id: string
  year: number
  day: number
  kind: EcosystemEventKind
  title: string
  description: string
  tileIds: string[]
  speciesIds: string[]
  magnitude: number
}

export interface EcosystemState {
  initializedYear: number
  lastTickYear: number
  lastTickDay: number
  totalFauna: number
  averageHealth: number
  migrations: number
  collapses: number
  extinctions: number
  recentEvents: EcosystemEvent[]
}


export interface PeopleGroup {
  id: string
  name: string
  ancestry: string
  population: number
  homelandTileIds: string[]
  cultureId: string
  subsistence: string
  climateAdaptation: string
  magicAttitude: string
  migrationPressure: number
  health: number
  relations: Record<string, number>
  foundedYear: number
  status: PeopleStatus
}

export interface CultureProfile {
  id: string
  name: string
  peopleId: string
  originBiome: BiomeId
  subsistence: string
  architecture: string
  dress: string
  militaryTradition: string
  religion: string
  magicAttitude: string
  monsterPolicy: string
  values: string[]
  taboos: string[]
  valuedResources: ResourceKind[]
  settlementStyle: string
  language: string
  formedYear: number
  parentCultureIds: string[]
}

export interface PopulationCommunity {
  id: string
  peopleId: string
  cultureId: string
  tileId: string
  settlementId?: string
  amount: number
  health: number
  foodSecurity: number
  waterSecurity: number
  housing: number
  migrationPressure: number
  status: CommunityStatus
  lastChange: number
}

export interface SocietyEvent {
  id: string
  year: number
  kind: SocietyEventKind
  title: string
  description: string
  tileIds: string[]
  settlementIds: string[]
  peopleIds: string[]
  cultureIds: string[]
  magnitude: number
}

export interface SocietyState {
  initializedYear: number
  lastTickYear: number
  totalPopulation: number
  migrations: number
  foundations: number
  abandonments: number
  culturalBlends: number
  recentEvents: SocietyEvent[]
}

export interface RealmObjective {
  id: string
  kind: RealmObjectiveKind
  title: string
  targetRealmId?: string
  targetTileIds: string[]
  targetSettlementIds: string[]
  priority: number
  progress: number
  reason: string
  createdYear: number
}

export interface RealmArmy {
  id: string
  realmId: string
  name: string
  tileId: string
  homeSettlementId: string
  targetTileId?: string
  status: ArmyStatus
  soldiers: number
  quality: number
  morale: number
  supply: number
  experience: number
  movement: number
  casualties: number
  objectiveId?: string
  warId?: string
}

export interface PoliticalEvent {
  id: string
  year: number
  day: number
  kind: PoliticalEventKind
  title: string
  description: string
  realmIds: string[]
  tileIds: string[]
  settlementIds: string[]
  magnitude: number
}

export interface PoliticalSimulationState {
  initializedYear: number
  lastTickYear: number
  lastTickDay: number
  borderChanges: number
  occupations: number
  warsStarted: number
  warsEnded: number
  realmCollapses: number
  activeClaims: number
  recentEvents: PoliticalEvent[]
}

export interface HistoricalPerson {
  id: string
  name: string
  role: HistoricalPersonRole
  ancestry: string
  cultureId?: string
  realmId?: string
  settlementId?: string
  bornYear: number
  diedYear?: number
  ambition: string
  reputation: number
  legacy: string
  eventIds: string[]
  artifactIds: string[]
}

export interface ArtifactOwnershipRecord {
  year: number
  ownerType: ArtifactOwnerType
  ownerId?: string
  eventId?: string
  note: string
}

export interface HistoricalSimulationState {
  startYear: number
  endYear: number
  yearsSimulated: number
  snapshotsCreated: number
  majorEvents: number
  warsRecorded: number
  realmsFounded: number
  realmsCollapsed: number
  settlementsRuined: number
  artifactsCreated: number
  figuresCreated: number
  auditWarnings: string[]
  elapsedMs: number
}

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
  worldChangeSpeed: WorldChangeSpeedId
  warFrequency: WarFrequencyId
  economyVolatility: EconomyVolatilityId
  cityGrowth: CityGrowthId
  catastropheFrequency: CatastropheFrequencyId
  discoveryImpact: DiscoveryImpactId
}

export interface WorldTile {
  id: string
  x: number
  y: number
  elevation: number
  moisture: number
  temperature: number
  magic: number
  slope: number
  soilFertility: number
  waterAvailability: number
  vegetation: number
  resourceRichness: number
  ecosystemHealth: number
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
  dominantPeopleId?: string
  dominantCultureId?: string
  populationDensity?: number
  migrationPressure?: number
  legalRealmId?: string
  controllerRealmId?: string
  claimedByRealmIds?: string[]
  controlStrength?: number
  controlStatus?: TerritoryControlStatus
  supplyAccess?: number
  resistance?: number
  fortification?: number
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
  foundedYear?: number
  governmentType?: string
  legitimacy?: number
  taxCapacity?: number
  administrativeReach?: number
  warExhaustion?: number
  treasury?: number
  manpower?: number
  cohesion?: number
  objective?: RealmObjective
  coreTileIds?: string[]
  claimTileIds?: string[]
  subjectRealmIds?: string[]
  overlordRealmId?: string
  collapsedYear?: number
  predecessorOfRealmId?: string
  successorOfRealmId?: string
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
  foundedYear: number
  status: SettlementStatus
  production: string[]
  demand: string[]
  tradeBalance: number
  growth: number
  foodSecurity: number
  unrest: number
  peopleId: string
  cultureId: string
  cultureShares: Record<string, number>
  originReason: string
  specialization: SettlementSpecialization
  waterSecurity: number
  housing: number
  materials: number
  labor: number
  sanitation: number
  tradeAccess: number
  migrationPressure: number
  parentSettlementId?: string
  abandonedYear?: number
  lastOwnerRealmId?: string
  legalRealmId?: string
  occupationRealmId?: string
  loyalty?: number
  fortification?: number
  garrison?: number
  taxValue?: number
  resistance?: number
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
  civilizationId?: string
  regionalIdentityId?: string
  foundedYear?: number
  destroyedYear?: number
  originalSettlementId?: string
  formerRealmIds?: string[]
  historicalPersonIds?: string[]
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
  originSettlementId?: string
  destinationSettlementId?: string
  goods: string[]
  income: number
  safety: number
  seasonality: number
  status: RouteStatus
  establishedYear: number
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
  resourceDeposits: ResourceDeposit[]
  ecologySpecies: EcologySpecies[]
  ecologyPopulations: EcologyPopulation[]
  ecosystem: EcosystemState
  peoples: PeopleGroup[]
  cultures: CultureProfile[]
  communities: PopulationCommunity[]
  society: SocietyState
  armies: RealmArmy[]
  politics: PoliticalSimulationState
  startSettlementId: string
  history: HistoricalEvent[]
  historicalPeople: HistoricalPerson[]
  historicalArtifacts: ArtifactRecord[]
  historicalCivilizations: AncientCivilization[]
  historicalSnapshots: HistoricalMapSnapshot[]
  historicalCurrentWars: WorldWar[]
  historicalSimulation: HistoricalSimulationState
}

export interface HistoricalEvent {
  id: string
  year: number
  day?: number
  title: string
  description: string
  tags: string[]
  severity?: number
  kind?: 'state' | 'war' | 'trade' | 'religion' | 'catastrophe' | 'migration' | 'settlement' | 'discovery'
  cause?: string
  consequence?: string
  publicVersion?: string
  hiddenTruth?: string
  realmIds?: string[]
  settlementIds?: string[]
  siteIds?: string[]
  tileIds?: string[]
  personIds?: string[]
  causeEventIds?: string[]
  consequenceEventIds?: string[]
  evidenceIds?: string[]
  actualOutcome?: string
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
  mentorId?: string
  apprenticeIds: string[]
  rivalGuildId?: string
  generationId?: string
  familyName?: string
  relativeIds: string[]
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
  leaderId?: string
  institutionalMemory: number
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
  opportunityId?: string
  storyChainId?: string
  storyStageId?: string
  contentEventIds?: string[]
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
  contestedByIds?: string[]
  greatContract?: boolean
  storyChainId?: string
  storyStageId?: string
  contentTags?: string[]
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
  civilizationId?: string
  artifactId?: string
  storyChainId?: string
  loreTags?: string[]
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
  contentEventId?: string
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


export interface WorldWar {
  id: string
  name: string
  attackerRealmId: string
  defenderRealmId: string
  cause: string
  goal: string
  status: WarStatus
  startedYear: number
  startedDay: number
  progress: number
  attackerExhaustion: number
  defenderExhaustion: number
  attackerSupply: number
  defenderSupply: number
  frontSettlementIds: string[]
  capturedSettlementIds: string[]
  casualties: number
  type?: WarType
  warScore?: number
  frontTileIds?: string[]
  occupiedTileIds?: string[]
  claimedSettlementIds?: string[]
  allianceRealmIds?: string[]
  peaceTerms?: string
  attackerArmyIds?: string[]
  defenderArmyIds?: string[]
  lastEvent?: string
  endedYear?: number
  endedDay?: number
}

export interface KnowledgeSpread {
  id: string
  discoveryId: string
  title: string
  stage: KnowledgeSpreadStage
  progress: number
  credibility: number
  controversy: number
  knownRealmIds: string[]
  interestedFactionIds: string[]
  startedYear: number
  startedDay: number
  lastUpdate: string
}

export interface HistoricalMapSnapshot {
  id: string
  year: number
  title: string
  realmByTile: Record<string, string | undefined>
  settlementStates: Record<string, { realmId: string; population: number; prosperity: number; status: SettlementStatus }>
  routeStates: Record<string, RouteStatus>
  eventIds: string[]
}

export interface PoliticalFaction {
  id: string
  realmId: string
  name: string
  kind: 'court' | 'army' | 'faith' | 'merchants' | 'scholars' | 'local'
  influence: number
  attitude: number
  agenda: string
  currentDemand: string
}

export interface RivalGuild {
  id: string
  name: string
  archetype: RivalGuildArchetype
  headquartersSettlementId: string
  leaderName: string
  leaderTrait: string
  specialization: RivalGuildFocus
  budget: number
  reputation: number
  scientificAuthority: number
  fieldStrength: number
  secrecy: number
  ethics: number
  relation: number
  stance: RivalGuildStance
  methods: string[]
  favoredRealmId: string
  discoveries: number
  losses: number
  activeExpeditionIds: string[]
}

export interface RivalExpedition {
  id: string
  rivalGuildId: string
  opportunityId: string
  targetTileId: string
  title: string
  status: RivalExpeditionStatus
  startedDay: number
  startedYear: number
  etaDays: number
  progress: number
  strength: number
  secrecy: number
}

export interface WorldCrisis {
  id: string
  kind: CrisisKind
  title: string
  description: string
  realmIds: string[]
  settlementIds: string[]
  severity: number
  progress: number
  status: CrisisStatus
  startedYear: number
  startedDay: number
  playerContribution: number
  effects: string[]
}

export interface Mentorship {
  id: string
  mentorId: string
  apprenticeId: string
  startedYear: number
  startedDay: number
  progress: number
  inheritedSkill: keyof CharacterSkills
  doctrine: string
}


export interface GuildDoctrine {
  id: string
  name: string
  founderId: string
  generationId: string
  createdYear: number
  createdDay: number
  principle: string
  bonus: string
  weakness: string
  support: number
  graduateIds: string[]
}

export interface GuildGeneration {
  id: string
  name: string
  startedYear: number
  endedYear?: number
  memberIds: string[]
  doctrineIds: string[]
  definingEvents: string[]
}

export interface GuildMemorial {
  id: string
  characterId: string
  type: 'portrait' | 'hall' | 'award' | 'school' | 'memorial'
  name: string
  createdYear: number
  createdDay: number
  effect: string
}



export interface AncientCivilization {
  id: string
  templateId: string
  name: string
  people: string
  era: string
  architecture: string
  religion: string
  magicTradition: string
  riseCause: string
  fallCause: string
  legacy: string[]
  siteIds: string[]
  territoryTileIds: string[]
  artifactIds: string[]
  knownLevel: number
  publicHistory: string
  hiddenTruth: string
}

export interface ArtifactRecord {
  id: string
  name: string
  civilizationId?: string
  creator: string
  originalPurpose: string
  power: string
  cost: string
  publicLegend: string
  hiddenTruth: string
  currentSiteId?: string
  ownerType: ArtifactOwnerType
  ownerId?: string
  parts: number
  recoveredParts: number
  status: ArtifactStatus
  relatedDiscoveryIds: string[]
  knownLevel: number
  createdYear?: number
  creatorPersonId?: string
  ownerHistory?: ArtifactOwnershipRecord[]
}

export interface RegionalIdentity {
  id: string
  name: string
  centerTileId: string
  tileIds: string[]
  dominantBiomes: BiomeId[]
  cultures: string[]
  architecture: string
  goods: string[]
  threats: string[]
  politicalProblem: string
  legends: string[]
  siteIds: string[]
  knownLevel: number
}

export interface StoryStage {
  id: string
  title: string
  description: string
  objectiveType: string
  requiredRoles: string[]
  reward: number
  dangerModifier: number
  targetTileId: string
  siteId?: string
  artifactId?: string
  civilizationId?: string
  status: StoryStageStatus
  opportunityId?: string
  completionText: string
}

export interface StoryChain {
  id: string
  title: string
  summary: string
  kind: StoryChainKind
  rarity: StoryChainRarity
  status: StoryChainStatus
  civilizationId?: string
  artifactId?: string
  stages: StoryStage[]
  currentStageIndex: number
  startedYear?: number
  startedDay?: number
  completedYear?: number
  completedDay?: number
  endingId?: string
  flags: Record<string, string | number | boolean>
}

export interface ContentValidationIssue {
  id: string
  severity: ContentValidationSeverity
  sourceType: 'civilization' | 'artifact' | 'story' | 'region' | 'site'
  sourceId: string
  message: string
}



export interface CampaignPhaseState {
  id: CampaignPhaseId
  enteredYear: number
  enteredDay: number
  progress: number
  nextThreshold: number
  unlockedStoryRarities: StoryChainRarity[]
}

export interface CampaignGoal {
  id: string
  type: CampaignGoalType
  title: string
  description: string
  status: CampaignGoalStatus
  progress: number
  target: number
  rewardText: string
  selectedYear?: number
  selectedDay?: number
  completedYear?: number
  completedDay?: number
}

export interface GuildIdentityProfile {
  scores: Record<GuildIdentityPathId, number>
  primaryPath?: GuildIdentityPathId
  milestones: string[]
  lastEvaluatedYear: number
  lastEvaluatedDay: number
}

export interface ContentTelemetry {
  totalEvents: number
  eventCounts: Record<string, number>
  themeCounts: Record<string, number>
  rarityCounts: Record<ContentEventRarity, number>
  recentEventIds: string[]
  recentThemes: string[]
  completedChainIds: string[]
  failedStageAttempts: Record<string, number>
  lastEventYear?: number
  lastEventDay?: number
}

export interface CampaignProgress {
  phase: CampaignPhaseState
  goals: CampaignGoal[]
  selectedGoalId?: string
  identity: GuildIdentityProfile
  telemetry: ContentTelemetry
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
  politicalFactions: PoliticalFaction[]
  rivalGuilds: RivalGuild[]
  rivalExpeditions: RivalExpedition[]
  crises: WorldCrisis[]
  mentorships: Mentorship[]
  wars: WorldWar[]
  knowledgeSpreads: KnowledgeSpread[]
  historySnapshots: HistoricalMapSnapshot[]
  doctrines: GuildDoctrine[]
  generations: GuildGeneration[]
  memorials: GuildMemorial[]
  civilizations: AncientCivilization[]
  artifactsCatalog: ArtifactRecord[]
  storyChains: StoryChain[]
  regionalIdentities: RegionalIdentity[]
  contentValidation: ContentValidationIssue[]
  campaign: CampaignProgress
}
