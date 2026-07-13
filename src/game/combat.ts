import type {
  BestiaryEntry,
  Character,
  CharacterInjuryRecord,
  CharacterMemory,
  CombatCommandType,
  CombatEncounter,
  CombatGridCell,
  CombatUnit,
  GameState,
  MonsterSpecies,
} from '../types/game'
import { RNG } from './rng'
import { DIFFICULTY_RULES } from './worldSettings'

export interface StartCombatParams {
  expeditionId: string
  tileId: string
  source: 'monster' | 'site_guardians' | 'dungeon_zone'
  speciesId?: string
  populationId?: string
  siteId?: string
  zoneId?: string
  advantage?: number
}

const distance = (a: CombatUnit, b: CombatUnit) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function heroAbility(character: Character): string {
  const abilities: Record<string, string> = {
    Воин: 'щитовая стойка',
    Следопыт: 'прицельный залп',
    Маг: 'дуговой разряд',
    Жрец: 'боевая молитва',
    Плут: 'удар из тени',
    Охотник: 'охотничья метка',
    Лекарь: 'полевая помощь',
    Картограф: 'тактическая разметка',
    Археолог: 'знание руин',
    Переводчик: 'сигнал к переговорам',
    'Искатель реликвий': 'защитный амулет',
  }
  return abilities[character.profession] ?? 'слаженный удар'
}

function heroRange(character: Character): number {
  if (['Следопыт', 'Охотник'].includes(character.profession)) return 5
  if (['Маг', 'Жрец', 'Лекарь'].includes(character.profession)) return 4
  if (['Картограф', 'Переводчик'].includes(character.profession)) return 3
  return 1
}

function buildCells(rng: RNG, width: number, height: number): CombatGridCell[] {
  const cells: CombatGridCell[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const protectedZone = x <= 1 || x >= width - 2
      const obstacle = !protectedZone && rng.bool(0.12)
        ? rng.pick<NonNullable<CombatGridCell['obstacle']>>(['rock', 'tree', 'ruin', 'pit'])
        : undefined
      cells.push({ x, y, obstacle })
    }
  }
  return cells
}

function createHeroUnit(character: Character, index: number, count: number, height: number): CombatUnit {
  const maxHp = Math.max(38, Math.round(52 + character.stats.endurance * 5 + character.level * 4))
  const healthRatio = clamp(character.health / 100, 0.15, 1)
  return {
    id: `combat-hero-${character.id}`,
    sourceId: character.id,
    name: character.name,
    side: 'guild',
    x: character.combatBehavior.role === 'frontline' ? 2 : 1,
    y: Math.round(((index + 1) * (height - 1)) / (count + 1)),
    hp: Math.round(maxHp * healthRatio),
    maxHp,
    armor: Math.floor(character.stats.endurance / 3) + (character.profession === 'Воин' ? 3 : 0),
    attack: 7 + character.skills.combat * 2 + character.level + Math.floor(character.stats.strength / 3),
    range: heroRange(character),
    movement: character.combatBehavior.role === 'skirmisher' ? 3 : 2,
    initiative: character.stats.agility + character.skills.scouting + character.level,
    morale: clamp(72 - character.stress * 0.35 + character.loyalty * 0.2, 25, 100),
    role: character.combatBehavior.role,
    status: 'ready',
    ability: heroAbility(character),
    damageTaken: 0,
    kills: 0,
  }
}

