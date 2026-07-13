import type {
  CampaignGoal,
  CampaignGoalType,
  CampaignPhaseId,
  CampaignProgress,
  ContentEventRarity,
  GameState,
  GuildIdentityPathId,
  StoryChainRarity,
} from '../types/game'
import { RNG } from './rng'

export const CAMPAIGN_PHASES: Array<{ id: CampaignPhaseId; label: string; description: string; threshold: number; rarities: StoryChainRarity[] }> = [
  { id: 'survival', label: 'Выживание', description: 'Закрыть долги, собрать первый надёжный отряд и вернуть гильдии имя.', threshold: 0, rarities: ['common'] },
  { id: 'regional', label: 'Региональная известность', description: 'Закрепиться в регионе и получать задачи, за которые спорят сильные организации.', threshold: 75, rarities: ['common', 'uncommon'] },
  { id: 'discovery', label: 'Большие открытия', description: 'Связать руины, документы и артефакты в доказанную историю.', threshold: 165, rarities: ['common', 'uncommon', 'rare'] },
  { id: 'influence', label: 'Политическое влияние', description: 'Открытия гильдии меняют решения государств, храмов и торговых домов.', threshold: 275, rarities: ['common', 'uncommon', 'rare'] },
  { id: 'world', label: 'Мировая сила', description: 'Гильдия берётся за легендарные тайны и экспедиции, меняющие эпоху.', threshold: 400, rarities: ['common', 'uncommon', 'rare', 'legendary'] },
  { id: 'institution', label: 'Историческое наследие', description: 'Организация переживает поколения и сама определяет, что мир запомнит.', threshold: 550, rarities: ['common', 'uncommon', 'rare', 'legendary'] },
]

export const GUILD_IDENTITY_PATHS: Record<GuildIdentityPathId, { label: string; description: string }> = {
  scholars: { label: 'Научный институт', description: 'Точные отчёты, публикации, архивы и доказательства.' },
  hunters: { label: 'Охотники на чудовищ', description: 'Полевые победы, бестиарий и защита дорог.' },
  royal: { label: 'Королевская служба', description: 'Государственные задачи, кризисы и политические связи.' },
  independent: { label: 'Свободные исследователи', description: 'Собственные экспедиции, независимость и право на находки.' },
  traders: { label: 'Экспедиционная компания', description: 'Маршруты, филиалы, прибыль и снабжение.' },
  wardens: { label: 'Хранители опасных знаний', description: 'Секретные архивы, артефакты и контроль угроз.' },
}

const GOAL_TEMPLATES: Record<CampaignGoalType, Omit<CampaignGoal, 'id' | 'status' | 'progress'>> = {
  map_region: { type: 'map_region', title: 'Атлас неизвестного региона', description: 'Подробно изучить не меньше 55% сухопутной карты.', target: 55, rewardText: 'Стандарт картографии гильдии и крупный научный грант.' },
  find_empire: { type: 'find_empire', title: 'Наследие исчезнувшей империи', description: 'Довести до финала историю погибшей цивилизации.', target: 1, rewardText: 'Мировая известность и право назвать историческую эпоху.' },
  slay_legend: { type: 'slay_legend', title: 'Легенда пограничья', description: 'Завершить историю именованного чудовища — охотой, договором или изгнанием.', target: 1, rewardText: 'Рост престижа приключенцев и уникальный трофей.' },
  expose_lie: { type: 'expose_lie', title: 'Крупнейшая историческая ложь', description: 'Раскрыть религиозную или династическую подделку и решить судьбу правды.', target: 1, rewardText: 'Политическое влияние и доступ к закрытым архивам.' },
  world_institute: { type: 'world_institute', title: 'Мировой институт знаний', description: 'Развить штаб, академию, филиалы и научный авторитет до уровня международного института.', target: 100, rewardText: 'Новый статус гильдии и постоянное финансирование.' },
  great_artifact: { type: 'great_artifact', title: 'Собрать великий артефакт', description: 'Найти все части одного крупного артефакта и определить его судьбу.', target: 1, rewardText: 'Уникальное наследие и новый источник влияния.' },
}

export function createCampaignProgress(seed: string, year = 912, day = 1): CampaignProgress {
  const rng = new RNG(`${seed}:campaign:v081`)
  const types = rng.shuffle(Object.keys(GOAL_TEMPLATES) as CampaignGoalType[]).slice(0, 3)
  const goals = types.map((type, index): CampaignGoal => ({ ...GOAL_TEMPLATES[type], id: `campaign-goal-${index + 1}-${type}`, status: 'offered', progress: 0 }))
  return {
    phase: { id: 'survival', enteredYear: year, enteredDay: day, progress: 0, nextThreshold: 75, unlockedStoryRarities: ['common'] },
    goals,
    selectedGoalId: undefined,
    identity: {
      scores: { scholars: 0, hunters: 0, royal: 0, independent: 0, traders: 0, wardens: 0 },
      milestones: [],
      lastEvaluatedYear: year,
      lastEvaluatedDay: day,
    },
    telemetry: {
      totalEvents: 0,
      eventCounts: {},
      themeCounts: {},
      rarityCounts: { common: 0, regional: 0, rare: 0, legendary: 0 },
      recentEventIds: [],
      recentThemes: [],
      completedChainIds: [],
      failedStageAttempts: {},
    },
  }
}

