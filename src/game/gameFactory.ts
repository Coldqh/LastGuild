import {
  AMBITIONS,
  ANCESTRIES,
  CULTURES,
  FEARS,
  FIRST_NAMES,
  LAST_NAMES,
  PROFESSIONS,
  TRAITS,
} from '../data/content'
import type {
  Character,
  ExpeditionRiskProfile,
  GameState,
  GuildData,
  Opportunity,
  WorldData,
  WorldGenerationSettings,
} from '../types/game'
import { RNG } from './rng'
import { generateWorld } from './worldGenerator'
import { DEFAULT_WORLD_SETTINGS, DIFFICULTY_RULES } from './worldSettings'
import { createStrategicLayer } from './strategy'

function skillProfile(profession: string, rng: RNG): Character['skills'] {
  const base = {
    combat: rng.int(1, 4), survival: rng.int(1, 4), scouting: rng.int(1, 4),
    medicine: rng.int(0, 3), arcana: rng.int(0, 3), history: rng.int(0, 3),
    cartography: rng.int(0, 3), diplomacy: rng.int(0, 3), leadership: rng.int(0, 3),
  }
  const boosts: Record<string, (keyof typeof base)[]> = {
    Воин: ['combat', 'leadership'], Следопыт: ['survival', 'scouting', 'cartography'],
    Маг: ['arcana', 'history'], Жрец: ['medicine', 'diplomacy', 'arcana'],
    Плут: ['scouting', 'combat'], Охотник: ['combat', 'survival', 'scouting'],
    Картограф: ['cartography', 'history', 'survival'], Археолог: ['history', 'cartography'],
    Лекарь: ['medicine', 'survival'], Переводчик: ['diplomacy', 'history'],
    'Искатель реликвий': ['history', 'arcana', 'scouting'],
  }
  for (const key of boosts[profession] ?? []) base[key] = Math.min(10, base[key] + rng.int(2, 4))
  return base
}

function combatBehavior(profession: string, traits: string[]): Character['combatBehavior'] {
  const map: Record<string, Character['combatBehavior']> = {
    'Воин': { role: 'frontline', preferredRange: 1, aggression: 74, protectWeak: true, retreatAt: 24, conserveAbilities: false },
    'Следопыт': { role: 'ranged', preferredRange: 4, aggression: 55, protectWeak: false, retreatAt: 34, conserveAbilities: true },
    'Маг': { role: 'controller', preferredRange: 5, aggression: 48, protectWeak: false, retreatAt: 42, conserveAbilities: true },
    'Жрец': { role: 'support', preferredRange: 3, aggression: 35, protectWeak: true, retreatAt: 46, conserveAbilities: true },
    'Плут': { role: 'skirmisher', preferredRange: 1, aggression: 68, protectWeak: false, retreatAt: 30, conserveAbilities: false },
    'Охотник': { role: 'ranged', preferredRange: 5, aggression: 64, protectWeak: false, retreatAt: 32, conserveAbilities: true },
    'Лекарь': { role: 'support', preferredRange: 4, aggression: 22, protectWeak: true, retreatAt: 52, conserveAbilities: true },
  }
  const base = { ...(map[profession] ?? { role: 'skirmisher' as const, preferredRange: 2, aggression: 50, protectWeak: false, retreatAt: 38, conserveAbilities: true }) }
  if (traits.includes('смелый')) { base.aggression += 12; base.retreatAt -= 8 }
  if (traits.includes('осторожный')) { base.aggression -= 10; base.retreatAt += 8 }
  if (traits.includes('надёжный')) base.protectWeak = true
  if (traits.includes('гордый')) base.retreatAt -= 6
  return base
}