function createEnemyUnit(species: MonsterSpecies, index: number, count: number, width: number, height: number, legendary: boolean): CombatUnit {
  const maxHp = Math.round((24 + species.threat * 9) * (legendary ? 2.3 : 1))
  return {
    id: `combat-enemy-${index + 1}`,
    sourceId: species.id,
    name: legendary ? species.name : `${species.name} ${index + 1}`,
    side: 'enemy',
    x: legendary ? width - 2 : width - 1 - (index % 2),
    y: Math.round(((index + 1) * (height - 1)) / (count + 1)),
    hp: maxHp,
    maxHp,
    armor: species.armor + (legendary ? 2 : 0),
    attack: 7 + species.threat * 2 + (legendary ? 5 : 0),
    range: species.id === 'wyverns' || species.id === 'constructs' ? 3 : species.id === 'goblins' ? 4 : 1,
    movement: species.movement,
    initiative: species.movement * 2 + species.threat + (legendary ? 3 : 0),
    morale: legendary ? 100 : 58 + species.threat * 4,
    role: species.id === 'constructs' ? 'controller' : species.id === 'goblins' ? 'ranged' : species.id === 'wights' ? 'controller' : 'frontline',
    status: 'ready',
    ability: species.abilities[index % species.abilities.length],
    legendary,
    damageTaken: 0,
    kills: 0,
  }
}

function bestiaryEntry(state: GameState, speciesId: string): BestiaryEntry {
  return state.bestiary.find((entry) => entry.speciesId === speciesId) ?? {
    speciesId,
    sightings: 0,
    encounters: 0,
    victories: 0,
    kills: 0,
    deathsCaused: 0,
    knowledge: 0,
    discoveredWeakness: false,
    notes: [],
    legendaryNames: [],
  }
}

export function startCombatEncounter(state: GameState, params: StartCombatParams): GameState {
  if (state.pendingCombat) return state
  const expedition = state.expeditions.find((candidate) => candidate.id === params.expeditionId)
  if (!expedition) return state
  const tile = state.world.tiles.find((candidate) => candidate.id === params.tileId)
  const population = params.populationId
    ? state.world.monsterPopulations.find((candidate) => candidate.id === params.populationId)
    : tile?.monsterPopulationId
      ? state.world.monsterPopulations.find((candidate) => candidate.id === tile.monsterPopulationId)
      : undefined
  const site = params.siteId ? state.world.sites.find((candidate) => candidate.id === params.siteId) : tile?.siteId ? state.world.sites.find((candidate) => candidate.id === tile.siteId) : undefined
  const speciesId = params.speciesId ?? population?.speciesId ?? site?.monsterTags[0] ?? state.world.monsterSpecies[0]?.id
  const species = state.world.monsterSpecies.find((candidate) => candidate.id === speciesId)
  if (!species) return state

  const members = state.characters.filter((character) => expedition.memberIds.includes(character.id) && character.status === 'expedition' && character.health > 0)
  if (!members.length) return state
  const rng = new RNG(`${state.seed}:combat:${state.year}:${state.day}:${expedition.id}:${params.zoneId ?? params.tileId}`)
  const width = 10
  const height = 8
  const legendary = Boolean(population?.legendary)
  const baseCount = params.source === 'dungeon_zone' ? 2 + Math.floor(species.threat / 2) : Math.max(2, Math.min(7, Math.ceil((population?.size ?? species.threat * 2) / 4)))
  const enemyCount = legendary ? Math.max(3, baseCount) : baseCount
  const units: CombatUnit[] = [
    ...members.map((character, index) => createHeroUnit(character, index, members.length, height)),
    ...Array.from({ length: enemyCount }, (_, index) => createEnemyUnit(species, index, enemyCount, width, height, legendary && index === 0)),
  ]
  const encounter: CombatEncounter = {
    id: `combat-${expedition.id}-${state.day}-${params.zoneId ?? params.tileId}`,
    expeditionId: expedition.id,
    tileId: params.tileId,
    siteId: params.siteId,
    zoneId: params.zoneId,
    speciesId: species.id,
    populationId: population?.id,
    title: legendary && population?.legendaryName ? `${population.legendaryName} — ${species.name}` : species.name,
    width,
    height,
    round: 1,
    status: 'active',
    commandPoints: 3,
    cells: buildCells(rng, width, height),
    units,
    logs: [{ round: 0, text: `Отряд вступил в бой: ${members.length} против ${enemyCount}.`, type: 'command' }],
    retreatOrdered: false,
    advantage: params.advantage ?? 0,
  }
  const previous = bestiaryEntry(state, species.id)
  const legendaryNames = population?.legendaryName && !previous.legendaryNames.includes(population.legendaryName)
    ? [...previous.legendaryNames, population.legendaryName]
    : previous.legendaryNames
  return {
    ...state,
    pendingCombat: encounter,
    bestiary: [...state.bestiary.filter((entry) => entry.speciesId !== species.id), {
      ...previous,
      sightings: previous.sightings + 1,
      encounters: previous.encounters + 1,
      knowledge: Math.min(100, previous.knowledge + 8),
      legendaryNames,
      notes: [...previous.notes, `Бой в клетке ${tile?.x ?? '?'}:${tile?.y ?? '?'}.`].slice(-8),
    }],
  }
}

