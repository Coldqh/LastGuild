import type {
  Character,
  ChronicleEntry,
  Expedition,
  GameState,
  Opportunity,
  WorldTile,
  ExpeditionDecision,
  DecisionEffects,
  CharacterCareerStage,
  CharacterInjuryRecord,
  CharacterMemory,
  DiscoveryDisposition,
  DiscoveryRecord,
  ExpeditionDebrief,
  ExpeditionReport,
  GuildPositionId,
  WorldConsequence,
} from '../types/game'
import { RNG } from './rng'
import { createOpportunities } from './gameFactory'
import { DIFFICULTY_RULES } from './worldSettings'
import { startCombatEncounter } from './combat'
import { startDungeonExploration } from './dungeon'
import { stanceFromRelation, strategicDayTick } from './strategy'
import { livingWorldDayTick } from './livingWorld'

const neighborOffsets = (x: number): number[][] =>
  x % 2 === 0
    ? [[1, -1], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 0]]
    : [[1, 0], [1, 1], [0, -1], [0, 1], [-1, 0], [-1, 1]]

const key = (x: number, y: number) => `${x}:${y}`

export function findRoute(state: GameState, fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId]
  const tileMap = new Map(state.world.tiles.map((tile) => [tile.id, tile]))
  const frontier: Array<{ id: string; cost: number }> = [{ id: fromId, cost: 0 }]
  const cameFrom = new Map<string, string>()
  const costSoFar = new Map<string, number>([[fromId, 0]])
  const destination = tileMap.get(toId)
  if (!destination) return []

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost)
    const current = frontier.shift()!
    if (current.id === toId) break
    const currentTile = tileMap.get(current.id)
    if (!currentTile) continue

    for (const [dx, dy] of neighborOffsets(currentTile.x)) {
      const nextId = key(currentTile.x + dx, currentTile.y + dy)
      const next = tileMap.get(nextId)
      if (!next || next.biome === 'ocean') continue
      const newCost = (costSoFar.get(current.id) ?? 0) + next.travelCost + next.danger * 0.06
      if (!costSoFar.has(nextId) || newCost < costSoFar.get(nextId)!) {
        costSoFar.set(nextId, newCost)
        const heuristic = Math.hypot(next.x - destination.x, next.y - destination.y)
        frontier.push({ id: nextId, cost: newCost + heuristic * 0.8 })
        cameFrom.set(nextId, current.id)
      }
    }
  }

  if (!cameFrom.has(toId)) return []
  const route = [toId]
  let current = toId
  while (current !== fromId) {
    current = cameFrom.get(current)!
    route.unshift(current)
  }
  return route
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function absoluteTick(year: number, day: number): number {
  return year * 360 + day
}

function positionHolder(state: GameState, positionId: GuildPositionId): Character | undefined {
  const holderId = state.guild.positions.find((position) => position.id === positionId)?.holderId
  return state.characters.find((character) => character.id === holderId && character.status !== 'dead' && character.status !== 'retired')
}

function inferCareerStage(character: Character): CharacterCareerStage {
  if (character.fame >= 70 || character.discoveries >= 10) return 'legend'
  if (character.age >= 48 && character.expeditions >= 8) return 'mentor'
  if (character.skills.leadership >= 7 && character.expeditions >= 5) return 'leader'
  if (character.expeditions >= 5 || character.level >= 5) return 'veteran'
  if (character.expeditions >= 1 || character.level >= 2) return 'field'
  return 'recruit'
}

function retirementAge(character: Character): number {
  if (character.ancestry === 'Эльф') return 180
  if (character.ancestry === 'Дворф' || character.ancestry === 'Гном') return 95
  if (character.ancestry === 'Полурослик') return 82
  return 68
}

function createMemory(
  state: GameState,
  character: Character,
  title: string,
  description: string,
  type: CharacterMemory['type'],
  valence: CharacterMemory['valence'],
  intensity: number,
  expeditionId?: string,
  relatedCharacterIds: string[] = [],
): CharacterMemory {
  return {
    id: `memory-${character.id}-${state.year}-${state.day}-${character.memories.length + 1}`,
    title,
    description,
    type,
    valence,
    intensity,
    year: state.year,
    day: state.day,
    expeditionId,
    relatedCharacterIds,
  }
}

function createInjuryRecord(rng: RNG, expeditionId: string, severity: number, cause: string): CharacterInjuryRecord {
  const safeSeverity = Math.max(1, Math.min(5, Math.round(severity))) as 1 | 2 | 3 | 4 | 5
  const tables: Record<number, Array<[string, string]>> = {
    1: [['глубокий порез', 'небольшое снижение выносливости'], ['ушиб рёбер', 'боль при нагрузке']],
    2: [['перелом руки', 'временно хуже бой и работа с инструментами'], ['сильный ожог', 'стресс и медленное восстановление']],
    3: [['повреждение колена', 'снижение скорости в походах'], ['тяжёлая инфекция', 'долгое лечение и риск осложнений']],
    4: [['потеря глаза', 'хуже разведка и стрельба'], ['раздробленная кисть', 'ограничение части профессий']],
    5: [['ампутация', 'полевая карьера почти завершена'], ['магическое поражение нервов', 'постоянная боль и нестабильность']],
  }
  const [name, effect] = rng.pick(tables[safeSeverity])
  return {
    id: `injury-${expeditionId}-${rng.int(1000, 999999)}`,
    name: `${name} (${cause})`,
    severity: safeSeverity,
    permanent: safeSeverity >= 4 || rng.bool(safeSeverity * 0.08),
    recoveryDays: safeSeverity * rng.int(7, 16),
    effect,
    sourceExpeditionId: expeditionId,
    treated: false,
  }
}

function addInjury(character: Character, record: CharacterInjuryRecord): Character {
  return {
    ...character,
    injuries: [...character.injuries, record.name].slice(-8),
    injuryRecords: [...character.injuryRecords, record].slice(-12),
  }
}

function developCharacter(character: Character, expedition: Expedition, success: boolean, mentorBonus: number, rng: RNG): Character {
  const baseExperience = 22 + expedition.daysElapsed * 2 + (success ? 28 : 8)
  const experience = character.experience + Math.round(baseExperience * mentorBonus)
  const levelGain = Math.max(0, Math.floor(experience / 100) - Math.floor(character.experience / 100))
  const skills = { ...character.skills }
  const preferred: Record<string, Array<keyof Character['skills']>> = {
    охота: ['combat', 'survival', 'scouting'],
    руины: ['history', 'arcana', 'cartography'],
    артефакт: ['arcana', 'history'],
    картография: ['cartography', 'survival', 'scouting'],
    спасение: ['medicine', 'leadership', 'survival'],
    дипломатия: ['diplomacy', 'leadership'],
    разведка: ['scouting', 'survival', 'cartography'],
    исследование: ['medicine', 'arcana', 'history'],
  }
  const pool = preferred[expedition.objectiveType] ?? ['survival', 'leadership']
  if (success || rng.bool(0.45)) {
    const skill = rng.pick(pool)
    skills[skill] = Math.min(10, skills[skill] + 1)
  }
  const next = {
    ...character,
    experience,
    level: Math.min(10, character.level + levelGain),
    skills,
  }
  return { ...next, careerStage: inferCareerStage(next) }
}

function adjustTeamRelationships(characters: Character[], expedition: Expedition, success: boolean): Character[] {
  const survivorIds = expedition.memberIds.filter((id) => !expedition.casualties.includes(id))
  return characters.map((character) => {
    if (!survivorIds.includes(character.id)) return character
    const relationships = { ...character.relationships }
    for (const otherId of survivorIds) {
      if (otherId === character.id) continue
      const base = relationships[otherId] ?? 0
      const leaderPenalty = !success && otherId === expedition.leaderId ? -5 : 0
      relationships[otherId] = Math.max(-100, Math.min(100, base + (success ? 3 : -1) + leaderPenalty))
    }
    return { ...character, relationships }
  })
}

function expeditionCohesion(members: Character[], leaderId: string): number {
  const leader = members.find((member) => member.id === leaderId)
  const relationValues = members.flatMap((member) =>
    members.filter((other) => other.id !== member.id).map((other) => member.relationships[other.id] ?? 0),
  )
  return Math.max(
    20,
    Math.min(95, 48 + average(relationValues) * 0.35 + (leader?.skills.leadership ?? 0) * 4 + average(members.map((member) => member.loyalty)) * 0.18),
  )
}

export interface ExpeditionDraft {
  opportunity: Opportunity
  memberIds: string[]
  leaderId: string
  riskPolicy: Expedition['riskPolicy']
  food: number
  medicine: number
  budget: number
  retreatThreshold: number
}