function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, Math.round(value))) }

function phaseScore(state: GameState): number {
  const completedStories = state.storyChains.filter((chain) => chain.status === 'completed').length
  const years = Math.max(0, state.year - 912)
  return Math.round(
    state.guild.rank * 28
    + state.guild.reputation * 0.7
    + state.guild.scientificAuthority * 0.65
    + state.guild.politicalInfluence * 1.6
    + state.discoveries.length * 5
    + completedStories * 18
    + state.branches.length * 12
    + state.academy.level * 7
    + state.doctrines.length * 5
    + Math.min(45, years * 2.5),
  )
}

function goalProgress(state: GameState, type: CampaignGoalType): number {
  if (type === 'map_region') {
    const land = state.world.tiles.filter((tile) => tile.biome !== 'ocean')
    const known = land.filter((tile) => tile.knowledge >= 2).length
    return land.length ? Math.round((known / land.length) * 100) : 0
  }
  if (type === 'find_empire') return state.storyChains.filter((chain) => chain.status === 'completed' && chain.kind === 'fallen_civilization').length
  if (type === 'slay_legend') return state.storyChains.filter((chain) => chain.status === 'completed' && chain.kind === 'legendary_monster').length
  if (type === 'expose_lie') return state.storyChains.filter((chain) => chain.status === 'completed' && ['religious_secret', 'state_conspiracy', 'vanished_city'].includes(chain.kind)).length
  if (type === 'great_artifact') return state.artifactsCatalog.filter((artifact) => artifact.status === 'recovered').length
  const rank = Math.min(30, state.guild.rank * 7)
  const science = Math.min(30, state.guild.scientificAuthority * 0.35)
  const branches = Math.min(18, state.branches.length * 9)
  const academy = Math.min(12, state.academy.level * 4)
  const legacy = Math.min(10, state.doctrines.length * 3 + state.generations.length * 2)
  return Math.round(rank + science + branches + academy + legacy)
}

function identityScores(state: GameState): Record<GuildIdentityPathId, number> {
  const published = state.discoveries.filter((entry) => entry.disposition === 'published').length
  const secret = state.discoveries.filter((entry) => entry.disposition === 'secret' || entry.disposition === 'archived').length
  const victories = state.bestiary.reduce((sum, entry) => sum + entry.victories, 0)
  const resolvedCrises = state.crises.filter((entry) => entry.status === 'resolved').length
  const activeRoutes = state.world.routes.filter((route) => route.status === 'active').length
  const archiveLevel = state.guild.rooms.find((room) => room.id === 'archive')?.level ?? 1
  return {
    scholars: clamp(state.guild.scientificAuthority * 0.7 + published * 5 + archiveLevel * 6 + state.civilizations.filter((entry) => entry.knownLevel >= 3).length * 5),
    hunters: clamp(state.guild.adventurerPrestige * 0.65 + victories * 4 + state.bestiary.filter((entry) => entry.discoveredWeakness).length * 4),
    royal: clamp(state.guild.politicalInfluence * 2.2 + resolvedCrises * 9 + state.politicalFactions.filter((entry) => entry.attitude >= 35).length * 3),
    independent: clamp(state.discoveries.length * 3 + secret * 4 + state.expeditions.filter((entry) => entry.status === 'completed').length * 1.5),
    traders: clamp(Math.min(45, state.guild.treasury / 90) + activeRoutes * 2 + state.branches.length * 12),
    wardens: clamp(secret * 5 + state.artifactsCatalog.filter((entry) => ['partial', 'recovered'].includes(entry.status)).length * 7 + state.guild.institutionalMemory * 0.25),
  }
}

export function selectCampaignGoal(state: GameState, goalId: string): GameState {
  if (!state.campaign.goals.some((goal) => goal.id === goalId)) return state
  return {
    ...state,
    campaign: {
      ...state.campaign,
      selectedGoalId: goalId,
      goals: state.campaign.goals.map((goal) => goal.id === goalId
        ? { ...goal, status: goal.status === 'completed' ? 'completed' : 'selected', selectedYear: goal.selectedYear ?? state.year, selectedDay: goal.selectedDay ?? state.day }
        : goal.status === 'selected' ? { ...goal, status: 'offered' } : goal),
    },
    chronicle: [...state.chronicle, { id: `chronicle-campaign-goal-${goalId}-${state.year}-${state.day}`, year: state.year, day: state.day, title: 'Гильдия выбирает долгую цель', text: state.campaign.goals.find((goal) => goal.id === goalId)?.title ?? 'Новая цель кампании', category: 'guild', importance: 4 }],
  }
}