function cellBlocked(encounter: CombatEncounter, x: number, y: number, units: CombatUnit[]): boolean {
  if (x < 0 || y < 0 || x >= encounter.width || y >= encounter.height) return true
  const cell = encounter.cells.find((entry) => entry.x === x && entry.y === y)
  if (cell?.obstacle === 'pit') return true
  return units.some((unit) => unit.hp > 0 && unit.x === x && unit.y === y)
}

function moveToward(encounter: CombatEncounter, unit: CombatUnit, target: CombatUnit, units: CombatUnit[], away = false): CombatUnit {
  let current = { ...unit }
  for (let step = 0; step < unit.movement; step += 1) {
    const candidates = [
      [current.x + 1, current.y], [current.x - 1, current.y], [current.x, current.y + 1], [current.x, current.y - 1],
      [current.x + 1, current.y + 1], [current.x + 1, current.y - 1], [current.x - 1, current.y + 1], [current.x - 1, current.y - 1],
    ].filter(([x, y]) => !cellBlocked(encounter, x, y, units.filter((candidate) => candidate.id !== unit.id)))
    if (!candidates.length) break
    candidates.sort((a, b) => {
      const da = Math.max(Math.abs(a[0] - target.x), Math.abs(a[1] - target.y))
      const db = Math.max(Math.abs(b[0] - target.x), Math.abs(b[1] - target.y))
      return away ? db - da : da - db
    })
    const [x, y] = candidates[0]
    const before = Math.max(Math.abs(current.x - target.x), Math.abs(current.y - target.y))
    const after = Math.max(Math.abs(x - target.x), Math.abs(y - target.y))
    if ((!away && after >= before) || (away && after <= before)) break
    current = { ...current, x, y }
  }
  return current
}

function coverBonus(encounter: CombatEncounter, target: CombatUnit): number {
  return encounter.cells.some((cell) => cell.obstacle && cell.obstacle !== 'pit' && Math.max(Math.abs(cell.x - target.x), Math.abs(cell.y - target.y)) <= 1) ? 0.12 : 0
}

function attackUnit(encounter: CombatEncounter, attacker: CombatUnit, target: CombatUnit, rng: RNG, ability = false): { attacker: CombatUnit; target: CombatUnit; log: string } {
  const advantage = attacker.side === 'guild' ? encounter.advantage * 0.05 : -encounter.advantage * 0.05
  const hitChance = clamp(0.68 + (attacker.initiative - target.initiative) * 0.012 + advantage - coverBonus(encounter, target), 0.25, 0.95)
  if (!rng.bool(hitChance)) return { attacker, target, log: `${attacker.name} промахивается по ${target.name}.` }
  const abilityBonus = ability ? Math.max(3, Math.round(attacker.attack * 0.45)) : 0
  const raw = attacker.attack + abilityBonus + rng.int(-3, 4)
  const damage = Math.max(1, raw - target.armor)
  const hp = Math.max(0, target.hp - damage)
  const nextTarget = { ...target, hp, damageTaken: target.damageTaken + damage, status: hp <= 0 ? (target.side === 'enemy' ? 'dead' as const : 'down' as const) : hp < target.maxHp * 0.45 ? 'wounded' as const : target.status }
  const nextAttacker = hp <= 0 ? { ...attacker, kills: attacker.kills + 1 } : attacker
  return { attacker: nextAttacker, target: nextTarget, log: `${attacker.name} ${ability ? `использует «${attacker.ability}» и ` : ''}наносит ${damage} урона ${target.name}${hp <= 0 ? ' — цель падает' : ''}.` }
}

