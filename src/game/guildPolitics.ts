import type { GameState, GuildDoctrine, GuildGeneration, GuildMemorial } from '../types/game'

function currentGeneration(state: GameState): GuildGeneration | undefined {
  return state.generations.find((entry) => !entry.endedYear) ?? state.generations.at(-1)
}

export function createGuildLegacy(state: Pick<GameState, 'characters' | 'year'>) {
  const generation: GuildGeneration = {
    id: 'generation-restoration',
    name: 'Поколение восстановления',
    startedYear: state.year,
    memberIds: state.characters.filter((entry) => entry.employed).map((entry) => entry.id),
    doctrineIds: [],
    definingEvents: ['Восстановление почти погибшей гильдии'],
  }
  return { doctrines: [] as GuildDoctrine[], generations: [generation], memorials: [] as GuildMemorial[] }
}

export function foundGuildDoctrine(state: GameState, founderId: string): GameState {
  const founder = state.characters.find((entry) => entry.id === founderId)
  const generation = currentGeneration(state)
  if (!founder || !generation || !founder.employed || founder.level < 4 || state.doctrines.some((entry) => entry.founderId === founderId)) return state
  const id = `doctrine-${founderId}-${state.year}`
  const strongestSkill = Object.entries(founder.skills).sort((a, b) => b[1] - a[1])[0][0]
  const doctrine: GuildDoctrine = {
    id,
    name: `Школа ${founder.familyName || founder.name.split(' ').at(-1)}`,
    founderId,
    generationId: generation.id,
    createdYear: state.year,
    createdDay: state.day,
    principle: founder.traits[0] ? `Действовать: ${founder.traits[0]}` : 'Проверять каждый маршрут',
    bonus: `+1 к передаче навыка «${strongestSkill}»`,
    weakness: founder.fear,
    support: 18 + founder.fame,
    graduateIds: [],
  }
  return {
    ...state,
    doctrines: [...state.doctrines, doctrine],
    generations: state.generations.map((entry) => entry.id === generation.id ? { ...entry, doctrineIds: [...entry.doctrineIds, id] } : entry),
    chronicle: [...state.chronicle, {
      id: `chronicle-${id}`,
      year: state.year,
      day: state.day,
      title: `${founder.name} основывает собственную школу`,
      text: `${doctrine.name} закрепляет новый полевой подход.`,
      category: 'guild',
      importance: 4,
    }],
  }
}

export function createGuildMemorial(state: GameState, characterId: string, type: GuildMemorial['type']): GameState {
  const character = state.characters.find((entry) => entry.id === characterId)
  const costs: Record<GuildMemorial['type'], number> = { portrait: 80, hall: 600, award: 240, school: 480, memorial: 320 }
  const cost = costs[type]
  if (!character || state.guild.treasury < cost || !['dead', 'retired'].includes(character.status) || state.memorials.some((entry) => entry.characterId === characterId && entry.type === type)) return state
  const label = type === 'hall' ? 'Зал' : type === 'award' ? 'Награда' : type === 'school' ? 'Школа' : type === 'portrait' ? 'Портрет' : 'Мемориал'
  const memorial: GuildMemorial = {
    id: `memorial-${type}-${characterId}`,
    characterId,
    type,
    name: `${label} имени ${character.name}`,
    createdYear: state.year,
    createdDay: state.day,
    effect: type === 'hall' ? '+3 к устойчивости' : '+1 к памяти гильдии',
  }
  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury - cost,
      stability: Math.min(100, state.guild.stability + (type === 'hall' ? 3 : 1)),
      institutionalMemory: state.guild.institutionalMemory + (type === 'school' ? 2 : 1),
    },
    memorials: [...state.memorials, memorial],
    chronicle: [...state.chronicle, {
      id: `chronicle-${memorial.id}`,
      year: state.year,
      day: state.day,
      title: memorial.name,
      text: 'Имя исследователя закреплено в истории гильдии.',
      category: 'guild',
      importance: 3,
    }],
  }
}

function tickGeneration(state: GameState): GameState {
  const current = currentGeneration(state)
  if (!current || state.year - current.startedYear < 12) return state
  const nextId = `generation-${state.year}`
  const title = state.wars.some((entry) => entry.status === 'active') ? 'Поколение большой войны' : 'Новое поколение'
  return {
    ...state,
    generations: [
      ...state.generations.map((entry) => entry.id === current.id ? { ...entry, endedYear: state.year } : entry),
      {
        id: nextId,
        name: title,
        startedYear: state.year,
        memberIds: state.characters.filter((entry) => entry.employed && entry.age <= 32).map((entry) => entry.id),
        doctrineIds: [],
        definingEvents: [title],
      },
    ],
    characters: state.characters.map((entry) => entry.employed && entry.age <= 32 ? { ...entry, generationId: nextId } : entry),
    chronicle: [...state.chronicle, {
      id: `chronicle-${nextId}`,
      year: state.year,
      day: state.day,
      title,
      text: 'Внутри гильдии сформировалось новое поколение исследователей.',
      category: 'guild',
      importance: 4,
    }],
  }
}

export function guildLegacyDayTick(state: GameState): GameState {
  return state.day === 1 ? tickGeneration(state) : state
}