export function createExpeditionFromDraft(state: GameState, draft: ExpeditionDraft): GameState {
  const home = state.world.settlements.find((settlement) => settlement.id === state.world.startSettlementId)!
  const route = findRoute(state, home.tileId, draft.opportunity.targetTileId)
  const members = state.characters.filter((character) => draft.memberIds.includes(character.id))
  if (members.length < 2 || route.length === 0) return state
  if (state.guild.treasury < draft.budget || state.guild.supplies < draft.food || state.guild.medicine < draft.medicine) return state
  if (state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning').length >= state.guild.maxActiveExpeditions) return state

  const policyMultiplier = draft.riskPolicy === 'cautious' ? 1.25 : draft.riskPolicy === 'bold' ? 0.82 : 1
  const expectedDays = Math.max(4, Math.ceil(route.length * 1.5 * policyMultiplier + 3))
  const masterBonus = positionHolder(state, 'expedition_master') ? 5 : 0
  const expedition: Expedition = {
    id: `expedition-${state.day}-${state.expeditions.length + 1}`,
    name: `Экспедиция «${draft.opportunity.title}»`,
    status: 'active',
    objectiveType: draft.opportunity.type,
    objectiveText: draft.opportunity.description,
    targetTileId: draft.opportunity.targetTileId,
    memberIds: draft.memberIds,
    leaderId: draft.leaderId,
    route,
    routeIndex: 0,
    progress: 0,
    departureDay: state.day,
    expectedDays,
    daysElapsed: 0,
    food: draft.food,
    medicine: draft.medicine,
    morale: 72,
    cohesion: Math.min(100, expeditionCohesion(members, draft.leaderId) + masterBonus),
    riskPolicy: draft.riskPolicy,
    retreatThreshold: draft.retreatThreshold,
    budget: draft.budget,
    riskProfile: draft.opportunity.riskProfile,
    reward: draft.opportunity.reward,
    logs: [
      {
        day: state.day,
        title: 'Выход из штаба',
        text: `${members.length} участников покинули город. Плановый срок — ${expectedDays} дней.`,
        type: 'report',
      },
    ],
    discoveries: [],
    casualties: [],
    reports: [],
    battles: 0,
    dungeonSiteIds: [],
  }
  const competingGuildIds = draft.opportunity.contestedByIds ?? []

  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury - draft.budget,
      supplies: state.guild.supplies - draft.food,
      medicine: state.guild.medicine - draft.medicine,
    },
    characters: state.characters.map((character) =>
      draft.memberIds.includes(character.id) ? { ...character, status: 'expedition' } : character,
    ),
    opportunities: state.opportunities.map((opportunity) =>
      opportunity.id === draft.opportunity.id ? { ...opportunity, accepted: true } : opportunity,
    ),
    expeditions: [...state.expeditions, expedition],
    rivalGuilds: state.rivalGuilds.map((rival) => {
      if (!competingGuildIds.includes(rival.id)) return rival
      const relation = Math.max(-100, rival.relation - 5)
      return { ...rival, relation, stance: stanceFromRelation(relation) }
    }),
    chronicle: [
      ...state.chronicle,
      {
        id: `chronicle-expedition-${expedition.id}`,
        day: state.day,
        year: state.year,
        title: expedition.name,
        text: `Гильдия отправила ${members.length} человек. Руководитель: ${members.find((member) => member.id === draft.leaderId)?.name ?? 'неизвестен'}.`,
        category: 'expedition',
        importance: 2,
      },
    ],
  }
}

function eventChance(state: GameState, tile: WorldTile, expedition: Expedition): number {
  const policy = expedition.riskPolicy === 'cautious' ? -0.05 : expedition.riskPolicy === 'bold' ? 0.08 : 0
  const difficulty = DIFFICULTY_RULES[state.settings.difficulty].eventRate
  return Math.max(0.06, Math.min(0.82, (0.14 + tile.danger * 0.04 + policy) * difficulty))
}

function revealAround(state: GameState, tileId: string, level: 2 | 3): GameState['world']['tiles'] {
  const center = state.world.tiles.find((tile) => tile.id === tileId)
  if (!center) return state.world.tiles
  return state.world.tiles.map((tile) => {
    const d = Math.hypot(tile.x - center.x, tile.y - center.y)
    if (tile.id === tileId) return { ...tile, knowledge: Math.max(tile.knowledge, level) as WorldTile['knowledge'] }
    if (d <= 1.5) return { ...tile, knowledge: Math.max(tile.knowledge, 1) as WorldTile['knowledge'] }
    return tile
  })
}


function createExpeditionDecision(state: GameState, expedition: Expedition, tile: WorldTile, rng: RNG): ExpeditionDecision | undefined {
  const site = tile.siteId ? state.world.sites.find((candidate) => candidate.id === tile.siteId) : undefined
  const population = tile.monsterPopulationId ? state.world.monsterPopulations.find((candidate) => candidate.id === tile.monsterPopulationId) : undefined
  const species = population ? state.world.monsterSpecies.find((candidate) => candidate.id === population.speciesId) : undefined

  if (site && !expedition.discoveries.includes(site.id)) {
    return {
      id: `decision-site-${state.day}-${expedition.id}`,
      expeditionId: expedition.id,
      locationTileId: tile.id,
      title: `Вход в «${site.name}»`,
      text: `Разведчики нашли доступный проход. Внутри заметны следы недавнего движения, а стены покрыты старыми знаками.`,
      choices: [
        { id: 'investigate', label: 'Войти и обследовать', description: 'Рискнуть ради открытия и полезных находок.', skill: 'history', difficulty: Math.max(4, site.danger), successText: 'Отряд обследовал верхний уровень и сохранил важные сведения.', failureText: 'Разведка сорвалась: проход оказался опаснее ожидаемого.', successEffects: { morale: 6, reveal: true, discoveryChance: 1, startDungeon: true }, failureEffects: { morale: -8, medicine: -2, injuryChance: 0.35, progress: -0.5, startDungeon: true } },
        { id: 'mark', label: 'Нанести на карту', description: 'Не входить внутрь, но сохранить координаты.', skill: 'cartography', difficulty: 3, successText: 'Картографы точно нанесли объект и безопасные подходы.', failureText: 'Координаты записаны неточно.', successEffects: { reveal: true, discoveryChance: 0.45, morale: 1 }, failureEffects: { reveal: true } },
        { id: 'seal', label: 'Завалить проход', description: 'Попытаться закрыть опасное место.', skill: 'combat', difficulty: 6, successText: 'Проход временно запечатан, угрозу удалось сдержать.', failureText: 'Обвал повредил лагерь и ранил участника.', successEffects: { guildReputation: 1, morale: 3 }, failureEffects: { injuryChance: 0.7, food: -5, morale: -6 } },
      ],
    }
  }

  if (species) {
    return {
      id: `decision-monster-${state.day}-${expedition.id}`,
      expeditionId: expedition.id,
      locationTileId: tile.id,
      title: `Следы: ${species.name}`,
      text: `Отряд обнаружил свежие следы и может изменить маршрут до прямого столкновения.`,
      choices: [
        { id: 'hunt', label: 'Начать охоту', description: 'Ударить первыми и проверить логово.', skill: 'combat', difficulty: species.threat + 2, successText: 'Зверя отогнали, а логово осмотрели.', failureText: 'Охота перешла в тяжёлый бой.', successEffects: { morale: 5, discoveryChance: 0.4, startCombat: 'monster', combatAdvantage: 1 }, failureEffects: { morale: -6, medicine: -1, startCombat: 'monster', combatAdvantage: -1 } },
        { id: 'observe', label: 'Наблюдать', description: 'Изучить поведение, не вступая в бой.', skill: 'scouting', difficulty: species.threat, successText: 'Разведчики собрали полезные сведения и нашли безопасный проход.', failureText: 'Существа заметили наблюдателей.', successEffects: { reveal: true, progress: 0.3, morale: 2 }, failureEffects: { progress: -0.4, morale: -5, injuryChance: 0.25 } },
        { id: 'detour', label: 'Обойти территорию', description: 'Потерять время, но снизить риск.', skill: 'survival', difficulty: 4, successText: 'Отряд нашёл безопасный обход.', failureText: 'Обход завёл в тяжёлую местность.', successEffects: { progress: -0.2, morale: 1 }, failureEffects: { progress: -0.8, food: -4, morale: -3 } },
      ],
    }
  }

  if (tile.magic > 0.72) {
    return {
      id: `decision-magic-${state.day}-${expedition.id}`,
      expeditionId: expedition.id,
      locationTileId: tile.id,
      title: 'Нестабильный магический фронт',
      text: 'Воздух дрожит, компасы вращаются, а расстояние до горизонта меняется на глазах.',
      choices: [
        { id: 'shelter', label: 'Переждать', description: 'Разбить укреплённый лагерь.', skill: 'survival', difficulty: 4, successText: 'Лагерь выдержал и отряд продолжил путь.', failureText: 'Буря всё равно повредила припасы.', successEffects: { progress: -0.5, morale: 2 }, failureEffects: { food: -6, medicine: -1, morale: -5 } },
        { id: 'study', label: 'Дать магам изучить фронт', description: 'Рискнуть ради редких данных.', skill: 'arcana', difficulty: 7, successText: 'Маги зафиксировали закономерность и открыли безопасное окно.', failureText: 'Эксперимент ударил по отряду.', successEffects: { reveal: true, morale: 7, progress: 0.4, guildReputation: 1 }, failureEffects: { morale: -10, medicine: -3, injuryChance: 0.65 } },
        { id: 'push', label: 'Идти сквозь фронт', description: 'Не терять время.', skill: 'leadership', difficulty: 6, successText: 'Лидер провёл группу через искажение.', failureText: 'Отряд рассеялся и потратил день на сбор.', successEffects: { progress: 0.7, morale: 3 }, failureEffects: { progress: -0.9, cohesion: -8, morale: -7 } },
      ],
    }
  }

  if (rng.bool(0.55)) {
    return {
      id: `decision-traveler-${state.day}-${expedition.id}`,
      expeditionId: expedition.id,
      locationTileId: tile.id,
      title: 'Раненый путник у дороги',
      text: 'Человек истощён, рядом лежит сломанная повозка. Он утверждает, что его отряд уничтожили дальше по пути.',
      choices: [
        { id: 'help', label: 'Оказать помощь', description: 'Потратить лекарства и выслушать рассказ.', skill: 'medicine', difficulty: 4, successText: 'Путника спасли. Он передал сведения о дороге.', failureText: 'Состояние оказалось тяжёлым, лекарства потрачены зря.', successEffects: { medicine: -2, reveal: true, guildReputation: 2, morale: 4 }, failureEffects: { medicine: -4, morale: -2 } },
        { id: 'question', label: 'Сначала допросить', description: 'Проверить, не является ли это ловушкой.', skill: 'diplomacy', difficulty: 5, successText: 'В рассказе нашли противоречия и избежали засады.', failureText: 'Путник замкнулся, полезных сведений нет.', successEffects: { reveal: true, morale: 1 }, failureEffects: { morale: -2 } },
        { id: 'leave', label: 'Не останавливаться', description: 'Сохранить ресурсы и продолжить путь.', successText: 'Отряд продолжил движение.', successEffects: { progress: 0.25, morale: -3 } },
      ],
    }
  }

  return {
    id: `decision-crossing-${state.day}-${expedition.id}`,
    expeditionId: expedition.id,
    locationTileId: tile.id,
    title: 'Разрушенная переправа',
    text: 'Поток поднялся после дождей. Старый мост частично смыт, но обход займёт несколько дней.',
    choices: [
      { id: 'repair', label: 'Восстановить мост', description: 'Потратить время и инструменты.', skill: 'survival', difficulty: 5, successText: 'Переправу укрепили и сохранили маршрут.', failureText: 'Работы затянулись, часть груза намокла.', successEffects: { progress: -0.2, guildReputation: 1 }, failureEffects: { progress: -0.7, food: -4 } },
      { id: 'ford', label: 'Искать брод', description: 'Положиться на разведчиков.', skill: 'scouting', difficulty: 5, successText: 'Найден безопасный брод.', failureText: 'Переход оказался опасным.', successEffects: { progress: 0.2 }, failureEffects: { medicine: -2, injuryChance: 0.45, morale: -4 } },
      { id: 'detour', label: 'Идти в обход', description: 'Надёжно, но медленно.', successText: 'Отряд выбрал долгий безопасный путь.', successEffects: { progress: -0.8, food: -3, morale: 1 } },
    ],
  }
}

