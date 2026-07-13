import type { Character, GameState, GuildPosition } from '../types/game'
import { DEFAULT_WORLD_SETTINGS } from './worldSettings'
import { createStrategicLayer } from './strategy'
import { initializeLivingWorld } from './livingWorld'
import { loadPreferences } from './preferences'
import { createGuildInstitutions, DEFAULT_CHARTER, ACADEMY_PROGRAMS } from './guildPolitics'
import { ensureStoryOpportunities, initializeContentEngine, validateContent } from './contentEngine'
import { createCampaignProgress, refreshCampaignProgress } from './campaign'

const SAVE_KEY = 'last-guild-save-v10'
const LEGACY_KEYS = ['last-guild-save-v9', 'last-guild-save-v8', 'last-guild-save-v7', 'last-guild-save-v6', 'last-guild-save-v5', 'last-guild-save-v4', 'last-guild-save-v3', 'last-guild-save-v2']
const SLOT_PREFIX = 'last-guild-slot-v1-'
const BACKUP_KEY = 'last-guild-backup-v10'

const defaultPositions = (): GuildPosition[] => [
  { id: 'expedition_master', name: 'Мастер экспедиций', description: 'Отвечает за составы, маршруты и дисциплину.', effect: '+5 к слаженности новых отрядов' },
  { id: 'chief_archivist', name: 'Главный архивист', description: 'Проверяет отчёты и качество доказательств.', effect: '+10 к качеству открытий' },
  { id: 'quartermaster', name: 'Квартмейстер', description: 'Контролирует склад и закупки.', effect: '−8% месячных расходов' },
  { id: 'chief_healer', name: 'Главный лекарь', description: 'Руководит лечением и реабилитацией.', effect: '+35% скорость восстановления' },
  { id: 'mentor', name: 'Наставник новичков', description: 'Передаёт опыт молодому составу.', effect: '+20% опыта после экспедиций' },
  { id: 'diplomat', name: 'Дипломат гильдии', description: 'Работает с властями и заказчиками.', effect: '+2 репутации при публикации' },
]

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

function normalizeCharacter(character: any, state: any): Character {
  const stage = character.careerStage ?? (character.fame >= 50 ? 'legend' : character.expeditions >= 7 ? 'veteran' : character.expeditions >= 2 ? 'field' : 'recruit')
  return {
    ...character,
    origin: character.origin ?? 'Происхождение не записано',
    homeSettlementId: character.homeSettlementId ?? state.world?.startSettlementId ?? '',
    experience: character.experience ?? (character.level ?? 1) * 35,
    careerStage: stage,
    injuries: character.injuries ?? [],
    injuryRecords: character.injuryRecords ?? (character.injuries ?? []).map((name: string, index: number) => ({
      id: `legacy-injury-${character.id}-${index}`,
      name,
      severity: 2,
      permanent: true,
      recoveryDays: 0,
      effect: 'Старая травма',
      treated: true,
    })),
    relationships: character.relationships ?? {},
    combatBehavior: character.combatBehavior ?? { role: ['Воин'].includes(character.profession) ? 'frontline' : ['Маг', 'Следопыт', 'Охотник'].includes(character.profession) ? 'ranged' : ['Жрец', 'Лекарь'].includes(character.profession) ? 'support' : 'skirmisher', preferredRange: ['Маг', 'Следопыт', 'Охотник'].includes(character.profession) ? 4 : 1, aggression: 50, protectWeak: ['Воин', 'Жрец', 'Лекарь'].includes(character.profession), retreatAt: 38, conserveAbilities: true },
    mentorId: character.mentorId,
    apprenticeIds: character.apprenticeIds ?? [],
    rivalGuildId: character.rivalGuildId,
    assignedBranchId: character.assignedBranchId,
    generationId: character.generationId,
    familyName: character.familyName ?? (character.name?.split(' ').at(-1) ?? character.name),
    relativeIds: character.relativeIds ?? [],
    academyEnrollmentId: character.academyEnrollmentId,
    academyGraduate: character.academyGraduate ?? false,
    councilInfluence: character.councilInfluence ?? 0,
    memories: (character.memories ?? []).map((memory: any, index: number) => ({
      id: memory.id ?? `legacy-memory-${character.id}-${index}`,
      title: memory.title ?? 'Старое воспоминание',
      description: memory.description ?? memory.title ?? 'Подробности утрачены.',
      intensity: memory.intensity ?? 45,
      valence: memory.valence ?? 'mixed',
      type: memory.type ?? 'expedition',
      year: memory.year ?? state.year ?? 912,
      day: memory.day ?? 1,
      expeditionId: memory.expeditionId,
      relatedCharacterIds: memory.relatedCharacterIds ?? [],
    })),
  } as Character
}