function living(units: CombatUnit[], side: CombatUnit['side']): CombatUnit[] {
  return units.filter((unit) => unit.side === side && unit.hp > 0 && unit.status !== 'dead')
}

function chooseTarget(encounter: CombatEncounter, unit: CombatUnit, opponents: CombatUnit[]): CombatUnit | undefined {
  if (!opponents.length) return undefined
  if (unit.side === 'guild' && encounter.focusTargetId) {
    const focused = opponents.find((candidate) => candidate.id === encounter.focusTargetId)
    if (focused) return focused
  }
  const protectedId = encounter.protectedCharacterId
  const sorted = [...opponents].sort((a, b) => {
    if (unit.side === 'enemy' && protectedId) {
      if (a.sourceId === protectedId) return 1
      if (b.sourceId === protectedId) return -1
    }
    const healthA = a.hp / a.maxHp
    const healthB = b.hp / b.maxHp
    const distanceShift = distance(unit, a) - distance(unit, b)
    if (unit.side === 'enemy') return healthA - healthB || distanceShift
    return (b.legendary ? 1 : 0) - (a.legendary ? 1 : 0) || distanceShift
  })
  return sorted[0]
}

export function issueCombatCommand(state: GameState, command: CombatCommandType, targetId?: string): GameState {
  const combat = state.pendingCombat
  if (!combat || combat.status !== 'active' || combat.commandPoints <= 0) return state
  const logs = [...combat.logs]
  let next = { ...combat, commandPoints: combat.commandPoints - 1, logs }
  if (command === 'focus') {
    next.focusTargetId = targetId
    logs.push({ round: combat.round, text: 'Команда: сосредоточить огонь на выбранной цели.', type: 'command' })
  } else if (command === 'protect') {
    next.protectedCharacterId = targetId
    logs.push({ round: combat.round, text: 'Команда: прикрыть выбранного участника.', type: 'command' })
  } else if (command === 'rally') {
    next.units = combat.units.map((unit) => unit.side === 'guild' && unit.hp > 0 ? { ...unit, morale: Math.min(100, unit.morale + 24), status: unit.status === 'panicked' ? 'ready' : unit.status } : unit)
    logs.push({ round: combat.round, text: 'Команда: собраться и удержать строй.', type: 'command' })
  } else {
    next.retreatOrdered = true
    logs.push({ round: combat.round, text: 'Команда: организованное отступление.', type: 'command' })
  }
  return { ...state, pendingCombat: next }
}