function generateFieldEvent(state: GameState, expedition: Expedition, tile: WorldTile, rng: RNG): {
  expedition: Expedition
  characters: Character[]
  chronicle?: ChronicleEntry
  guildDelta?: Partial<GameState['guild']>
  reveal?: boolean
  decision?: ExpeditionDecision
} {
  let updatedExpedition = { ...expedition, logs: [...expedition.logs] }
  let characters = [...state.characters]
  const members = characters.filter((character) => expedition.memberIds.includes(character.id) && character.status !== 'dead')
  const leader = members.find((member) => member.id === expedition.leaderId)
  const survival = average(members.map((member) => member.skills.survival + member.skills.scouting))
  const medicine = average(members.map((member) => member.skills.medicine))
  const power = average(members.map((member) => member.skills.combat + member.level))
  const roll = rng.next()

  if (rng.bool(0.24)) {
    const decision = createExpeditionDecision(state, expedition, tile, rng)
    if (decision) {
      updatedExpedition.logs.push({ day: state.day, title: decision.title, text: 'Отряд ждёт решения штаба или приказа лидера.', type: 'event' })
      return { expedition: updatedExpedition, characters, decision }
    }
  }

  if (tile.siteId && !expedition.discoveries.includes(tile.siteId) && rng.bool(0.55)) {
    const site = state.world.sites.find((candidate) => candidate.id === tile.siteId)
    if (site) {
      updatedExpedition = {
        ...updatedExpedition,
        discoveries: [...updatedExpedition.discoveries, site.id],
        morale: Math.min(100, updatedExpedition.morale + 8),
        logs: [
          ...updatedExpedition.logs,
          { day: state.day, title: `Открытие: ${site.name}`, text: `Отряд обнаружил ${site.type}. Предполагаемое происхождение: ${site.origin}.`, type: 'discovery' },
        ],
      }
      return {
        expedition: updatedExpedition,
        characters,
        reveal: true,
        chronicle: {
          id: `chronicle-discovery-${state.day}-${site.id}`,
          day: state.day,
          year: state.year,
          title: `Обнаружено место: ${site.name}`,
          text: `Первая запись сообщает об опасности ${site.danger}/10. Истинное устройство места ещё неизвестно.`,
          category: 'discovery',
          importance: 4,
        },
      }
    }
  }

  if (tile.monsterPopulationId && roll < 0.38) {
    const population = state.world.monsterPopulations.find((candidate) => candidate.id === tile.monsterPopulationId)
    const species = state.world.monsterSpecies.find((candidate) => candidate.id === population?.speciesId)
    const threat = (species?.threat ?? 3) + (population?.size ?? 5) / 8
    const battleScore = power + updatedExpedition.cohesion / 18 + rng.float(-3, 3)
    if (battleScore >= threat) {
      updatedExpedition.morale = Math.min(100, updatedExpedition.morale + 4)
      updatedExpedition.logs.push({
        day: state.day,
        title: `Столкновение: ${species?.name ?? 'неизвестные существа'}`,
        text: `Отряд отбил нападение. ${species?.behavior ?? ''}`,
        type: 'combat',
      })
      if (rng.bool(0.25)) {
        const injured = rng.pick(members)
        const injury = createInjuryRecord(rng, expedition.id, 1, 'бой')
        characters = characters.map((character) =>
          character.id === injured.id
            ? addInjury({ ...character, health: Math.max(25, character.health - Math.round(rng.int(8, 24) * DIFFICULTY_RULES[state.settings.difficulty].damage)) }, injury)
            : character,
        )
      }
    } else {
      const injured = rng.pick(members)
      const difficultyRules = DIFFICULTY_RULES[state.settings.difficulty]
      const damage = Math.round(rng.int(24, 55) * difficultyRules.damage)
      const fatal = injured.health - damage <= 0 || rng.bool(Math.max(0.02, Math.min(0.48, (threat - battleScore) * 0.055 * difficultyRules.death)))
      updatedExpedition.morale = Math.max(0, updatedExpedition.morale - (fatal ? 28 : 15))
      const heavyInjury = createInjuryRecord(rng, expedition.id, damage >= 45 ? 4 : 3, 'тяжёлый бой')
      characters = characters.map((character) =>
        character.id === injured.id
          ? fatal
            ? { ...character, health: 0, status: 'dead', injuries: [...character.injuries, 'смертельная рана'] }
            : addInjury({ ...character, health: Math.max(5, character.health - damage) }, heavyInjury)
          : character,
      )
      if (fatal) updatedExpedition.casualties = [...updatedExpedition.casualties, injured.id]
      updatedExpedition.logs.push({
        day: state.day,
        title: fatal ? `Гибель: ${injured.name}` : `Тяжёлый бой: ${species?.name ?? 'неизвестные существа'}`,
        text: fatal
          ? `${injured.name} погиб в столкновении с ${species?.name ?? 'неизвестными существами'}. Отряд продолжает путь без него.`
          : `${injured.name} получил тяжёлую рану. Отряд потерял время и часть припасов.`,
        type: fatal ? 'death' : 'injury',
      })
      updatedExpedition.food = Math.max(0, updatedExpedition.food - rng.int(3, 10))
    }
    return { expedition: updatedExpedition, characters }
  }

  if (roll < 0.2) {
    const loss = rng.int(4, 14)
    updatedExpedition.food = Math.max(0, updatedExpedition.food - loss)
    updatedExpedition.morale = Math.max(0, updatedExpedition.morale - 4)
    updatedExpedition.logs.push({ day: state.day, title: 'Испорченные припасы', text: `Из-за сырости потеряно ${loss} единиц провизии.`, type: 'event' })
  } else if (roll < 0.4) {
    const saved = Math.round(survival + rng.float(-2, 4))
    if (saved >= 7) {
      updatedExpedition.food += rng.int(3, 9)
      updatedExpedition.logs.push({ day: state.day, title: 'Удачная добыча', text: 'Следопыты нашли чистую воду и пополнили припасы.', type: 'event' })
    } else {
      updatedExpedition.progress = Math.max(0, updatedExpedition.progress - 0.4)
      updatedExpedition.logs.push({ day: state.day, title: 'Потеря маршрута', text: 'Отряд потратил день на поиск старых ориентиров.', type: 'travel' })
    }
  } else if (roll < 0.58) {
    const sick = rng.pick(members)
    const damage = medicine >= 5 ? rng.int(2, 7) : rng.int(8, 18)
    characters = characters.map((character) =>
      character.id === sick.id ? { ...character, health: Math.max(10, character.health - damage), stress: Math.min(100, character.stress + 5) } : character,
    )
    updatedExpedition.logs.push({ day: state.day, title: 'Болезнь в отряде', text: `${sick.name} заболел после плохой воды.`, type: 'injury' })
  } else if (roll < 0.76) {
    updatedExpedition.cohesion = Math.max(5, updatedExpedition.cohesion - rng.int(3, 10))
    updatedExpedition.morale = Math.max(0, updatedExpedition.morale - rng.int(2, 7))
    updatedExpedition.logs.push({ day: state.day, title: 'Спор в лагере', text: `${leader?.name ?? 'Лидер'} с трудом удержал дисциплину после спора о маршруте.`, type: 'event' })
  } else {
    updatedExpedition.morale = Math.min(100, updatedExpedition.morale + 3)
    updatedExpedition.logs.push({ day: state.day, title: 'Полезные наблюдения', text: 'Картографы уточнили рельеф и отметили безопасную стоянку.', type: 'discovery' })
    return { expedition: updatedExpedition, characters, reveal: true }
  }
  return { expedition: updatedExpedition, characters }
}