function createCharacters(seed: string, count: number, world: WorldData): Character[] {
  const rng = new RNG(`${seed}:characters`)
  const characters: Character[] = []
  const settlements = world.settlements.length ? world.settlements : [{ id: world.startSettlementId, name: 'неизвестное поселение' } as any]
  for (let index = 0; index < count; index += 1) {
    const profession = rng.pick(PROFESSIONS)
    const level = index === 0 ? 4 : rng.int(1, 4)
    const home = rng.pick(settlements)
    const oldInjury = rng.bool(0.12) ? rng.pick(['старый перелом', 'повреждённое плечо', 'хроническая боль', 'магический ожог']) : undefined
    const traits = rng.shuffle(TRAITS).slice(0, 3)
    characters.push({
      id: `character-${index + 1}`,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      portraitSeed: rng.int(1, 999999), age: index === 0 ? rng.int(49, 63) : rng.int(18, 56), ancestry: rng.pick(ANCESTRIES), culture: rng.pick(CULTURES), profession,
      origin: `${home.name}; ${rng.pick(['семья ремесленников', 'бывший солдатский дом', 'бедная улица', 'учёная семья', 'пограничное поселение', 'храмовое воспитание'])}`,
      homeSettlementId: home.id,
      level, experience: level * 35 + rng.int(0, 45), careerStage: level >= 4 ? 'veteran' : level >= 2 ? 'field' : 'recruit',
      status: index < 8 && rng.bool(0.12) ? 'recovering' : 'available', employed: index < 8,
      salary: 12 + level * 6 + rng.int(0, 9), health: rng.int(72, 100), fatigue: rng.int(0, 22), stress: rng.int(0, 20),
      loyalty: rng.int(38, 72), fame: rng.int(0, 14), traits, ambition: rng.pick(AMBITIONS), fear: rng.pick(FEARS),
      stats: { strength: rng.int(2, 8), agility: rng.int(2, 8), endurance: rng.int(2, 8), intellect: rng.int(2, 8), will: rng.int(2, 8), presence: rng.int(2, 8) },
      skills: skillProfile(profession, rng),
      injuries: oldInjury ? [oldInjury] : [],
      injuryRecords: oldInjury ? [{ id: `injury-start-${index}`, name: oldInjury, severity: 2, permanent: true, recoveryDays: 0, effect: '−1 к отдельным полевым проверкам', treated: true }] : [],
      relationships: {}, memories: index === 0 ? [{ id: 'memory-last-expedition', title: 'Гибель старого состава', description: 'Пережил последнюю катастрофическую экспедицию прежнего руководителя и вернулся один.', intensity: 82, valence: 'negative', type: 'expedition', year: 911, day: 317, relatedCharacterIds: [] }] : [], expeditions: index === 0 ? 7 : rng.int(0, 3), discoveries: rng.int(0, 1), combatBehavior: combatBehavior(profession, traits), apprenticeIds: [],
    })
  }
  for (const character of characters) {
    const others = rng.shuffle(characters.filter((candidate) => candidate.id !== character.id)).slice(0, 2)
    for (const other of others) character.relationships[other.id] = rng.int(-35, 55)
  }
  return characters
}