export function stepCombat(state: GameState): GameState {
  const combat = state.pendingCombat
  if (!combat || combat.status !== 'active') return state
  const rng = new RNG(`${state.seed}:${combat.id}:round:${combat.round}`)
  let units = combat.units.map((unit) => ({ ...unit }))
  const logs = [...combat.logs]
  const order = units.filter((unit) => unit.hp > 0).sort((a, b) => b.initiative - a.initiative || rng.float(-1, 1))

  for (const ordered of order) {
    let unitIndex = units.findIndex((unit) => unit.id === ordered.id)
    let unit = units[unitIndex]
    if (!unit || unit.hp <= 0 || unit.status === 'dead' || unit.status === 'down') continue
    if (unit.morale < 18 && rng.bool(0.35)) {
      units[unitIndex] = { ...unit, status: 'panicked' }
      logs.push({ round: combat.round, text: `${unit.name} паникует и теряет действие.`, type: 'morale' })
      continue
    }
    const opponents = living(units, unit.side === 'guild' ? 'enemy' : 'guild')
    const allies = living(units, unit.side)
    const target = chooseTarget(combat, unit, opponents)
    if (!target) continue

    if (unit.side === 'guild' && combat.retreatOrdered) {
      const oldX = unit.x
      unit = { ...unit, x: Math.max(0, unit.x - unit.movement) }
      units[unitIndex] = unit
      logs.push({ round: combat.round, text: `${unit.name} отходит: ${oldX}→${unit.x}.`, type: 'move' })
      continue
    }

    const woundedAlly = allies.filter((ally) => ally.hp > 0 && ally.hp < ally.maxHp * 0.5).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
    if (unit.side === 'guild' && unit.role === 'support' && woundedAlly && combat.round % 2 === 0) {
      const heal = Math.max(5, Math.round(unit.attack * 0.55))
      const allyIndex = units.findIndex((candidate) => candidate.id === woundedAlly.id)
      units[allyIndex] = { ...woundedAlly, hp: Math.min(woundedAlly.maxHp, woundedAlly.hp + heal), status: 'ready' }
      logs.push({ round: combat.round, text: `${unit.name} оказывает помощь ${woundedAlly.name}: +${heal} здоровья.`, type: 'ability' })
      continue
    }

    const currentDistance = distance(unit, target)
    if (unit.range > 1 && currentDistance <= 1 && unit.role !== 'frontline') {
      unit = moveToward(combat, unit, target, units, true)
      units[unitIndex] = unit
    } else if (currentDistance > unit.range) {
      const moved = moveToward(combat, unit, target, units)
      if (moved.x !== unit.x || moved.y !== unit.y) logs.push({ round: combat.round, text: `${unit.name} меняет позицию.`, type: 'move' })
      unit = moved
      units[unitIndex] = unit
    }

    const updatedTarget = units.find((candidate) => candidate.id === target.id)
    if (!updatedTarget || distance(unit, updatedTarget) > unit.range) continue
    const useAbility = Boolean(unit.ability && combat.round % (unit.legendary ? 2 : 3) === 0)
    const result = attackUnit(combat, unit, updatedTarget, rng, useAbility)
    units[unitIndex] = result.attacker
    const targetIndex = units.findIndex((candidate) => candidate.id === updatedTarget.id)
    units[targetIndex] = result.target
    logs.push({ round: combat.round, text: result.log, type: result.target.hp <= 0 ? 'death' : useAbility ? 'ability' : 'attack' })

    if (result.target.hp <= 0) {
      units = units.map((candidate) => candidate.side === result.target.side && candidate.hp > 0 ? { ...candidate, morale: Math.max(0, candidate.morale - (result.target.legendary ? 24 : 9)) } : candidate)
    }
  }

  const guildAlive = living(units, 'guild')
  const enemiesAlive = living(units, 'enemy')
  let status: CombatEncounter['status'] = combat.status
  if (!enemiesAlive.length) status = 'victory'
  else if (!guildAlive.length) status = 'defeat'
  else if (combat.retreatOrdered && combat.round >= 2 && guildAlive.filter((unit) => unit.x <= 1).length >= Math.ceil(guildAlive.length * 0.6)) status = 'retreated'
  else if (combat.round >= 24) status = 'retreated'

  return {
    ...state,
    pendingCombat: {
      ...combat,
      units,
      logs: logs.slice(-80),
      round: combat.round + 1,
      status,
    },
  }
}

export function autoResolveCombat(state: GameState): GameState {
  let next = state
  for (let index = 0; index < 30 && next.pendingCombat?.status === 'active'; index += 1) next = stepCombat(next)
  return next
}