function resolveObjective(state: GameState, expedition: Expedition, rng: RNG): Expedition {
  const members = state.characters.filter((character) => expedition.memberIds.includes(character.id) && character.status !== 'dead')
  const research = average(members.map((member) => member.skills.history + member.skills.cartography + member.skills.arcana))
  const combat = average(members.map((member) => member.skills.combat + member.level))
  const skill = expedition.objectiveType === 'охота' ? combat : research
  const difficulty = state.world.tiles.find((tile) => tile.id === expedition.targetTileId)?.danger ?? 4
  const score = skill + expedition.cohesion / 22 + expedition.morale / 28 + rng.float(-3, 3)
  const success = score >= difficulty + 2
  const partial = !success && score >= difficulty - 1
  const discoveryText = success ? 'цель выполнена и собраны доказательства' : partial ? 'получены частичные сведения' : 'цель не достигнута'
  return {
    ...expedition,
    status: 'returning',
    route: [...expedition.route].reverse(),
    routeIndex: 0,
    progress: 0,
    morale: success ? Math.min(100, expedition.morale + 12) : Math.max(0, expedition.morale - 10),
    discoveries: success ? [...expedition.discoveries, `result:${expedition.objectiveType}`] : expedition.discoveries,
    logs: [
      ...expedition.logs,
      {
        day: state.day,
        title: success ? 'Главная цель достигнута' : partial ? 'Частичный результат' : 'Отказ от цели',
        text: `После исследования объекта ${discoveryText}. Отряд начинает возвращение.`,
        type: success ? 'discovery' : 'report',
      },
    ],
  }
}