function normalizeState(parsed: any): GameState | null {
  if (!parsed || ![2, 3, 4, 5, 6, 7, 8, 9, 10].includes(parsed.version)) return null
  const settings = { ...DEFAULT_WORLD_SETTINGS, ...(parsed.settings ?? {}) }
  const hadCampaign = Boolean(parsed.campaign)
  const normalized: GameState = {
    ...parsed,
    version: 10,
    settings,
    pendingDecision: parsed.pendingDecision,
    pendingDebrief: parsed.pendingDebrief,
    pendingCombat: parsed.pendingCombat,
    pendingDungeon: parsed.pendingDungeon,
    bestiary: parsed.bestiary ?? [],
    discoveries: parsed.discoveries ?? [],
    consequences: parsed.consequences ?? [],
    guild: {
      ...parsed.guild,
      positions: parsed.guild?.positions ?? defaultPositions(),
      leaderId: parsed.guild?.leaderId,
      charterInfluence: parsed.guild?.charterInfluence ?? 0,
      academyReputation: parsed.guild?.academyReputation ?? 0,
      institutionalMemory: parsed.guild?.institutionalMemory ?? 1,
    },
    world: {
      ...parsed.world,
      routes: (parsed.world?.routes ?? []).map((route: any) => ({ ...route, goods: route.goods ?? [], income: route.income ?? (route.importance ?? 1) * 18, safety: route.safety ?? 65, seasonality: route.seasonality ?? 20, status: route.status ?? 'active', establishedYear: route.establishedYear ?? 780 })),
      tiles: (parsed.world?.tiles ?? []).map((tile: any) => ({ ...tile, magic: tile.magic ?? 0.35, hasRoad: tile.hasRoad ?? false, hasRiver: tile.hasRiver ?? false })),
      realms: (parsed.world?.realms ?? []).map((realm: any) => ({ ...realm, dominantFaith: realm.dominantFaith ?? 'местные культы', currentIssue: realm.currentIssue ?? 'пограничные споры', relations: realm.relations ?? {} })),
      settlements: (parsed.world?.settlements ?? []).map((settlement: any) => ({ ...settlement, foundedYear: settlement.foundedYear ?? 700, status: settlement.status ?? 'active', production: settlement.production ?? ['зерно'], demand: settlement.demand ?? ['железо', 'соль'], tradeBalance: settlement.tradeBalance ?? 0, growth: settlement.growth ?? 0, foodSecurity: settlement.foodSecurity ?? 55, unrest: settlement.unrest ?? 20 })),
      sites: (parsed.world?.sites ?? []).map((site: any) => {
        const layers = site.layers ?? ['первоначальный комплекс', 'следы поздних обитателей']
        const zones = site.zones ?? Array.from({ length: Math.max(3, (site.depth ?? 1) + 2) }, (_, index) => ({
          id: `${site.id}-zone-${index + 1}`, name: index === 0 ? 'Старый вход' : `Неизвестная зона ${index + 1}`, kind: index === 0 ? 'entrance' : index >= (site.depth ?? 1) ? 'depths' : 'hall', danger: Math.min(10, (site.danger ?? 3) + index), historyLayer: layers[Math.min(layers.length - 1, Math.floor(index / 2))], description: 'Зона создана при обновлении старого сохранения.', connections: [`${site.id}-zone-${index}`, `${site.id}-zone-${index + 2}`].filter((id, position) => position === 0 ? index > 0 : index < Math.max(3, (site.depth ?? 1) + 2) - 1), guardSpeciesId: index > 1 ? site.monsterTags?.[0] : undefined, rewards: index > 1 ? ['неизвестная находка'] : [], explored: index === 0, secured: index === 0,
        }))
        return { ...site, layers, zones, exploration: site.exploration ?? 8, campEstablished: site.campEstablished ?? false, civilizationId: site.civilizationId, regionalIdentityId: site.regionalIdentityId }
      }),
      monsterSpecies: (parsed.world?.monsterSpecies ?? []).map((species: any) => ({ ...species, abilities: species.abilities ?? ['особая атака'], trophy: species.trophy ?? 'неизвестный трофей', armor: species.armor ?? Math.max(0, Math.floor((species.threat ?? 2) / 2)), movement: species.movement ?? 2 })),
      monsterPopulations: (parsed.world?.monsterPopulations ?? []).map((population: any) => ({ ...population, legendary: population.legendary ?? false, scars: population.scars ?? [] })),
    },
    characters: (parsed.characters ?? []).map((character: any) => normalizeCharacter(character, parsed)),
    opportunities: (parsed.opportunities ?? []).map((opportunity: any) => ({
      ...opportunity,
      requiredRoles: opportunity.requiredRoles ?? ['Следопыт'],
      riskProfile: opportunity.riskProfile ?? { route: opportunity.dangerEstimate, combat: opportunity.dangerEstimate, climate: 3, disease: 3, politics: 2, magic: 3 },
    })),
    expeditions: (parsed.expeditions ?? []).map((expedition: any) => ({
      ...expedition,
      riskProfile: expedition.riskProfile ?? { route: 4, combat: 4, climate: 3, disease: 3, politics: 2, magic: 3 },
      reports: expedition.reports ?? [],
      battles: expedition.battles ?? 0,
      dungeonSiteIds: expedition.dungeonSiteIds ?? [],
      opportunityId: expedition.opportunityId, storyChainId: expedition.storyChainId, storyStageId: expedition.storyStageId, contentEventIds: expedition.contentEventIds ?? [],
    })),
    politicalFactions: parsed.politicalFactions ?? [],
    rivalGuilds: parsed.rivalGuilds ?? [],
    rivalExpeditions: parsed.rivalExpeditions ?? [],
    branches: parsed.branches ?? [],
    crises: parsed.crises ?? [],
    mentorships: parsed.mentorships ?? [],
    wars: parsed.wars ?? [],
    knowledgeSpreads: parsed.knowledgeSpreads ?? [],
    historySnapshots: parsed.historySnapshots ?? [],
    academy: parsed.academy ?? { level: 1, seats: 4, reputation: 4, monthlyCost: 24, programs: ACADEMY_PROGRAMS, enrollments: [] },
    doctrines: parsed.doctrines ?? [],
    generations: parsed.generations ?? [],
    council: parsed.council ?? [],
    councilProposals: parsed.councilProposals ?? [],
    guildFactions: parsed.guildFactions ?? [],
    charter: { ...DEFAULT_CHARTER, ...(parsed.charter ?? {}) },
    memorials: parsed.memorials ?? [],
    civilizations: parsed.civilizations ?? [],
    artifactsCatalog: parsed.artifactsCatalog ?? [],
    storyChains: parsed.storyChains ?? [],
    regionalIdentities: parsed.regionalIdentities ?? [],
    contentValidation: parsed.contentValidation ?? [],
    campaign: parsed.campaign ?? createCampaignProgress(parsed.seed ?? 'legacy-world', parsed.year ?? 912, parsed.day ?? 1),
  }

  if (normalized.civilizations.length === 0 || normalized.artifactsCatalog.length === 0 || normalized.storyChains.length === 0 || normalized.regionalIdentities.length === 0) {
    const content = initializeContentEngine(normalized.seed, normalized.world, normalized.settings)
    normalized.world = content.world
    normalized.civilizations = content.civilizations
    normalized.artifactsCatalog = content.artifactsCatalog
    normalized.storyChains = content.storyChains
    normalized.regionalIdentities = content.regionalIdentities
    normalized.contentValidation = content.contentValidation
  } else {
    normalized.contentValidation = validateContent(normalized)
  }


  if (!hadCampaign) {
    const protectedChainIds = new Set([
      ...normalized.expeditions.filter((entry) => ['active', 'returning', 'missing'].includes(entry.status)).map((entry) => entry.storyChainId).filter(Boolean),
      ...normalized.opportunities.filter((entry) => entry.accepted).map((entry) => entry.storyChainId).filter(Boolean),
    ] as string[])
    let commonKept = false
    const dormantIds = new Set<string>()
    normalized.storyChains = normalized.storyChains.map((chain) => {
      if (protectedChainIds.has(chain.id) || chain.startedYear || chain.status === 'completed') return chain
      if (chain.rarity === 'common' && !commonKept) { commonKept = true; return { ...chain, status: 'active' as const, stages: chain.stages.map((stage, index) => ({ ...stage, status: index === 0 ? 'available' as const : stage.status })) } }
      dormantIds.add(chain.id)
      return { ...chain, status: 'dormant' as const, stages: chain.stages.map((stage) => ({ ...stage, status: 'locked' as const, opportunityId: undefined })) }
    })
    normalized.opportunities = normalized.opportunities.filter((entry) => !entry.storyChainId || entry.accepted || !dormantIds.has(entry.storyChainId))
  }

  if (normalized.generations.length === 0 || normalized.council.length === 0 || normalized.guildFactions.length === 0) {
    const institutions = createGuildInstitutions(normalized.seed, { characters: normalized.characters, guild: normalized.guild, year: normalized.year, day: normalized.day, branches: normalized.branches })
    normalized.academy = parsed.academy ?? institutions.academy
    normalized.doctrines = normalized.doctrines.length ? normalized.doctrines : institutions.doctrines
    normalized.generations = normalized.generations.length ? normalized.generations : institutions.generations
    normalized.council = normalized.council.length ? normalized.council : institutions.council
    normalized.guildFactions = normalized.guildFactions.length ? normalized.guildFactions : institutions.guildFactions
    normalized.charter = { ...DEFAULT_CHARTER, ...(parsed.charter ?? {}) }
    normalized.memorials = normalized.memorials.length ? normalized.memorials : institutions.memorials
    const currentGenerationId = normalized.generations.find((entry) => !entry.endedYear)?.id
    normalized.characters = normalized.characters.map((entry) => entry.employed && !entry.generationId ? { ...entry, generationId: currentGenerationId } : entry)
  }
  const competitorsEnabled = loadPreferences().competitorsEnabled
  if ((competitorsEnabled && normalized.rivalGuilds.length === 0) || normalized.politicalFactions.length === 0) {
    const strategic = createStrategicLayer(normalized.seed, normalized.world, normalized.characters)
    normalized.rivalGuilds = competitorsEnabled ? (normalized.rivalGuilds.length ? normalized.rivalGuilds : strategic.rivalGuilds) : []
    normalized.rivalExpeditions = competitorsEnabled ? normalized.rivalExpeditions : []
    if (!competitorsEnabled) normalized.opportunities = normalized.opportunities.map((entry) => ({ ...entry, contestedByIds: [] }))
    normalized.politicalFactions = normalized.politicalFactions.length ? normalized.politicalFactions : strategic.politicalFactions
    normalized.crises = normalized.crises.length ? normalized.crises : strategic.crises
    normalized.guild.leaderId = normalized.guild.leaderId ?? strategic.leaderId
  }
  if (normalized.historySnapshots.length === 0 || normalized.wars.length === 0) {
    const living = initializeLivingWorld(normalized.seed, normalized.world, normalized.settings)
    normalized.wars = normalized.wars.length ? normalized.wars : living.wars
    normalized.knowledgeSpreads = normalized.knowledgeSpreads.length ? normalized.knowledgeSpreads : living.knowledgeSpreads
    normalized.historySnapshots = normalized.historySnapshots.length ? normalized.historySnapshots : living.historySnapshots
  }
  return ensureStoryOpportunities(refreshCampaignProgress(normalized))
}