function injuryRecord(rng: RNG, encounter: CombatEncounter, severity: number): CharacterInjuryRecord {
  const table = [
    ['рассечённое плечо', 'снижение силы до восстановления'],
    ['перелом рёбер', 'хуже выносливость и дыхание'],
    ['раздробленное колено', 'снижение скорости в походах'],
    ['потеря глаза', 'постоянный штраф к дальнему бою'],
    ['магическое поражение нервов', 'хроническая боль и стресс'],
  ]
  const safe = clamp(Math.round(severity), 1, 5) as 1 | 2 | 3 | 4 | 5
  const [name, effect] = table[safe - 1]
  return {
    id: `injury-${encounter.id}-${rng.int(1000, 999999)}`,
    name: `${name} (${encounter.title})`,
    severity: safe,
    permanent: safe >= 4 || rng.bool(safe * 0.08),
    recoveryDays: safe * rng.int(7, 14),
    effect,
    sourceExpeditionId: encounter.expeditionId,
    treated: false,
  }
}

function combatMemory(state: GameState, character: Character, encounter: CombatEncounter, text: string, negative: boolean): CharacterMemory {
  return {
    id: `memory-${character.id}-${encounter.id}`,
    title: `Бой: ${encounter.title}`,
    description: text,
    intensity: negative ? 82 : 67,
    valence: negative ? 'negative' : 'mixed',
    type: negative ? 'injury' : 'expedition',
    year: state.year,
    day: state.day,
    expeditionId: encounter.expeditionId,
    relatedCharacterIds: encounter.units.filter((unit) => unit.side === 'guild' && unit.sourceId !== character.id).map((unit) => unit.sourceId),
  }
}