function createGuild(settings: WorldGenerationSettings): GuildData {
  const rules = DIFFICULTY_RULES[settings.difficulty]
  return {
    name: 'Последняя гильдия', rank: 1, treasury: rules.startingTreasury, debt: rules.startingDebt, debtInterest: 0.03,
    reputation: 11, scientificAuthority: 6, adventurerPrestige: 9, politicalInfluence: 2, stability: settings.difficulty === 'brutal' ? 26 : 34,
    supplies: settings.difficulty === 'story' ? 190 : settings.difficulty === 'brutal' ? 115 : 150,
    medicine: settings.difficulty === 'story' ? 45 : settings.difficulty === 'brutal' ? 25 : 34,
    artifacts: 0,
    knowledge: { geography: 12, history: 8, monsters: 6, magic: settings.magicLevel === 'wild' ? 9 : 5, cultures: 4 },
    rooms: [
      { id: 'hall', name: 'Старый зал', level: 1, condition: 58, capacity: 12, maintenance: 7, description: 'Здесь принимают заказы и новых людей.', effect: '+1 доступный контракт', upgradeCost: 520 },
      { id: 'archive', name: 'Повреждённый архив', level: 1, condition: 43, capacity: 40, maintenance: 5, description: 'Карты и журналы пережили пожар и годы сырости.', effect: '+5% качество сведений', upgradeCost: 680 },
      { id: 'storehouse', name: 'Тесный склад', level: 1, condition: 64, capacity: 200, maintenance: 4, description: 'Припасы хранятся рядом с протекающей стеной.', effect: 'лимит 200 припасов', upgradeCost: 440 },
      { id: 'infirmary', name: 'Комната лекаря', level: 1, condition: 51, capacity: 3, maintenance: 8, description: 'Три койки и минимальный набор инструментов.', effect: '+10% восстановление', upgradeCost: 760 },
      { id: 'quarters', name: 'Жилые комнаты', level: 1, condition: 55, capacity: 8, maintenance: 5, description: 'Холодные комнаты для постоянного состава.', effect: '+3 лояльность персонала', upgradeCost: 490 },
    ],
    positions: [
      { id: 'expedition_master', name: 'Мастер экспедиций', description: 'Отвечает за составы, маршруты и дисциплину.', effect: '+5 к слаженности новых отрядов' },
      { id: 'chief_archivist', name: 'Главный архивист', description: 'Проверяет отчёты и качество доказательств.', effect: '+10 к качеству открытий' },
      { id: 'quartermaster', name: 'Квартмейстер', description: 'Контролирует склад и закупки.', effect: '−8% месячных расходов' },
      { id: 'chief_healer', name: 'Главный лекарь', description: 'Руководит лечением и реабилитацией.', effect: '+35% скорость восстановления' },
      { id: 'mentor', name: 'Наставник новичков', description: 'Передаёт опыт молодому составу.', effect: '+20% опыта после экспедиций' },
      { id: 'diplomat', name: 'Дипломат гильдии', description: 'Работает с властями и заказчиками.', effect: '+2 репутации при публикации' },
    ],
    maxActiveExpeditions: 1, daysSincePayment: 0, leaderId: undefined, charterInfluence: 0,
  }
}

function opportunityTargets(world: WorldData): string[] {
  const startSettlement = world.settlements.find((settlement) => settlement.id === world.startSettlementId)!
  const startTile = world.tiles.find((tile) => tile.id === startSettlement.tileId)!
  return world.tiles
    .filter((tile) => tile.biome !== 'ocean' && tile.id !== startTile.id)
    .sort((a, b) => Math.hypot(a.x - startTile.x, a.y - startTile.y) - Math.hypot(b.x - startTile.x, b.y - startTile.y))
    .slice(Math.min(18, Math.floor(world.tiles.length * 0.03)), Math.min(world.tiles.length, 320))
    .map((tile) => tile.id)
}

function riskFor(world: WorldData, targetTileId: string, type: string, rng: RNG): ExpeditionRiskProfile {
  const tile = world.tiles.find((candidate) => candidate.id === targetTileId)
  const realm = world.realms.find((candidate) => candidate.id === tile?.stateId)
  const base = tile?.danger ?? 4
  return {
    route: Math.min(10, Math.max(1, Math.round(base * 0.7 + tile!.travelCost + rng.float(-1, 1)))),
    combat: Math.min(10, Math.max(1, Math.round(base + (type === 'охота' ? 2 : 0) + rng.float(-1, 1)))),
    climate: Math.min(10, Math.max(1, Math.round((tile?.biome === 'tundra' || tile?.biome === 'desert' || tile?.biome === 'swamp' ? 6 : 3) + rng.float(-1, 1)))),
    disease: Math.min(10, Math.max(1, Math.round((tile?.biome === 'swamp' || tile?.biome === 'ancient_forest' ? 6 : 2) + rng.float(-1, 1)))),
    politics: Math.min(10, Math.max(1, Math.round((realm?.stability ? (100 - realm.stability) / 13 : 3) + rng.float(-1, 1)))),
    magic: Math.min(10, Math.max(1, Math.round((tile?.magic ?? 0.4) * 9 + (type === 'артефакт' || type === 'руины' ? 1 : 0)))),
  }
}

