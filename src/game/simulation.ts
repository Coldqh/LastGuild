import type {
  Character,
  ChronicleEntry,
  Expedition,
  GameState,
  Opportunity,
  WorldTile,
} from '../types/game'
import { RNG } from './rng'
import { createOpportunities } from './gameFactory'

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
    cohesion: expeditionCohesion(members, draft.leaderId),
    riskPolicy: draft.riskPolicy,
    retreatThreshold: draft.riskPolicy === 'cautious' ? 45 : draft.riskPolicy === 'bold' ? 18 : 30,
    budget: draft.budget,
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
  }

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

function eventChance(tile: WorldTile, expedition: Expedition): number {
  const policy = expedition.riskPolicy === 'cautious' ? -0.05 : expedition.riskPolicy === 'bold' ? 0.08 : 0
  return Math.max(0.08, Math.min(0.7, 0.14 + tile.danger * 0.04 + policy))
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

function generateFieldEvent(state: GameState, expedition: Expedition, tile: WorldTile, rng: RNG): {
  expedition: Expedition
  characters: Character[]
  chronicle?: ChronicleEntry
  guildDelta?: Partial<GameState['guild']>
  reveal?: boolean
} {
  let updatedExpedition = { ...expedition, logs: [...expedition.logs] }
  let characters = [...state.characters]
  const members = characters.filter((character) => expedition.memberIds.includes(character.id) && character.status !== 'dead')
  const leader = members.find((member) => member.id === expedition.leaderId)
  const survival = average(members.map((member) => member.skills.survival + member.skills.scouting))
  const medicine = average(members.map((member) => member.skills.medicine))
  const power = average(members.map((member) => member.skills.combat + member.level))
  const roll = rng.next()

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
        characters = characters.map((character) =>
          character.id === injured.id
            ? { ...character, health: Math.max(25, character.health - rng.int(8, 24)), injuries: [...character.injuries, 'рана после боя'] }
            : character,
        )
      }
    } else {
      const injured = rng.pick(members)
      const damage = rng.int(24, 55)
      const fatal = injured.health - damage <= 0 || rng.bool(Math.max(0.03, Math.min(0.28, (threat - battleScore) * 0.055)))
      updatedExpedition.morale = Math.max(0, updatedExpedition.morale - (fatal ? 28 : 15))
      characters = characters.map((character) =>
        character.id === injured.id
          ? fatal
            ? { ...character, health: 0, status: 'dead', injuries: [...character.injuries, 'смертельная рана'] }
            : { ...character, health: Math.max(5, character.health - damage), injuries: [...character.injuries, 'тяжёлая рана'] }
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
  const survivingMembers = state.characters.filter((character) => expedition.memberIds.includes(character.id) && character.status !== 'dead')
  const reward = success ? expedition.reward : Math.floor(expedition.reward * 0.25)
  const discoveredSiteIds = expedition.discoveries.filter((entry) => entry.startsWith('site-'))
  const updatedSites = state.world.sites.map((site) =>
    discoveredSiteIds.includes(site.id) ? { ...site, state: 'discovered' as const } : site,
  )

  const updatedCharacters = state.characters.map((character) => {
    if (!expedition.memberIds.includes(character.id) || character.status === 'dead') return character
    const recovered = character.health < 70
    return {
      ...character,
      status: recovered ? ('recovering' as const) : ('available' as const),
      fatigue: Math.min(100, character.fatigue + 24),
      stress: Math.min(100, character.stress + (success ? 3 : 12)),
      loyalty: Math.min(100, character.loyalty + (success ? 4 : -2)),
      fame: character.fame + (success ? 6 : 1),
      expeditions: character.expeditions + 1,
      discoveries: character.discoveries + discoveredSiteIds.length,
      memories: [
        ...character.memories,
        {
          id: `memory-${expedition.id}-${character.id}`,
          title: success ? `Успех экспедиции «${expedition.name}»` : `Тяжёлое возвращение из экспедиции`,
          intensity: success ? 55 : 70,
          valence: success ? ('positive' as const) : ('mixed' as const),
          year: state.year,
        },
      ].slice(-12),
    }
  })

  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury + reward,
      reputation: state.guild.reputation + (success ? 5 : -1),
      scientificAuthority: state.guild.scientificAuthority + discoveredSiteIds.length * 2 + (success ? 1 : 0),
      stability: Math.min(100, state.guild.stability + (success ? 2 : -2)),
      artifacts: state.guild.artifacts + discoveredSiteIds.length,
      knowledge: {
        ...state.guild.knowledge,
        geography: state.guild.knowledge.geography + Math.max(1, Math.floor(expedition.route.length / 4)),
        history: state.guild.knowledge.history + discoveredSiteIds.length * 2,
      },
    },
    world: { ...state.world, sites: updatedSites },
    characters: updatedCharacters,
    expeditions: state.expeditions.map((entry) =>
      entry.id === expedition.id
        ? {
            ...expedition,
            status: success ? ('completed' as const) : ('failed' as const),
            logs: [
              ...expedition.logs,
              {
                day: state.day,
                title: 'Возвращение в гильдию',
                text: `Вернулось ${survivingMembers.length} участников. Выплата составила ${reward} крон.`,
                type: 'report' as const,
              },
            ],
          }
        : entry,
    ),
    chronicle: [
      ...state.chronicle,
      {
        id: `chronicle-return-${expedition.id}`,
        day: state.day,
        year: state.year,
        title: `${expedition.name}: возвращение`,
        text: success
          ? `Отряд выполнил задачу. Получено ${reward} крон, открытий: ${discoveredSiteIds.length}.`
          : `Отряд вернулся без полного результата. Гильдия получила только ${reward} крон.`,
        category: 'expedition',
        importance: success ? 4 : 3,
      },
    ],
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
      if (rng.bool(eventChance(currentTile, updatedExpedition))) {
        const result = generateFieldEvent(nextState, updatedExpedition, currentTile, rng)
        updatedExpedition = result.expedition
        nextState = { ...nextState, characters: result.characters }
        if (result.reveal) nextState = { ...nextState, world: { ...nextState.world, tiles: revealAround(nextState, currentTileId, 3) } }
        if (result.chronicle) nextState = { ...nextState, chronicle: [...nextState.chronicle, result.chronicle] }
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

function monthlyGuildTick(state: GameState): GameState {
  const payroll = state.characters
    .filter((character) => character.employed && character.status !== 'dead' && character.status !== 'retired')
    .reduce((sum, character) => sum + character.salary, 0)
  const maintenance = state.guild.rooms.reduce((sum, room) => sum + room.maintenance, 0)
  const interest = Math.ceil(state.guild.debt * state.guild.debtInterest)
  const total = payroll + maintenance + interest
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
  return {
    ...state,
    characters: state.characters.map((character) => {
      if (character.status !== 'recovering') return character
      const infirmary = state.guild.rooms.find((room) => room.id === 'infirmary')
      const healing = 1 + (infirmary?.level ?? 1) * 0.65
      const health = Math.min(100, character.health + healing)
      return {
        ...character,
        health,
        fatigue: Math.max(0, character.fatigue - 1.4),
        stress: Math.max(0, character.stress - 0.7),
        status: health >= 82 ? ('available' as const) : character.status,
      }
    }),
  }
}

export function advanceDay(state: GameState): GameState {
  let next: GameState = {
    ...state,
    day: state.day + 1,
    season: Math.floor(((state.day + 1) % 360) / 90),
  }
  if (next.day > 360) {
    next.day = 1
    next.year += 1
    next.characters = next.characters.map((character) => ({ ...character, age: character.age + 1 }))
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
    next = { ...next, opportunities: [...next.opportunities, ...createOpportunities(next.seed, next.world, next.day).slice(0, 3)] }
  }
  next = {
    ...next,
    opportunities: next.opportunities.filter((opportunity) => opportunity.accepted || opportunity.deadlineDay >= next.day),
  }
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
  if (!character || character.employed || character.status === 'dead' || character.status === 'missing') return state
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