function completeExpedition(state: GameState, expedition: Expedition): GameState {
  const success = expedition.discoveries.some((entry) => entry.startsWith('result:'))
  const rng = new RNG(`${state.seed}:complete:${expedition.id}`)
  const survivingMembers = state.characters.filter((character) => expedition.memberIds.includes(character.id) && character.status !== 'dead')
  const reward = success ? expedition.reward : Math.floor(expedition.reward * 0.25)
  const discoveredSiteIds = expedition.discoveries.filter((entry) => entry.startsWith('site-'))
  const archivistBonus = positionHolder(state, 'chief_archivist') ? 10 : 0
  const mentorBonus = positionHolder(state, 'mentor') ? 1.2 : 1
  const researchAverage = average(survivingMembers.map((member) => member.skills.history + member.skills.cartography + member.skills.arcana))
  const evidenceQuality = Math.max(20, Math.min(100, Math.round(35 + researchAverage * 3 + expedition.cohesion * 0.25 + archivistBonus)))
  const newDiscoveries: DiscoveryRecord[] = discoveredSiteIds.map((siteId, index) => {
    const site = state.world.sites.find((candidate) => candidate.id === siteId)
    return {
      id: `discovery-${expedition.id}-${index + 1}`,
      title: site?.name ?? `Неизвестное место ${index + 1}`,
      type: 'site',
      expeditionId: expedition.id,
      tileId: site?.tileId ?? expedition.targetTileId,
      siteId,
      createdDay: state.day,
      createdYear: state.year,
      discovererIds: survivingMembers.map((member) => member.id),
      evidenceQuality,
      value: Math.max(80, Math.round(reward * 0.35 + (site?.danger ?? 3) * 35)),
      disposition: 'unreviewed',
      summary: site ? `${site.origin}. Зафиксированы слои: ${site.layers.slice(0, 2).join(', ')}.` : 'Сведения требуют проверки.',
      consequenceIds: [],
    }
  })
  if (success && newDiscoveries.length === 0) {
    newDiscoveries.push({
      id: `discovery-${expedition.id}-result`,
      title: `Результат: ${expedition.objectiveText}`,
      type: expedition.objectiveType === 'охота' ? 'monster' : expedition.objectiveType === 'картография' ? 'route' : expedition.objectiveType === 'артефакт' ? 'artifact' : 'knowledge',
      expeditionId: expedition.id,
      tileId: expedition.targetTileId,
      createdDay: state.day,
      createdYear: state.year,
      discovererIds: survivingMembers.map((member) => member.id),
      evidenceQuality,
      value: Math.max(100, Math.round(reward * 0.45)),
      disposition: 'unreviewed',
      summary: `Экспедиция собрала доказательства по задаче «${expedition.objectiveText}».`,
      consequenceIds: [],
    })
  }

  const casualtyNames = state.characters.filter((character) => expedition.casualties.includes(character.id)).map((character) => character.name)
  let updatedCharacters = state.characters.map((character) => {
    if (!expedition.memberIds.includes(character.id) || character.status === 'dead') return character
    const activeInjuries = character.injuryRecords.filter((injury) => injury.recoveryDays > 0 && !injury.treated)
    const recovering = character.health < 78 || activeInjuries.length > 0
    let updated = developCharacter(character, expedition, success, mentorBonus, rng)
    const memories: CharacterMemory[] = [
      ...updated.memories,
      createMemory(
        state,
        updated,
        success ? `Успех экспедиции «${expedition.name}»` : `Тяжёлое возвращение из «${expedition.name}»`,
        success ? 'Отряд вернулся с доказательствами и новой славой.' : 'Цель выполнена не полностью, а доверие внутри группы пошатнулось.',
        'expedition',
        success ? 'positive' : 'mixed',
        success ? 58 : 70,
        expedition.id,
        expedition.memberIds.filter((id) => id !== character.id),
      ),
    ]
    if (casualtyNames.length) {
      memories.push(createMemory(state, updated, `Потеря: ${casualtyNames.join(', ')}`, 'Смерть товарищей останется частью решений этого персонажа.', 'loss', 'negative', 88, expedition.id, expedition.casualties))
    }
    if (activeInjuries.length) {
      memories.push(createMemory(state, updated, activeInjuries[0].name, activeInjuries[0].effect, 'injury', 'negative', 75, expedition.id))
    }
    updated = {
      ...updated,
      status: recovering ? 'recovering' : 'available',
      fatigue: Math.min(100, updated.fatigue + 24),
      stress: Math.min(100, updated.stress + (success ? 3 : 12) + casualtyNames.length * 6),
      loyalty: Math.max(0, Math.min(100, updated.loyalty + (success ? 4 : -2))),
      fame: updated.fame + (success ? 6 : 1) + newDiscoveries.length * 2,
      expeditions: updated.expeditions + 1,
      discoveries: updated.discoveries + newDiscoveries.length,
      memories: memories.slice(-18),
    }
    return { ...updated, careerStage: inferCareerStage(updated) }
  })
  updatedCharacters = adjustTeamRelationships(updatedCharacters, expedition, success)

  const leader = survivingMembers.find((member) => member.id === expedition.leaderId) ?? survivingMembers[0]
  const medic = [...survivingMembers].sort((a, b) => b.skills.medicine - a.skills.medicine)[0]
  const cartographer = [...survivingMembers].sort((a, b) => b.skills.cartography - a.skills.cartography)[0]
  const critic = [...survivingMembers].sort((a, b) => a.loyalty - b.loyalty)[0]
  const reports: ExpeditionReport[] = []
  if (leader) reports.push({ id: `report-${expedition.id}-official`, authorId: leader.id, kind: 'official', title: 'Официальный отчёт лидера', claim: success ? 'Цель достигнута благодаря соблюдению мандата.' : 'Провал вызван условиями, которые нельзя было предвидеть.', reliability: Math.min(95, 45 + leader.skills.leadership * 6) })
  if (medic) reports.push({ id: `report-${expedition.id}-medical`, authorId: medic.id, kind: 'medical', title: 'Медицинское заключение', claim: expedition.casualties.length ? 'Часть потерь можно было предотвратить более ранним отступлением.' : 'Отряд получил допустимый для маршрута уровень травм.', reliability: Math.min(98, 50 + medic.skills.medicine * 6), contradictsReportId: expedition.casualties.length ? `report-${expedition.id}-official` : undefined })
  if (cartographer) reports.push({ id: `report-${expedition.id}-map`, authorId: cartographer.id, kind: 'cartographic', title: 'Картографический отчёт', claim: `Уточнено ${Math.max(1, Math.floor(expedition.route.length / 3))} участков маршрута; часть старых сведений неверна.`, reliability: Math.min(98, 52 + cartographer.skills.cartography * 6) })
  if (critic && critic.id !== leader?.id && (expedition.cohesion < 55 || expedition.casualties.length)) reports.push({ id: `report-${expedition.id}-personal`, authorId: critic.id, kind: 'personal', title: 'Личное свидетельство', claim: `Решения лидера вызвали спор; официальная версия скрывает часть конфликта.`, reliability: Math.min(90, 40 + critic.skills.scouting * 4 + critic.stats.will * 3), contradictsReportId: `report-${expedition.id}-official` })
  if (reports.length === 0) {
    const recoveredAuthor = state.characters.find((character) => expedition.memberIds.includes(character.id))
    if (recoveredAuthor) reports.push({ id: `report-${expedition.id}-recovered`, authorId: recoveredAuthor.id, kind: 'personal', title: 'Восстановленный журнал', claim: 'Полный состав не вернулся. Версия событий собрана из повреждённых записей и следов.', reliability: 32 })
  }

  const suggestedLead = [...survivingMembers].sort((a, b) => (b.skills.history + b.skills.cartography + b.skills.arcana) - (a.skills.history + a.skills.cartography + a.skills.arcana))[0]
  const debrief: ExpeditionDebrief = {
    expeditionId: expedition.id,
    createdDay: state.day,
    createdYear: state.year,
    success,
    reward,
    survivorIds: survivingMembers.map((member) => member.id),
    casualtyIds: expedition.casualties,
    injuredIds: survivingMembers.filter((member) => member.health < 78 || member.injuryRecords.some((injury) => injury.sourceExpeditionId === expedition.id)).map((member) => member.id),
    discoveryIds: newDiscoveries.map((discovery) => discovery.id),
    reports,
    battles: expedition.battles,
    dungeonSiteIds: expedition.dungeonSiteIds,
    suggestedLeadId: suggestedLead?.id,
  }

  const updatedSites = state.world.sites.map((site) => discoveredSiteIds.includes(site.id) ? { ...site, state: 'discovered' as const } : site)
  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury + reward,
      reputation: state.guild.reputation + (success ? 3 : -1),
      scientificAuthority: state.guild.scientificAuthority + newDiscoveries.length + (success ? 1 : 0),
      stability: Math.min(100, state.guild.stability + (success ? 1 : -2)),
      artifacts: state.guild.artifacts + newDiscoveries.filter((discovery) => discovery.type === 'artifact' || discovery.type === 'site').length,
      knowledge: {
        ...state.guild.knowledge,
        geography: state.guild.knowledge.geography + Math.max(1, Math.floor(expedition.route.length / 4)),
        history: state.guild.knowledge.history + newDiscoveries.filter((discovery) => discovery.type === 'site' || discovery.type === 'document').length * 2,
      },
    },
    world: { ...state.world, sites: updatedSites },
    characters: updatedCharacters,
    discoveries: [...state.discoveries, ...newDiscoveries],
    pendingDebrief: debrief,
    expeditions: state.expeditions.map((entry) => entry.id === expedition.id ? {
      ...expedition,
      status: success ? 'completed' : 'failed',
      logs: [...expedition.logs, { day: state.day, title: 'Возвращение в гильдию', text: `Вернулось ${survivingMembers.length} участников. Выплата составила ${reward} крон.`, type: 'report' as const }],
      reports,
    } : entry),
    chronicle: [...state.chronicle, {
      id: `chronicle-return-${expedition.id}`,
      day: state.day,
      year: state.year,
      title: `${expedition.name}: возвращение`,
      text: success ? `Отряд выполнил задачу. Получено ${reward} крон, открытий: ${newDiscoveries.length}. Требуется официальный разбор.` : `Отряд вернулся без полного результата. Потери: ${expedition.casualties.length}. Требуется официальный разбор.`,
      category: 'expedition',
      importance: success ? 4 : 3,
    }],
  }
}

function tickExpedition(state: GameState, expedition: Expedition, rng: RNG): GameState {
  if (expedition.status !== 'active' && expedition.status !== 'returning') return state
  let updatedExpedition: Expedition = {
    ...expedition,
    daysElapsed: expedition.daysElapsed + 1,
    food: Math.max(0, expedition.food - Math.max(1, Math.ceil(expedition.memberIds.length * 0.7))),
    morale: Math.max(0, expedition.morale - (expedition.food <= 0 ? 6 : 0.35)),
    progress: expedition.progress + (expedition.riskPolicy === 'cautious' ? 0.75 : expedition.riskPolicy === 'bold' ? 1.25 : 1),
  }
  let nextState = state

  if (updatedExpedition.progress >= 1) {
    updatedExpedition.progress -= 1
    updatedExpedition.routeIndex = Math.min(updatedExpedition.route.length - 1, updatedExpedition.routeIndex + 1)
    const currentTileId = updatedExpedition.route[updatedExpedition.routeIndex]
    const currentTile = state.world.tiles.find((tile) => tile.id === currentTileId)
    if (currentTile) {
      updatedExpedition.logs = [
        ...updatedExpedition.logs,
        { day: state.day, title: 'Продвижение', text: `Отряд вошёл в район: ${currentTile.biome}, опасность ${currentTile.danger.toFixed(1)}/10.`, type: 'travel' },
      ]
      nextState = { ...nextState, world: { ...nextState.world, tiles: revealAround(nextState, currentTileId, 2) } }
      if (rng.bool(eventChance(nextState, currentTile, updatedExpedition))) {
        const result = generateFieldEvent(nextState, updatedExpedition, currentTile, rng)
        updatedExpedition = result.expedition
        nextState = { ...nextState, characters: result.characters }
        if (result.reveal) nextState = { ...nextState, world: { ...nextState.world, tiles: revealAround(nextState, currentTileId, 3) } }
        if (result.chronicle) nextState = { ...nextState, chronicle: [...nextState.chronicle, result.chronicle] }
        if (result.decision) nextState = { ...nextState, pendingDecision: result.decision }
      }
    }
  }

  if (updatedExpedition.food <= 0 && updatedExpedition.morale <= updatedExpedition.retreatThreshold && updatedExpedition.status === 'active') {
    updatedExpedition = {
      ...updatedExpedition,
      status: 'returning',
      route: updatedExpedition.route.slice(0, updatedExpedition.routeIndex + 1).reverse(),
      routeIndex: 0,
      progress: 0,
      logs: [...updatedExpedition.logs, { day: state.day, title: 'Вынужденное возвращение', text: 'Провизия закончилась, лидер приказал поворачивать назад.', type: 'report' }],
    }
  } else if (updatedExpedition.routeIndex >= updatedExpedition.route.length - 1) {
    if (updatedExpedition.status === 'active') updatedExpedition = resolveObjective(nextState, updatedExpedition, rng)
    else {
      nextState = { ...nextState, expeditions: nextState.expeditions.map((entry) => (entry.id === updatedExpedition.id ? updatedExpedition : entry)) }
      return completeExpedition(nextState, updatedExpedition)
    }
  }

  return {
    ...nextState,
    expeditions: nextState.expeditions.map((entry) => (entry.id === updatedExpedition.id ? updatedExpedition : entry)),
  }
}