const opportunityTemplates = [
  ['Пропавшие лесорубы', 'спасение', 'Найти людей, не вернувшихся из старого леса.', 'староста', ['Следопыт', 'Лекарь']],
  ['Старая дорога', 'картография', 'Проверить сведения о заброшенном пути через холмы.', 'торговый дом', ['Картограф', 'Следопыт']],
  ['Шёпот под камнями', 'руины', 'Осмотреть найденный вход в подземный комплекс.', 'местный священник', ['Археолог', 'Воин']],
  ['Следы крупного зверя', 'охота', 'Определить вид существа и найти его логово.', 'охотники', ['Охотник', 'Лекарь']],
  ['Сломанная печать', 'артефакт', 'Доставить из руин предмет с неизвестными рунами.', 'учёный', ['Маг', 'Искатель реликвий']],
  ['Пограничная карта', 'разведка', 'Уточнить положение застав и старых переправ.', 'городской совет', ['Следопыт', 'Переводчик']],
  ['Чужой посол', 'дипломатия', 'Добраться до изолированного поселения и договориться о проходе.', 'канцелярия князя', ['Переводчик', 'Жрец']],
  ['Чёрная вода', 'исследование', 'Взять образцы из заражённого притока и найти источник.', 'лекарская коллегия', ['Лекарь', 'Маг']],
  ['След старой экспедиции', 'поиск', 'Проверить найденный дневник и установить судьбу пропавшего отряда.', 'семьи погибших', ['Картограф', 'Археолог']],
] as const

export function createOpportunities(seed: string, world: WorldData, day: number, settings?: WorldGenerationSettings): Opportunity[] {
  const activeSettings = settings ?? DEFAULT_WORLD_SETTINGS
  const rng = new RNG(`${seed}:opportunities:${day}`)
  const targets = opportunityTargets(world)
  const rules = DIFFICULTY_RULES[activeSettings.difficulty]
  return rng.shuffle(opportunityTemplates).slice(0, 6).map((template, index) => {
    const targetTileId = rng.pick(targets)
    const riskProfile = riskFor(world, targetTileId, template[1], rng)
    const dangerEstimate = Math.round(Object.values(riskProfile).reduce((sum, value) => sum + value, 0) / 6)
    return {
      id: `opportunity-${day}-${index}`, title: template[0], type: template[1], description: template[2], source: template[3], targetTileId,
      reward: Math.round(rng.int(180, 660) * rules.rewards), deadlineDay: day + rng.int(18, 55), dangerEstimate,
      knowledgeRequirement: rng.int(1, 5), accepted: false, requiredRoles: [...template[4]], riskProfile,
    }
  })
}

export function createNewGame(seedInput?: string, requestedSettings?: WorldGenerationSettings): GameState {
  const seed = seedInput?.trim() || `guild-${Date.now().toString(36)}`
  const settings = { ...DEFAULT_WORLD_SETTINGS, ...(requestedSettings ?? {}) }
  const world = generateWorld(seed, settings)
  const characterCount = settings.mapSize === 'vast' ? 36 : settings.mapSize === 'compact' ? 24 : 30
  const characters = createCharacters(seed, characterCount, world)
  const guild = createGuild(settings)
  const strategic = createStrategicLayer(seed, world, characters)
  guild.leaderId = strategic.leaderId
  return {
    version: 6, seed, settings, day: 1, year: 912, season: 0,
    guild, world, characters, expeditions: [],
    opportunities: createOpportunities(seed, world, 1, settings), pendingDecision: undefined, pendingDebrief: undefined, pendingCombat: undefined, pendingDungeon: undefined, discoveries: [], consequences: [], bestiary: [],
    politicalFactions: strategic.politicalFactions, rivalGuilds: strategic.rivalGuilds, rivalExpeditions: [], branches: [], crises: strategic.crises, mentorships: [],
    chronicle: [{
      id: 'chronicle-collapse', day: 317, year: 911, title: 'Последняя экспедиция прежнего главы', text: 'Отряд ушёл к северным руинам и не вернулся. Казна опустела, кредиторы забрали часть имущества, а имя гильдии стало предупреждением.', category: 'guild', importance: 5,
    }, {
      id: 'chronicle-start', day: 1, year: 912, title: 'Последняя гильдия открывает двери',
      text: `После нескольких лет упадка старое здание снова принимает контракты. Мир создан в режиме «${settings.preset}», государств: ${world.realms.length}, известных руин: ${world.sites.filter((site) => site.state === 'rumored').length}.`,
      category: 'guild', importance: 5,
    }],
  }
}
