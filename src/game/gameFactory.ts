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
import type { Character, GameState, GuildData, Opportunity, WorldData } from '../types/game'
import { RNG } from './rng'
import { generateWorld } from './worldGenerator'

function skillProfile(profession: string, rng: RNG): Character['skills'] {
  const base = {
    combat: rng.int(1, 4),
    survival: rng.int(1, 4),
    scouting: rng.int(1, 4),
    medicine: rng.int(0, 3),
    arcana: rng.int(0, 3),
    history: rng.int(0, 3),
    cartography: rng.int(0, 3),
    diplomacy: rng.int(0, 3),
    leadership: rng.int(0, 3),
  }
  const boosts: Record<string, (keyof typeof base)[]> = {
    Воин: ['combat', 'leadership'],
    Следопыт: ['survival', 'scouting', 'cartography'],
    Маг: ['arcana', 'history'],
    Жрец: ['medicine', 'diplomacy', 'arcana'],
    Плут: ['scouting', 'combat'],
    Охотник: ['combat', 'survival', 'scouting'],
    Картограф: ['cartography', 'history', 'survival'],
    Археолог: ['history', 'cartography'],
    Лекарь: ['medicine', 'survival'],
    Переводчик: ['diplomacy', 'history'],
    'Искатель реликвий': ['history', 'arcana', 'scouting'],
  }
  for (const key of boosts[profession] ?? []) base[key] = Math.min(10, base[key] + rng.int(2, 4))
  return base
}

function createCharacters(seed: string, count: number): Character[] {
  const rng = new RNG(`${seed}:characters`)
  const characters: Character[] = []
  for (let index = 0; index < count; index += 1) {
    const profession = rng.pick(PROFESSIONS)
    const level = rng.int(1, 4)
    characters.push({
      id: `character-${index + 1}`,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      portraitSeed: rng.int(1, 999999),
      age: rng.int(18, 56),
      ancestry: rng.pick(ANCESTRIES),
      culture: rng.pick(CULTURES),
      profession,
      level,
      status: index < 8 && rng.bool(0.12) ? 'recovering' : 'available',
      employed: index < 8,
      salary: 12 + level * 6 + rng.int(0, 9),
      health: rng.int(72, 100),
      fatigue: rng.int(0, 22),
      stress: rng.int(0, 20),
      loyalty: rng.int(38, 72),
      fame: rng.int(0, 14),
      traits: rng.shuffle(TRAITS).slice(0, 3),
      ambition: rng.pick(AMBITIONS),
      fear: rng.pick(FEARS),
      stats: {
        strength: rng.int(2, 8),
        agility: rng.int(2, 8),
        endurance: rng.int(2, 8),
        intellect: rng.int(2, 8),
        will: rng.int(2, 8),
        presence: rng.int(2, 8),
      },
      skills: skillProfile(profession, rng),
      injuries: rng.bool(0.12) ? [rng.pick(['старый перелом', 'повреждённое плечо', 'хроническая боль', 'магический ожог'])] : [],
      relationships: {},
      memories: [],
      expeditions: rng.int(0, 3),
      discoveries: rng.int(0, 1),
    })
  }

  for (const character of characters) {
    const others = rng.shuffle(characters.filter((candidate) => candidate.id !== character.id)).slice(0, 2)
    for (const other of others) character.relationships[other.id] = rng.int(-35, 55)
  }
  return characters
}