function applyDecisionEffects(expedition: Expedition, effects: DecisionEffects): Expedition {
  return {
    ...expedition,
    food: Math.max(0, expedition.food + (effects.food ?? 0)),
    medicine: Math.max(0, expedition.medicine + (effects.medicine ?? 0)),
    morale: Math.max(0, Math.min(100, expedition.morale + (effects.morale ?? 0))),
    cohesion: Math.max(0, Math.min(100, expedition.cohesion + (effects.cohesion ?? 0))),
    progress: Math.max(0, expedition.progress + (effects.progress ?? 0)),
  }
}

export function resolveExpeditionDecision(state: GameState, choiceId: string): GameState {
  const decision = state.pendingDecision
  if (!decision) return state
  const choice = decision.choices.find((candidate) => candidate.id === choiceId)
  const expedition = state.expeditions.find((candidate) => candidate.id === decision.expeditionId)
  if (!choice || !expedition) return { ...state, pendingDecision: undefined }
  const rng = new RNG(`${state.seed}:decision:${decision.id}:${choice.id}`)
  const members = state.characters.filter((character) => expedition.memberIds.includes(character.id) && character.status !== 'dead')
  const skillValue = choice.skill ? average(members.map((member) => member.skills[choice.skill!])) : 10
  const success = !choice.skill || skillValue + rng.float(-2.5, 2.5) >= (choice.difficulty ?? 4)
  const effects = success ? choice.successEffects : (choice.failureEffects ?? choice.successEffects)
  let updatedExpedition = applyDecisionEffects(expedition, effects)
  let characters = [...state.characters]
  const tile = state.world.tiles.find((candidate) => candidate.id === decision.locationTileId)

  if ((effects.injuryChance ?? 0) > 0 && members.length && rng.bool(effects.injuryChance!)) {
    const injured = rng.pick(members)
    const damage = Math.round(rng.int(9, 26) * DIFFICULTY_RULES[state.settings.difficulty].damage)
    const injury = createInjuryRecord(rng, expedition.id, damage >= 20 ? 3 : 2, 'полевое происшествие')
    characters = characters.map((character) => character.id === injured.id
      ? addInjury({ ...character, health: Math.max(3, character.health - damage) }, injury)
      : character)
    updatedExpedition.logs = [...updatedExpedition.logs, { day: state.day, title: `Ранение: ${injured.name}`, text: `${injured.name} пострадал во время принятого решения.`, type: 'injury' }]
  }

  if ((effects.discoveryChance ?? 0) > 0 && tile?.siteId && rng.bool(effects.discoveryChance!) && !updatedExpedition.discoveries.includes(tile.siteId)) {
    updatedExpedition.discoveries = [...updatedExpedition.discoveries, tile.siteId]
  }
  updatedExpedition.logs = [...updatedExpedition.logs, { day: state.day, title: decision.title, text: success ? choice.successText : (choice.failureText ?? choice.successText), type: success ? 'discovery' : 'event' }]
  if (!success || (effects.injuryChance ?? 0) > 0 || effects.reveal || (effects.guildReputation ?? 0) !== 0) {
    characters = characters.map((character) => {
      if (!expedition.memberIds.includes(character.id) || character.status === 'dead') return character
      const relationships = { ...character.relationships }
      if (character.id !== expedition.leaderId) relationships[expedition.leaderId] = Math.max(-100, Math.min(100, (relationships[expedition.leaderId] ?? 0) + (success ? 2 : -3)))
      const memory = createMemory(state, character, decision.title, success ? choice.successText : (choice.failureText ?? choice.successText), success && effects.reveal ? 'discovery' : 'expedition', success ? 'positive' : 'negative', success ? 48 : 67, expedition.id, [expedition.leaderId])
      return { ...character, relationships, memories: [...character.memories, memory].slice(-18) }
    })
  }

  let nextState: GameState = {
    ...state,
    pendingDecision: undefined,
    guild: { ...state.guild, reputation: Math.max(0, state.guild.reputation + (effects.guildReputation ?? 0)) },
    characters,
    world: effects.reveal ? { ...state.world, tiles: revealAround(state, decision.locationTileId, 3) } : state.world,
    expeditions: state.expeditions.map((candidate) => candidate.id === expedition.id ? updatedExpedition : candidate),
    chronicle: effects.guildReputation
      ? [...state.chronicle, { id: `chronicle-decision-${decision.id}`, day: state.day, year: state.year, title: decision.title, text: success ? choice.successText : (choice.failureText ?? choice.successText), category: 'expedition', importance: 2 }]
      : state.chronicle,
  }
  if (effects.startDungeon && tile?.siteId) nextState = startDungeonExploration(nextState, expedition.id, tile.siteId)
  if (effects.startCombat) nextState = startCombatEncounter(nextState, {
    expeditionId: expedition.id,
    tileId: decision.locationTileId,
    source: effects.startCombat,
    populationId: tile?.monsterPopulationId,
    siteId: tile?.siteId,
    advantage: effects.combatAdvantage ?? 0,
  })
  return nextState
}


export interface DebriefResolution {
  officialReportId: string
  leadDiscovererId?: string
  disposition: DiscoveryDisposition
}

function buildConsequences(state: GameState, discovery: DiscoveryRecord, disposition: DiscoveryDisposition): WorldConsequence[] {
  if (disposition === 'archived') return []
  const tile = state.world.tiles.find((candidate) => candidate.id === discovery.tileId)
  const settlement = tile?.settlementId
    ? state.world.settlements.find((candidate) => candidate.id === tile.settlementId)
    : state.world.settlements
      .map((candidate) => ({ candidate, tile: state.world.tiles.find((entry) => entry.id === candidate.tileId) }))
      .filter((entry) => entry.tile && tile)
      .sort((a, b) => Math.hypot(a.tile!.x - tile!.x, a.tile!.y - tile!.y) - Math.hypot(b.tile!.x - tile!.x, b.tile!.y - tile!.y))[0]?.candidate
  const due = absoluteTick(state.year, state.day) + (disposition === 'sold' ? 18 : disposition === 'secret' ? 55 : 28)
  const magnitude = Math.max(1, Math.min(10, Math.round(discovery.value / 120)))
  const consequences: WorldConsequence[] = []
  if (disposition === 'secret') {
    consequences.push({ id: `consequence-${discovery.id}-leak`, discoveryId: discovery.id, title: `Утечка сведений: ${discovery.title}`, text: 'Кто-то узнал, что гильдия скрыла важную находку. Вокруг архива появляются чужие люди.', kind: 'reputation', status: 'pending', dueTick: due, magnitude: Math.max(2, magnitude - 1), targetRealmId: tile?.stateId, targetSettlementId: settlement?.id })
    return consequences
  }
  if (discovery.type === 'route') {
    consequences.push({ id: `consequence-${discovery.id}-trade`, discoveryId: discovery.id, title: `Новый путь меняет торговлю`, text: `Маршрут из открытия «${discovery.title}» начинают использовать купцы и власти.`, kind: 'trade', status: 'pending', dueTick: due, magnitude, targetRealmId: tile?.stateId, targetSettlementId: settlement?.id })
  } else if (discovery.type === 'monster') {
    consequences.push({ id: `consequence-${discovery.id}-monsters`, discoveryId: discovery.id, title: `Изменение угроз в регионе`, text: `Сведения о существах из «${discovery.title}» меняют охоту, миграцию и безопасность дорог.`, kind: 'monsters', status: 'pending', dueTick: due, magnitude, targetRealmId: tile?.stateId, targetSettlementId: settlement?.id })
  } else if (discovery.type === 'artifact' || discovery.type === 'document') {
    consequences.push({ id: `consequence-${discovery.id}-politics`, discoveryId: discovery.id, title: `Претензии на находку`, text: `Власти и влиятельные круги требуют права на «${discovery.title}».`, kind: 'politics', status: 'pending', dueTick: due, magnitude, targetRealmId: tile?.stateId, targetSettlementId: settlement?.id })
  } else {
    consequences.push({ id: `consequence-${discovery.id}-settlement`, discoveryId: discovery.id, title: `Интерес к открытому месту`, text: `К месту «${discovery.title}» тянутся учёные, искатели наживы и чиновники.`, kind: 'settlement', status: 'pending', dueTick: due, magnitude, targetRealmId: tile?.stateId, targetSettlementId: settlement?.id })
  }
  if (disposition === 'published') {
    consequences.push({ id: `consequence-${discovery.id}-reputation`, discoveryId: discovery.id, title: `Открытие признано`, text: `Публикация «${discovery.title}» укрепляет имя гильдии и вызывает научные споры.`, kind: 'reputation', status: 'pending', dueTick: due + 8, magnitude: Math.max(1, Math.round(magnitude * 0.7)), targetRealmId: tile?.stateId, targetSettlementId: settlement?.id })
  }
  return consequences
}