export function finalizeCombat(state: GameState): GameState {
  const combat = state.pendingCombat
  if (!combat || combat.status === 'active') return state
  const expedition = state.expeditions.find((candidate) => candidate.id === combat.expeditionId)
  if (!expedition) return { ...state, pendingCombat: undefined }
  const rng = new RNG(`${state.seed}:${combat.id}:final`)
  const difficulty = DIFFICULTY_RULES[state.settings.difficulty]
  const guildUnits = combat.units.filter((unit) => unit.side === 'guild')
  const enemyUnits = combat.units.filter((unit) => unit.side === 'enemy')
  const deadEnemyCount = enemyUnits.filter((unit) => unit.hp <= 0).length
  const casualties = [...expedition.casualties]
  const injuredIds: string[] = []

  const characters = state.characters.map((character) => {
    const unit = guildUnits.find((candidate) => candidate.sourceId === character.id)
    if (!unit) return character
    const damageRatio = clamp(unit.damageTaken / unit.maxHp, 0, 1.8)
    let health = Math.max(0, character.health - damageRatio * 68)
    let status = character.status
    const records = [...character.injuryRecords]
    const injuries = [...character.injuries]
    const wasDown = unit.status === 'down' || unit.hp <= 0
    const deathChance = wasDown ? clamp((0.12 + Math.max(0, damageRatio - 0.8) * 0.35) * difficulty.damage, 0.05, 0.78) : 0
    if (wasDown && rng.bool(deathChance)) {
      status = 'dead'
      health = 0
      if (!casualties.includes(character.id)) casualties.push(character.id)
    } else if (damageRatio > 0.22 || wasDown) {
      const severity = wasDown ? (damageRatio > 1 ? 4 : 3) : damageRatio > 0.55 ? 3 : 2
      const record = injuryRecord(rng, combat, severity)
      records.push(record)
      injuries.push(record.name)
      injuredIds.push(character.id)
      status = 'recovering'
      health = Math.max(6, health)
    }
    const memoryText = status === 'dead'
      ? `${character.name} погиб в бою.`
      : combat.status === 'victory'
        ? `Отряд победил. Получено урона: ${unit.damageTaken}.`
        : `Отряд вышел из боя со статусом «${combat.status}». Получено урона: ${unit.damageTaken}.`
    return {
      ...character,
      health,
      status,
      fatigue: Math.min(100, character.fatigue + 18 + combat.round),
      stress: Math.min(100, character.stress + (status === 'dead' ? 0 : combat.status === 'victory' ? 8 : 20)),
      fame: character.fame + (combat.status === 'victory' ? unit.kills * 2 + 1 : 0),
      injuryRecords: records.slice(-14),
      injuries: injuries.slice(-10),
      memories: [...character.memories, combatMemory(state, character, combat, memoryText, combat.status !== 'victory' || wasDown)].slice(-20),
    } as Character
  })

  const species = state.world.monsterSpecies.find((candidate) => candidate.id === combat.speciesId)
  const population = combat.populationId ? state.world.monsterPopulations.find((candidate) => candidate.id === combat.populationId) : undefined
  const remainingPopulation = population ? Math.max(0, population.size - deadEnemyCount) : undefined
  const bestiary = state.bestiary.map((entry) => entry.speciesId === combat.speciesId ? {
    ...entry,
    victories: entry.victories + (combat.status === 'victory' ? 1 : 0),
    kills: entry.kills + deadEnemyCount,
    deathsCaused: entry.deathsCaused + casualties.filter((id) => !expedition.casualties.includes(id)).length,
    knowledge: Math.min(100, entry.knowledge + 14 + deadEnemyCount * 2),
    discoveredWeakness: entry.discoveredWeakness || entry.knowledge + deadEnemyCount * 5 >= 35,
    notes: [...entry.notes, combat.status === 'victory' ? `Победа: ${deadEnemyCount} уничтожено.` : `Отряд отступил после ${combat.round - 1} раундов.`].slice(-8),
  } : entry)

  const world = {
    ...state.world,
    monsterPopulations: state.world.monsterPopulations
      .map((candidate) => candidate.id === population?.id ? { ...candidate, size: remainingPopulation! } : candidate)
      .filter((candidate) => candidate.size > 0),
    tiles: state.world.tiles.map((tile) => tile.id === combat.tileId && population && remainingPopulation === 0 ? { ...tile, monsterPopulationId: undefined, danger: Math.max(1, tile.danger - (species?.threat ?? 2) * 0.45) } : tile),
    sites: state.world.sites.map((site) => {
      if (site.id !== combat.siteId) return site
      return {
        ...site,
        state: combat.status === 'victory' ? (site.exploration >= 90 ? 'cleared' as const : 'surveyed' as const) : site.state,
        zones: site.zones.map((zone) => zone.id === combat.zoneId && combat.status === 'victory' ? { ...zone, secured: true } : zone),
      }
    }),
  }

  const victoryDiscovery = combat.status === 'victory' && combat.siteId && !expedition.discoveries.includes(combat.siteId)
  const updatedExpedition = {
    ...expedition,
    casualties,
    battles: expedition.battles + 1,
    medicine: Math.max(0, expedition.medicine - injuredIds.length * 2),
    morale: clamp(expedition.morale + (combat.status === 'victory' ? 8 : -15) - casualties.length * 5, 0, 100),
    status: combat.status === 'defeat' ? 'returning' as const : expedition.status,
    discoveries: victoryDiscovery ? [...expedition.discoveries, combat.siteId!] : expedition.discoveries,
    logs: [...expedition.logs, {
      day: state.day,
      title: combat.status === 'victory' ? `Победа: ${combat.title}` : combat.status === 'retreated' ? `Отступление: ${combat.title}` : `Разгром: ${combat.title}`,
      text: `${combat.round - 1} раундов. Уничтожено противников: ${deadEnemyCount}. Потери отряда: ${casualties.length}.`,
      type: combat.status === 'victory' ? 'combat' as const : 'injury' as const,
    }],
  }
  const legendaryVictory = combat.status === 'victory' && population?.legendary
  return {
    ...state,
    pendingCombat: undefined,
    characters,
    bestiary,
    world,
    expeditions: state.expeditions.map((candidate) => candidate.id === expedition.id ? updatedExpedition : candidate),
    chronicle: legendaryVictory ? [...state.chronicle, {
      id: `chronicle-legendary-${combat.id}`,
      day: state.day,
      year: state.year,
      title: `Пало легендарное чудовище: ${population?.legendaryName}`,
      text: `${expedition.name} уничтожила существо, которое годами влияло на дороги и поселения региона.`,
      category: 'world',
      importance: 5,
    }] : state.chronicle,
  }
}