function createGuild(): GuildData {
  return {
    name: 'Последняя гильдия',
    rank: 1,
    treasury: 820,
    debt: 2400,
    debtInterest: 0.03,
    reputation: 11,
    scientificAuthority: 6,
    adventurerPrestige: 9,
    politicalInfluence: 2,
    stability: 34,
    supplies: 150,
    medicine: 34,
    artifacts: 0,
    knowledge: {
      geography: 12,
      history: 8,
      monsters: 6,
      magic: 5,
      cultures: 4,
    },
    rooms: [
      { id: 'hall', name: 'Старый зал', level: 1, condition: 58, capacity: 12, maintenance: 7, description: 'Здесь принимают заказы и новых людей.', effect: '+1 доступный контракт', upgradeCost: 520 },
      { id: 'archive', name: 'Повреждённый архив', level: 1, condition: 43, capacity: 40, maintenance: 5, description: 'Карты и журналы пережили пожар и годы сырости.', effect: '+5% качество сведений', upgradeCost: 680 },
      { id: 'storehouse', name: 'Тесный склад', level: 1, condition: 64, capacity: 200, maintenance: 4, description: 'Припасы хранятся рядом с протекающей стеной.', effect: 'лимит 200 припасов', upgradeCost: 440 },
      { id: 'infirmary', name: 'Комната лекаря', level: 1, condition: 51, capacity: 3, maintenance: 8, description: 'Три койки и минимальный набор инструментов.', effect: '+10% восстановление', upgradeCost: 760 },
      { id: 'quarters', name: 'Жилые комнаты', level: 1, condition: 55, capacity: 8, maintenance: 5, description: 'Холодные комнаты для постоянного состава.', effect: '+3 лояльность персонала', upgradeCost: 490 },
    ],
    maxActiveExpeditions: 1,
    daysSincePayment: 0,
  }
}

function opportunityTargets(world: WorldData): string[] {
  const startSettlement = world.settlements.find((settlement) => settlement.id === world.startSettlementId)!
  const startTile = world.tiles.find((tile) => tile.id === startSettlement.tileId)!
  return world.tiles
    .filter((tile) => tile.biome !== 'ocean' && tile.id !== startTile.id)
    .sort((a, b) => Math.hypot(a.x - startTile.x, a.y - startTile.y) - Math.hypot(b.x - startTile.x, b.y - startTile.y))
    .slice(25, 180)
    .map((tile) => tile.id)
}

function createOpportunities(seed: string, world: WorldData, day: number): Opportunity[] {
  const rng = new RNG(`${seed}:opportunities:${day}`)
  const targets = opportunityTargets(world)
  const templates = [
    ['Пропавшие лесорубы', 'спасение', 'Найти людей, не вернувшихся из старого леса.', 'староста'],
    ['Старая дорога', 'картография', 'Проверить сведения о заброшенном пути через холмы.', 'торговый дом'],
    ['Шёпот под камнями', 'руины', 'Осмотреть найденный вход в подземный комплекс.', 'местный священник'],
    ['Следы крупного зверя', 'охота', 'Определить вид существа и найти его логово.', 'охотники'],
    ['Сломанная печать', 'артефакт', 'Доставить из руин предмет с неизвестными рунами.', 'учёный'],
    ['Пограничная карта', 'разведка', 'Уточнить положение застав и старых переправ.', 'городской совет'],
  ] as const

  return rng.shuffle(templates).slice(0, 5).map((template, index) => ({
    id: `opportunity-${day}-${index}`,
    title: template[0],
    type: template[1],
    description: template[2],
    source: template[3],
    targetTileId: rng.pick(targets),
    reward: rng.int(180, 620),
    deadlineDay: day + rng.int(18, 55),
    dangerEstimate: rng.int(2, 7),
    knowledgeRequirement: rng.int(1, 5),
    accepted: false,
  }))
}

export function createNewGame(seedInput?: string): GameState {
  const seed = seedInput?.trim() || `guild-${Date.now().toString(36)}`
  const world = generateWorld(seed)
  return {
    version: 2,
    seed,
    day: 1,
    year: 912,
    season: 0,
    guild: createGuild(),
    world,
    characters: createCharacters(seed, 28),
    expeditions: [],
    opportunities: createOpportunities(seed, world, 1),
    chronicle: [
      {
        id: 'chronicle-start',
        day: 1,
        year: 912,
        title: 'Последняя гильдия открывает двери',
        text: 'После нескольких лет упадка старое здание снова принимает контракты. В казне почти ничего, кредиторы ждут платёж, но архив ещё не погиб.',
        category: 'guild',
        importance: 5,
      },
    ],
  }
}

export { createOpportunities }