export function resolveExpeditionDebrief(state: GameState, resolution: DebriefResolution): GameState {
  const debrief = state.pendingDebrief
  if (!debrief) return state
  const expedition = state.expeditions.find((candidate) => candidate.id === debrief.expeditionId)
  const chosenReport = debrief.reports.find((report) => report.id === resolution.officialReportId) ?? debrief.reports[0]
  const relatedDiscoveries = state.discoveries.filter((discovery) => debrief.discoveryIds.includes(discovery.id))
  const leadId = resolution.leadDiscovererId ?? debrief.suggestedLeadId
  const allConsequences = relatedDiscoveries.flatMap((discovery) => buildConsequences(state, discovery, resolution.disposition))
  const diplomatBonus = positionHolder(state, 'diplomat') && resolution.disposition === 'published' ? 2 : 0
  const dispositionGuildEffects: Record<DiscoveryDisposition, { treasury: number; reputation: number; authority: number; influence: number }> = {
    unreviewed: { treasury: 0, reputation: 0, authority: 0, influence: 0 },
    published: { treasury: 0, reputation: 4 + diplomatBonus, authority: 5, influence: 1 },
    archived: { treasury: 0, reputation: 0, authority: 3, influence: 0 },
    sold: { treasury: relatedDiscoveries.reduce((sum, discovery) => sum + discovery.value, 0), reputation: -1, authority: -2, influence: 2 },
    secret: { treasury: 0, reputation: -1, authority: 1, influence: 1 },
  }
  const effects = dispositionGuildEffects[resolution.disposition]
  const leaderId = expedition?.leaderId
  const reportChallengesLeader = chosenReport?.contradictsReportId?.includes('official') ?? false
  const discoveryIds = new Set(debrief.discoveryIds)

  const characters = state.characters.map((character) => {
    let updated = { ...character, relationships: { ...character.relationships }, memories: [...character.memories] }
    if (character.id === leadId && relatedDiscoveries.length) {
      updated.fame += 8 + relatedDiscoveries.length * 2
      updated.memories.push(createMemory(state, updated, `Признан автором открытия`, `Гильдия закрепила за ним авторство: ${relatedDiscoveries.map((discovery) => discovery.title).join(', ')}.`, 'discovery', 'positive', 72, debrief.expeditionId))
    }
    if (debrief.survivorIds.includes(character.id) && leadId && character.id !== leadId && leadId !== debrief.suggestedLeadId) {
      updated.relationships[leadId] = Math.max(-100, (updated.relationships[leadId] ?? 0) - 4)
    }
    if (character.id === leaderId) updated.loyalty = Math.max(0, Math.min(100, updated.loyalty + (reportChallengesLeader ? -5 : 4)))
    if (character.id === chosenReport?.authorId) updated.fame += 3
    updated.memories = updated.memories.slice(-18)
    updated.careerStage = inferCareerStage(updated)
    return updated
  })

  const discoveries = state.discoveries.map((discovery) => discoveryIds.has(discovery.id) ? {
    ...discovery,
    leadDiscovererId: leadId,
    disposition: resolution.disposition,
    consequenceIds: allConsequences.filter((consequence) => consequence.discoveryId === discovery.id).map((consequence) => consequence.id),
  } : discovery)

  return {
    ...state,
    pendingDebrief: undefined,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury + effects.treasury,
      reputation: Math.max(0, state.guild.reputation + effects.reputation + (reportChallengesLeader ? 1 : 0)),
      scientificAuthority: Math.max(0, state.guild.scientificAuthority + effects.authority + (reportChallengesLeader ? 2 : 0)),
      politicalInfluence: Math.max(0, state.guild.politicalInfluence + effects.influence),
    },
    characters,
    discoveries,
    consequences: [...state.consequences, ...allConsequences],
    expeditions: state.expeditions.map((candidate) => candidate.id === debrief.expeditionId ? { ...candidate, officialReportId: chosenReport?.id, leadDiscovererId: leadId, discoveryDisposition: resolution.disposition } : candidate),
    chronicle: [...state.chronicle, {
      id: `chronicle-debrief-${debrief.expeditionId}`,
      day: state.day,
      year: state.year,
      title: `Разбор экспедиции завершён`,
      text: `${chosenReport?.title ?? 'Отчёт'} принят за официальную версию. Открытия: ${resolution.disposition}. Автор: ${state.characters.find((character) => character.id === leadId)?.name ?? 'не назначен'}.`,
      category: 'expedition',
      importance: 3,
    }],
  }
}

function processConsequences(state: GameState): GameState {
  const now = absoluteTick(state.year, state.day)
  const due = state.consequences.filter((consequence) => consequence.status === 'pending' && consequence.dueTick <= now)
  if (!due.length) return state
  let guild = { ...state.guild }
  let realms = [...state.world.realms]
  let settlements = [...state.world.settlements]
  let tiles = [...state.world.tiles]
  const chronicle = [...state.chronicle]
  for (const consequence of due) {
    if (consequence.kind === 'trade') {
      settlements = settlements.map((settlement) => settlement.id === consequence.targetSettlementId ? { ...settlement, prosperity: Math.min(100, settlement.prosperity + consequence.magnitude * 2), population: settlement.population + consequence.magnitude * 25 } : settlement)
      realms = realms.map((realm) => realm.id === consequence.targetRealmId ? { ...realm, wealth: Math.min(100, realm.wealth + consequence.magnitude) } : realm)
    } else if (consequence.kind === 'politics') {
      realms = realms.map((realm) => realm.id === consequence.targetRealmId ? { ...realm, stability: Math.max(0, realm.stability - consequence.magnitude), attitude: realm.attitude - Math.ceil(consequence.magnitude / 2), currentIssue: 'спор о правах на открытие гильдии' } : realm)
      guild.politicalInfluence += Math.max(1, Math.floor(consequence.magnitude / 3))
    } else if (consequence.kind === 'settlement') {
      settlements = settlements.map((settlement) => settlement.id === consequence.targetSettlementId ? { ...settlement, prosperity: Math.min(100, settlement.prosperity + consequence.magnitude), safety: Math.max(0, settlement.safety - Math.ceil(consequence.magnitude / 2)) } : settlement)
    } else if (consequence.kind === 'monsters') {
      const discovery = state.discoveries.find((entry) => entry.id === consequence.discoveryId)
      tiles = tiles.map((tile) => tile.id === discovery?.tileId ? { ...tile, danger: Math.max(0.5, tile.danger - consequence.magnitude * 0.25) } : tile)
      guild.knowledge = { ...guild.knowledge, monsters: (guild.knowledge.monsters ?? 0) + consequence.magnitude }
    } else if (consequence.kind === 'reputation') {
      guild.reputation = Math.max(0, guild.reputation + (consequence.title.includes('Утечка') ? -consequence.magnitude : consequence.magnitude))
    } else if (consequence.kind === 'religion') {
      guild.scientificAuthority += consequence.magnitude
      guild.politicalInfluence = Math.max(0, guild.politicalInfluence - 1)
    }
    chronicle.push({ id: `chronicle-${consequence.id}`, day: state.day, year: state.year, title: consequence.title, text: consequence.text, category: 'world', importance: Math.min(5, Math.max(2, Math.ceil(consequence.magnitude / 2))) })
  }
  const dueIds = new Set(due.map((consequence) => consequence.id))
  return {
    ...state,
    guild,
    world: { ...state.world, realms, settlements, tiles },
    consequences: state.consequences.map((consequence) => dueIds.has(consequence.id) ? { ...consequence, status: 'resolved' } : consequence),
    chronicle,
  }
}

export function assignGuildPosition(state: GameState, positionId: GuildPositionId, holderId?: string): GameState {
  const character = holderId ? state.characters.find((candidate) => candidate.id === holderId) : undefined
  if (holderId && (!character || !character.employed || ['dead', 'missing', 'retired'].includes(character.status))) return state
  const positions = state.guild.positions.map((position) => ({
    ...position,
    holderId: position.id === positionId ? holderId : position.holderId === holderId ? undefined : position.holderId,
  }))
  return {
    ...state,
    guild: { ...state.guild, positions },
    characters: state.characters.map((candidate) => candidate.id === holderId ? {
      ...candidate,
      fame: candidate.fame + 2,
      loyalty: Math.min(100, candidate.loyalty + 4),
      memories: [...candidate.memories, createMemory(state, candidate, `Назначение: ${positions.find((position) => position.id === positionId)?.name}`, 'Персонаж получил постоянную власть и обязанности внутри гильдии.', 'career', 'positive', 52)].slice(-18),
    } : candidate),
    chronicle: [...state.chronicle, { id: `chronicle-position-${positionId}-${state.day}`, day: state.day, year: state.year, title: holderId ? `Назначен ${positions.find((position) => position.id === positionId)?.name}` : `Должность освобождена`, text: holderId ? `${character?.name} получает новую должность.` : `Гильдия временно оставила должность без руководителя.`, category: 'guild', importance: 2 }],
  }
}