export function loadGame(): GameState | null {
  for (const key of [SAVE_KEY, ...LEGACY_KEYS]) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      if (key !== SAVE_KEY) localStorage.setItem(BACKUP_KEY, raw)
      const normalized = normalizeState(JSON.parse(raw))
      if (normalized) {
        saveGame(normalized)
        return normalized
      }
    } catch { /* corrupted save: try older slot */ }
  }
  return null
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
  for (const key of LEGACY_KEYS) localStorage.removeItem(key)
}


export interface SaveSlotInfo {
  id: string
  name: string
  seed: string
  year: number
  day: number
  savedAt: number
}

export function saveToSlot(state: GameState, id: string, name?: string): void {
  const payload = { name: name || `Слот ${id}`, savedAt: Date.now(), state }
  localStorage.setItem(`${SLOT_PREFIX}${id}`, JSON.stringify(payload))
}

export function listSaveSlots(): SaveSlotInfo[] {
  const result: SaveSlotInfo[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith(SLOT_PREFIX)) continue
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '')
      result.push({ id: key.slice(SLOT_PREFIX.length), name: parsed.name ?? 'Сохранение', seed: parsed.state?.seed ?? '—', year: parsed.state?.year ?? 0, day: parsed.state?.day ?? 0, savedAt: parsed.savedAt ?? 0 })
    } catch { /* damaged slot is ignored */ }
  }
  return result.sort((a, b) => b.savedAt - a.savedAt)
}

export function loadFromSlot(id: string): GameState | null {
  const raw = localStorage.getItem(`${SLOT_PREFIX}${id}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const normalized = normalizeState(parsed.state)
    if (normalized) saveGame(normalized)
    return normalized
  } catch { return null }
}

export function deleteSaveSlot(id: string): void {
  localStorage.removeItem(`${SLOT_PREFIX}${id}`)
}

export function downloadGameSave(state: GameState): void {
  const blob = new Blob([JSON.stringify({ format: 'last-guild-save', exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `last-guild-${state.seed}-${state.year}-${state.day}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function importGameSave(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw)
    const normalized = normalizeState(parsed.state ?? parsed)
    if (!normalized) return null
    localStorage.setItem(BACKUP_KEY, localStorage.getItem(SAVE_KEY) ?? '')
    saveGame(normalized)
    return normalized
  } catch { return null }
}

export function loadBackup(): GameState | null {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return null
  try { return normalizeState(JSON.parse(raw)) } catch { return null }
}