export function recordContentEvent(state: GameState, eventId: string, theme: string, rarity: ContentEventRarity): GameState {
  const telemetry = state.campaign.telemetry
  return {
    ...state,
    campaign: {
      ...state.campaign,
      telemetry: {
        ...telemetry,
        totalEvents: telemetry.totalEvents + 1,
        eventCounts: { ...telemetry.eventCounts, [eventId]: (telemetry.eventCounts[eventId] ?? 0) + 1 },
        themeCounts: { ...telemetry.themeCounts, [theme]: (telemetry.themeCounts[theme] ?? 0) + 1 },
        rarityCounts: { ...telemetry.rarityCounts, [rarity]: telemetry.rarityCounts[rarity] + 1 },
        recentEventIds: [...telemetry.recentEventIds, eventId].slice(-8),
        recentThemes: [...telemetry.recentThemes, theme].slice(-6),
        lastEventYear: state.year,
        lastEventDay: state.day,
      },
    },
  }
}

export function contentRepeatRate(state: GameState): number {
  const counts = Object.values(state.campaign.telemetry.eventCounts)
  const total = counts.reduce((sum, value) => sum + value, 0)
  const repeats = counts.reduce((sum, value) => sum + Math.max(0, value - 1), 0)
  return total ? Math.round((repeats / total) * 100) : 0
}

export function refreshCampaignProgress(state: GameState): GameState {
  const score = phaseScore(state)
  let phaseIndex = 0
  CAMPAIGN_PHASES.forEach((phase, index) => { if (score >= phase.threshold) phaseIndex = index })
  const definition = CAMPAIGN_PHASES[phaseIndex]
  const previousPhase = state.campaign.phase.id
  const nextDefinition = CAMPAIGN_PHASES[phaseIndex + 1]
  const progress = nextDefinition
    ? clamp(((score - definition.threshold) / Math.max(1, nextDefinition.threshold - definition.threshold)) * 100)
    : 100
  const scores = identityScores(state)
  const primaryPath = (Object.entries(scores) as Array<[GuildIdentityPathId, number]>).sort((a, b) => b[1] - a[1])[0]?.[0]
  const oldPrimary = state.campaign.identity.primaryPath
  let milestones = [...state.campaign.identity.milestones]
  if (primaryPath && scores[primaryPath] >= 35 && primaryPath !== oldPrimary && !milestones.includes(primaryPath)) milestones = [...milestones, primaryPath]
  let chronicle = state.chronicle
  if (previousPhase !== definition.id) {
    chronicle = [...chronicle, { id: `chronicle-phase-${definition.id}-${state.year}-${state.day}`, year: state.year, day: state.day, title: `Новый этап: ${definition.label}`, text: definition.description, category: 'guild', importance: 5 }]
  }
  if (primaryPath && primaryPath !== oldPrimary && scores[primaryPath] >= 35) {
    chronicle = [...chronicle, { id: `chronicle-identity-${primaryPath}-${state.year}-${state.day}`, year: state.year, day: state.day, title: `Путь гильдии: ${GUILD_IDENTITY_PATHS[primaryPath].label}`, text: GUILD_IDENTITY_PATHS[primaryPath].description, category: 'guild', importance: 3 }]
  }

  let completedReward = false
  const goals = state.campaign.goals.map((goal) => {
    const value = goalProgress(state, goal.type)
    if (goal.status === 'selected' && value >= goal.target) {
      completedReward = true
      return { ...goal, progress: value, status: 'completed' as const, completedYear: state.year, completedDay: state.day }
    }
    return { ...goal, progress: value }
  })
  const newlyCompleted = completedReward && !state.campaign.goals.some((goal) => goal.status === 'completed')
  if (newlyCompleted) {
    const goal = goals.find((entry) => entry.status === 'completed')
    chronicle = [...chronicle, { id: `chronicle-campaign-complete-${state.year}-${state.day}`, year: state.year, day: state.day, title: `Главная цель выполнена: ${goal?.title ?? 'кампания'}`, text: goal?.rewardText ?? 'Гильдия получила историческое признание.', category: 'guild', importance: 5 }]
  }

  return {
    ...state,
    guild: newlyCompleted ? { ...state.guild, treasury: state.guild.treasury + 1200, reputation: state.guild.reputation + 12, scientificAuthority: state.guild.scientificAuthority + 8, institutionalMemory: state.guild.institutionalMemory + 10 } : state.guild,
    chronicle,
    campaign: {
      ...state.campaign,
      phase: {
        id: definition.id,
        enteredYear: previousPhase === definition.id ? state.campaign.phase.enteredYear : state.year,
        enteredDay: previousPhase === definition.id ? state.campaign.phase.enteredDay : state.day,
        progress,
        nextThreshold: nextDefinition?.threshold ?? definition.threshold,
        unlockedStoryRarities: definition.rarities,
      },
      goals,
      identity: { scores, primaryPath: scores[primaryPath] >= 35 ? primaryPath : undefined, milestones, lastEvaluatedYear: state.year, lastEvaluatedDay: state.day },
    },
  }
}

export function campaignDayTick(state: GameState): GameState {
  if (state.day % 7 !== 0 && state.day !== 1) return state
  return refreshCampaignProgress(state)
}