function monthlyGuildTick(state: GameState): GameState {
  const payroll = state.characters
    .filter((character) => character.employed && character.status !== 'dead' && character.status !== 'retired')
    .reduce((sum, character) => sum + character.salary, 0)
  const maintenance = state.guild.rooms.reduce((sum, room) => sum + room.maintenance, 0)
  const interest = Math.ceil(state.guild.debt * state.guild.debtInterest)
  const expenseMultiplier = DIFFICULTY_RULES[state.settings.difficulty].expenses
  const quartermasterMultiplier = positionHolder(state, 'quartermaster') ? 0.92 : 1
  const total = Math.ceil((payroll + maintenance + interest) * expenseMultiplier * quartermasterMultiplier)
  const canPay = state.guild.treasury >= total

  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: canPay ? state.guild.treasury - total : 0,
      debt: canPay ? state.guild.debt : state.guild.debt + interest + (total - state.guild.treasury),
      stability: Math.max(0, state.guild.stability + (canPay ? 1 : -8)),
      daysSincePayment: canPay ? 0 : state.guild.daysSincePayment + 30,
    },
    characters: state.characters.map((character) =>
      character.status === 'dead' || character.status === 'retired'
        ? character
        : { ...character, loyalty: Math.max(0, Math.min(100, character.loyalty + (canPay ? 1 : -9))) },
    ),
    chronicle: [
      ...state.chronicle,
      {
        id: `chronicle-payroll-${state.year}-${state.day}`,
        day: state.day,
        year: state.year,
        title: canPay ? 'Месячные расходы оплачены' : 'Гильдия не смогла выплатить жалование',
        text: canPay ? `На зарплаты, содержание и проценты ушло ${total} крон.` : `Недостача добавлена к долгу. Лояльность сотрудников падает.`,
        category: 'guild',
        importance: canPay ? 1 : 4,
      },
    ],
  }
}

function recoverCharacters(state: GameState): GameState {
  const healerMultiplier = positionHolder(state, 'chief_healer') ? 1.35 : 1
  return {
    ...state,
    characters: state.characters.map((character) => {
      if (character.status !== 'recovering') return character
      const infirmary = state.guild.rooms.find((room) => room.id === 'infirmary')
      const healing = (1 + (infirmary?.level ?? 1) * 0.65) * healerMultiplier
      const health = Math.min(100, character.health + healing)
      const injuryRecords = character.injuryRecords.map((injury) => {
        if (injury.treated || injury.recoveryDays <= 0) return injury
        const recoveryDays = Math.max(0, injury.recoveryDays - Math.max(1, Math.round(healerMultiplier)))
        return { ...injury, recoveryDays, treated: recoveryDays === 0 }
      })
      const stillRecovering = health < 82 || injuryRecords.some((injury) => !injury.treated && injury.recoveryDays > 0)
      return {
        ...character,
        health,
        injuryRecords,
        fatigue: Math.max(0, character.fatigue - 1.4 * healerMultiplier),
        stress: Math.max(0, character.stress - 0.7 * healerMultiplier),
        status: stillRecovering ? 'recovering' : 'available',
      }
    }),
  }
}

export function advanceDay(state: GameState): GameState {
  if (state.pendingDecision || state.pendingDebrief || state.pendingCombat || state.pendingDungeon) return state
  let next: GameState = {
    ...state,
    day: state.day + 1,
    season: Math.floor(((state.day + 1) % 360) / 90),
  }
  if (next.day > 360) {
    next.day = 1
    next.year += 1
    next.characters = next.characters.map((character) => {
      const aged = { ...character, age: character.age + 1 }
      if (['dead', 'missing', 'retired'].includes(aged.status)) return aged
      if (aged.age >= retirementAge(aged) && aged.status !== 'expedition') {
        return {
          ...aged,
          status: 'retired' as const,
          careerStage: aged.fame >= 70 ? ('legend' as const) : ('mentor' as const),
          memories: [...aged.memories, createMemory(next, aged, 'Уход из полевой службы', 'Возраст и накопленные травмы завершили активную карьеру. Имя остаётся в гильдии.', 'career', 'mixed', 62)].slice(-18),
        }
      }
      return { ...aged, careerStage: inferCareerStage(aged) }
    })
  }

  next = recoverCharacters(next)
  const activeIds = next.expeditions
    .filter((expedition) => expedition.status === 'active' || expedition.status === 'returning')
    .map((expedition) => expedition.id)
  for (const expeditionId of activeIds) {
    const expedition = next.expeditions.find((entry) => entry.id === expeditionId)
    if (!expedition) continue
    next = tickExpedition(next, expedition, new RNG(`${next.seed}:day:${next.year}:${next.day}:${expedition.id}`))
  }

  if (next.day % 30 === 0) next = monthlyGuildTick(next)
  if (next.day % 21 === 0 && next.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= next.day).length < 4) {
    next = { ...next, opportunities: [...next.opportunities, ...createOpportunities(next.seed, next.world, next.day, next.settings).slice(0, 3)] }
  }
  next = {
    ...next,
    opportunities: next.opportunities.filter((opportunity) => opportunity.accepted || opportunity.deadlineDay >= next.day),
  }
  next = processConsequences(next)
  next = strategicDayTick(next)
  next = livingWorldDayTick(next)
  return next
}

export function advanceDays(state: GameState, days: number): GameState {
  let next = state
  for (let index = 0; index < days; index += 1) next = advanceDay(next)
  return next
}

export function upgradeRoom(state: GameState, roomId: string): GameState {
  const room = state.guild.rooms.find((candidate) => candidate.id === roomId)
  if (!room || state.guild.treasury < room.upgradeCost) return state
  const nextLevel = room.level + 1
  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury - room.upgradeCost,
      stability: Math.min(100, state.guild.stability + 2),
      maxActiveExpeditions: roomId === 'hall' && nextLevel >= 2 ? Math.max(2, state.guild.maxActiveExpeditions) : state.guild.maxActiveExpeditions,
      rooms: state.guild.rooms.map((candidate) =>
        candidate.id === roomId
          ? {
              ...candidate,
              level: nextLevel,
              condition: Math.min(100, candidate.condition + 20),
              capacity: Math.round(candidate.capacity * 1.35),
              maintenance: candidate.maintenance + 3,
              effect: `${candidate.effect}; уровень ${nextLevel}`,
              upgradeCost: Math.round(candidate.upgradeCost * 1.7),
            }
          : candidate,
      ),
    },
    chronicle: [
      ...state.chronicle,
      {
        id: `chronicle-upgrade-${roomId}-${state.day}`,
        day: state.day,
        year: state.year,
        title: `Улучшено помещение: ${room.name}`,
        text: `Помещение достигло уровня ${nextLevel}. Расходы на содержание выросли.`,
        category: 'guild',
        importance: 2,
      },
    ],
  }
}

export function payDebt(state: GameState, amount: number): GameState {
  const payment = Math.max(0, Math.min(amount, state.guild.treasury, state.guild.debt))
  if (payment <= 0) return state
  return {
    ...state,
    guild: { ...state.guild, treasury: state.guild.treasury - payment, debt: state.guild.debt - payment, stability: Math.min(100, state.guild.stability + Math.ceil(payment / 500)) },
  }
}

export function hireCharacter(state: GameState, characterId: string): GameState {
  const character = state.characters.find((candidate) => candidate.id === characterId)
  if (!character || character.employed || character.rivalGuildId || character.status === 'dead' || character.status === 'missing') return state
  const signingCost = 60 + character.level * 25
  if (state.guild.treasury < signingCost) return state
  return {
    ...state,
    guild: { ...state.guild, treasury: state.guild.treasury - signingCost, adventurerPrestige: state.guild.adventurerPrestige + 1 },
    characters: state.characters.map((candidate) => candidate.id === characterId ? { ...candidate, employed: true, loyalty: Math.max(45, candidate.loyalty) } : candidate),
    chronicle: [...state.chronicle, { id: `chronicle-hire-${characterId}-${state.day}`, day: state.day, year: state.year, title: `${character.name} вступает в гильдию`, text: `Подписан постоянный контракт. Вступительный платёж составил ${signingCost} крон.`, category: 'character', importance: 1 }],
  }
}

export function dismissCharacter(state: GameState, characterId: string): GameState {
  const character = state.characters.find((candidate) => candidate.id === characterId)
  if (!character || !character.employed || character.status === 'expedition' || character.status === 'dead') return state
  return {
    ...state,
    characters: state.characters.map((candidate) => candidate.id === characterId ? { ...candidate, employed: false, loyalty: Math.max(0, candidate.loyalty - 20) } : candidate),
    chronicle: [...state.chronicle, { id: `chronicle-dismiss-${characterId}-${state.day}`, day: state.day, year: state.year, title: `${character.name} покидает штат`, text: 'Контракт расторгнут. Персонаж остаётся в мире и позднее может перейти к конкурентам.', category: 'character', importance: 1 }],
  }
}
