import type {
  AcademyProgram,
  AcademyProgramId,
  CouncilProposal,
  CouncilVoteChoice,
  GameState,
  GuildAcademy,
  GuildCharter,
  GuildCouncilSeat,
  GuildDoctrine,
  GuildFactionType,
  GuildGeneration,
  GuildInternalFaction,
  GuildMemorial,
  GuildPositionId,
} from '../types/game'
import { RNG } from './rng'

export const ACADEMY_PROGRAMS: AcademyProgram[] = [
  { id: 'scout', name: 'Школа следопытов', profession: 'Следопыт', durationMonths: 12, tuition: 70, primarySkill: 'scouting', secondarySkill: 'survival', description: 'Маршруты, разведка, лагерь и работа в неизвестной местности.' },
  { id: 'warrior', name: 'Полевая стража', profession: 'Воин', durationMonths: 10, tuition: 65, primarySkill: 'combat', secondarySkill: 'leadership', description: 'Защита специалистов, дисциплина и организованный отход.' },
  { id: 'healer', name: 'Полевая медицина', profession: 'Лекарь', durationMonths: 14, tuition: 85, primarySkill: 'medicine', secondarySkill: 'survival', description: 'Травмы, болезни, карантин и эвакуация раненых.' },
  { id: 'cartographer', name: 'Картографическая школа', profession: 'Картограф', durationMonths: 13, tuition: 80, primarySkill: 'cartography', secondarySkill: 'history', description: 'Точные карты, маршруты, высоты и проверка старых атласов.' },
  { id: 'archaeologist', name: 'Археологическая школа', profession: 'Археолог', durationMonths: 16, tuition: 95, primarySkill: 'history', secondarySkill: 'cartography', description: 'Слои руин, документы, сохранение находок и древние культуры.' },
  { id: 'diplomat', name: 'Дипломатический класс', profession: 'Переводчик', durationMonths: 12, tuition: 90, primarySkill: 'diplomacy', secondarySkill: 'leadership', description: 'Языки, договоры, местные законы и политические риски.' },
  { id: 'arcanist', name: 'Магические исследования', profession: 'Маг', durationMonths: 18, tuition: 120, primarySkill: 'arcana', secondarySkill: 'history', description: 'Аномалии, ритуалы, артефакты и безопасная работа с магией.' },
  { id: 'monster_hunter', name: 'Школа охотников', profession: 'Охотник', durationMonths: 14, tuition: 90, primarySkill: 'combat', secondarySkill: 'scouting', description: 'Поведение чудовищ, логова, следы, слабости и трофеи.' },
]

export const DEFAULT_CHARTER: GuildCharter = {
  leadershipSelection: 'appointed',
  artifactRights: 'guild',
  missingExpeditions: 'case_by_case',
  archiveAccess: 'ranked',
  familyCompensation: 'standard',
  branchAuthority: 'limited',
}

const FACTION_DATA: Record<GuildFactionType, { name: string; agenda: string; demand: string }> = {
  veterans: { name: 'Старые экспедиционеры', agenda: 'Сохранять полевые традиции и вес ветеранов.', demand: 'Не отправлять слабые отряды без опытного лидера.' },
  scholars: { name: 'Учёное крыло', agenda: 'Публиковать проверенные знания и развивать архив.', demand: 'Увеличить расходы на академию и исследования.' },
  field: { name: 'Полевые команды', agenda: 'Получать больше свободы и долю от находок.', demand: 'Упростить согласование экспедиций.' },
  commerce: { name: 'Торговое крыло', agenda: 'Сделать гильдию финансово устойчивой.', demand: 'Продавать часть артефактов и карт.' },
  secrecy: { name: 'Хранители тайн', agenda: 'Ограничивать опасные публикации и доступ к архиву.', demand: 'Закрыть спорные находки от внешних фракций.' },
  reformers: { name: 'Молодые реформаторы', agenda: 'Продвигать выпускников и новые методы.', demand: 'Дать молодым места в совете.' },
  branches: { name: 'Представители филиалов', agenda: 'Расширять автономию региональных штабов.', demand: 'Оставлять филиалам большую долю дохода.' },
}

function scoreCharacter(state: GameState, characterId?: string): number {
  const character = state.characters.find((entry) => entry.id === characterId)
  if (!character) return 0
  return character.skills.leadership * 10 + character.fame + character.loyalty / 2 + character.expeditions * 2
}

function holderForPosition(state: GameState, id: GuildPositionId): string | undefined {
  return state.guild.positions.find((entry) => entry.id === id)?.holderId
}

export function refreshGuildCouncil(state: GameState): GuildCouncilSeat[] {
  const employed = state.characters.filter((entry) => entry.employed && !entry.assignedBranchId && !['dead', 'missing'].includes(entry.status))
  const veteran = employed.filter((entry) => ['veteran', 'leader', 'mentor', 'legend'].includes(entry.careerStage)).sort((a, b) => scoreCharacter(state, b.id) - scoreCharacter(state, a.id))[0]
  const branchLeader = state.branches.map((branch) => state.characters.find((entry) => entry.id === branch.leaderId)).filter(Boolean).sort((a, b) => scoreCharacter(state, b!.id) - scoreCharacter(state, a!.id))[0]
  const academyHead = holderForPosition(state, 'mentor') ?? employed.filter((entry) => ['mentor', 'legend'].includes(entry.careerStage)).sort((a, b) => scoreCharacter(state, b.id) - scoreCharacter(state, a.id))[0]?.id
  return [
    { id: 'council-leader', name: 'Глава гильдии', holderId: state.guild.leaderId, influence: 3, source: 'leader' },
    { id: 'council-expeditions', name: 'Мастер экспедиций', holderId: holderForPosition(state, 'expedition_master'), influence: 2, source: 'position' },
    { id: 'council-archive', name: 'Главный архивист', holderId: holderForPosition(state, 'chief_archivist'), influence: 2, source: 'position' },
    { id: 'council-medicine', name: 'Главный лекарь', holderId: holderForPosition(state, 'chief_healer'), influence: 1, source: 'position' },
    { id: 'council-veterans', name: 'Представитель ветеранов', holderId: veteran?.id, influence: 2, source: 'veterans' },
    { id: 'council-branches', name: 'Представитель филиалов', holderId: branchLeader?.id, influence: state.branches.length ? 2 : 0, source: 'branches' },
    { id: 'council-academy', name: 'Глава академии', holderId: academyHead, influence: state.academy.level > 0 ? 1 : 0, source: 'academy' },
  ]
}

function factionMembers(state: GameState, type: GuildFactionType): string[] {
  const people = state.characters.filter((entry) => entry.employed && !['dead', 'missing'].includes(entry.status))
  if (type === 'veterans') return people.filter((entry) => entry.expeditions >= 5 || ['veteran', 'mentor', 'legend'].includes(entry.careerStage)).map((entry) => entry.id)
  if (type === 'scholars') return people.filter((entry) => ['Картограф', 'Археолог', 'Маг', 'Переводчик', 'Искатель реликвий'].includes(entry.profession)).map((entry) => entry.id)
  if (type === 'field') return people.filter((entry) => ['Воин', 'Следопыт', 'Плут', 'Охотник', 'Жрец', 'Лекарь'].includes(entry.profession)).map((entry) => entry.id)
  if (type === 'commerce') return people.filter((entry) => entry.skills.diplomacy >= 5 || entry.id === holderForPosition(state, 'quartermaster') || entry.id === holderForPosition(state, 'diplomat')).map((entry) => entry.id)
  if (type === 'secrecy') return people.filter((entry) => entry.traits.some((trait) => ['скрытный', 'осторожный', 'циничный', 'набожный'].includes(trait))).map((entry) => entry.id)
  if (type === 'reformers') return people.filter((entry) => entry.age <= 30 || entry.academyGraduate || entry.careerStage === 'recruit').map((entry) => entry.id)
  return people.filter((entry) => entry.assignedBranchId).map((entry) => entry.id)
}

export function refreshGuildFactions(state: GameState): GuildInternalFaction[] {
  const types: GuildFactionType[] = ['veterans', 'scholars', 'field', 'commerce', 'secrecy', 'reformers', 'branches']
  return types.map((type) => {
    const existing = state.guildFactions?.find((entry) => entry.type === type)
    const memberIds = factionMembers(state, type)
    const leaderId = memberIds.sort((a, b) => scoreCharacter(state, b) - scoreCharacter(state, a))[0]
    const data = FACTION_DATA[type]
    return {
      id: existing?.id ?? `guild-faction-${type}`,
      type,
      name: data.name,
      leaderId,
      memberIds,
      influence: Math.max(0, Math.min(100, (existing?.influence ?? 18) + Math.round(memberIds.length * 1.8))),
      loyalty: existing?.loyalty ?? 58,
      agenda: data.agenda,
      demand: data.demand,
      relationToLeader: existing?.relationToLeader ?? 0,
    }
  }).filter((entry) => entry.memberIds.length > 0 || entry.type === 'reformers')
}

export function createGuildInstitutions(seed: string, state: Pick<GameState, 'characters' | 'guild' | 'year' | 'day' | 'branches'>) {
  const academy: GuildAcademy = { level: 1, seats: 4, reputation: 4, monthlyCost: 24, programs: ACADEMY_PROGRAMS, enrollments: [] }
  const generation: GuildGeneration = {
    id: 'generation-restoration', name: 'Поколение восстановления', startedYear: state.year,
    memberIds: state.characters.filter((entry) => entry.employed).map((entry) => entry.id), doctrineIds: [],
    definingEvents: ['Восстановление почти погибшей гильдии'],
  }
  const base = { ...state, academy, doctrines: [] as GuildDoctrine[], generations: [generation], council: [] as GuildCouncilSeat[], councilProposals: [] as CouncilProposal[], guildFactions: [] as GuildInternalFaction[], charter: DEFAULT_CHARTER, memorials: [] as GuildMemorial[] } as GameState
  const rng = new RNG(`${seed}:guild-institutions:v07`)
  const factions = refreshGuildFactions(base).map((entry) => ({ ...entry, loyalty: Math.max(35, Math.min(78, entry.loyalty + rng.int(-8, 8))) }))
  const council = refreshGuildCouncil({ ...base, guildFactions: factions })
  return { academy, doctrines: [], generations: [generation], council, councilProposals: [], guildFactions: factions, charter: { ...DEFAULT_CHARTER }, memorials: [] }
}

function currentGeneration(state: GameState): GuildGeneration | undefined {
  return state.generations.find((entry) => !entry.endedYear) ?? state.generations.at(-1)
}

export function enrollAcademyStudent(state: GameState, characterId: string, programId: AcademyProgramId, mentorId?: string): GameState {
  const character = state.characters.find((entry) => entry.id === characterId)
  const program = state.academy.programs.find((entry) => entry.id === programId)
  const active = state.academy.enrollments.filter((entry) => ['training', 'ready'].includes(entry.status))
  if (!character || !program || character.employed || character.rivalGuildId || character.academyEnrollmentId || ['dead', 'missing', 'retired'].includes(character.status)) return state
  if (active.length >= state.academy.seats || state.guild.treasury < program.tuition) return state
  const mentor = state.characters.find((entry) => entry.id === mentorId && entry.employed && !['dead', 'missing'].includes(entry.status))
  const id = `academy-${state.year}-${state.day}-${character.id}`
  return {
    ...state,
    guild: { ...state.guild, treasury: state.guild.treasury - program.tuition },
    academy: { ...state.academy, enrollments: [...state.academy.enrollments, { id, characterId, programId, mentorId: mentor?.id, startedYear: state.year, startedDay: state.day, progress: 0, performance: 45 + Math.round(character.stats.intellect * 3), examsPassed: 0, status: 'training' }] },
    characters: state.characters.map((entry) => entry.id === character.id ? { ...entry, academyEnrollmentId: id } : entry),
    chronicle: [...state.chronicle, { id: `chronicle-${id}`, year: state.year, day: state.day, title: `${character.name} поступает в академию`, text: `Выбрана программа «${program.name}». Обучение оплачено из казны.`, category: 'character', importance: 2 }],
  }
}

export function assignAcademyMentor(state: GameState, enrollmentId: string, mentorId?: string): GameState {
  const mentor = state.characters.find((entry) => entry.id === mentorId)
  if (mentorId && (!mentor || !mentor.employed || ['dead', 'missing'].includes(mentor.status) || mentor.level < 3)) return state
  return { ...state, academy: { ...state.academy, enrollments: state.academy.enrollments.map((entry) => entry.id === enrollmentId ? { ...entry, mentorId } : entry) } }
}

export function holdAcademyExam(state: GameState, enrollmentId: string): GameState {
  const enrollment = state.academy.enrollments.find((entry) => entry.id === enrollmentId)
  if (!enrollment || enrollment.status !== 'training' || enrollment.progress < 45 || state.guild.treasury < 20) return state
  const student = state.characters.find((entry) => entry.id === enrollment.characterId)
  if (!student) return state
  const mentor = state.characters.find((entry) => entry.id === enrollment.mentorId)
  const rng = new RNG(`${state.seed}:academy-exam:${state.year}:${state.day}:${enrollment.id}:${enrollment.examsPassed}`)
  const score = enrollment.performance + student.stats.intellect * 3 + (mentor ? mentor.skills.leadership * 2 : 0) + rng.int(-18, 18)
  const passed = score >= 58
  const progress = Math.min(100, enrollment.progress + (passed ? 18 : 4))
  return {
    ...state,
    guild: { ...state.guild, treasury: state.guild.treasury - 20 },
    academy: { ...state.academy, enrollments: state.academy.enrollments.map((entry) => entry.id === enrollment.id ? { ...entry, examsPassed: entry.examsPassed + (passed ? 1 : 0), performance: Math.max(20, Math.min(100, entry.performance + (passed ? 5 : -6))), progress, status: progress >= 100 && passed ? 'ready' : 'training' } : entry) },
    chronicle: [...state.chronicle, { id: `chronicle-exam-${enrollment.id}-${state.day}`, year: state.year, day: state.day, title: passed ? `${student.name} сдаёт экзамен` : `${student.name} проваливает экзамен`, text: passed ? 'Ученик подтвердил готовность к следующему этапу.' : 'Знаний пока недостаточно. Обучение продолжается.', category: 'character', importance: 1 }],
  }
}

export function graduateAcademyStudent(state: GameState, enrollmentId: string): GameState {
  const enrollment = state.academy.enrollments.find((entry) => entry.id === enrollmentId)
  const program = state.academy.programs.find((entry) => entry.id === enrollment?.programId)
  const student = state.characters.find((entry) => entry.id === enrollment?.characterId)
  if (!enrollment || !program || !student || enrollment.status !== 'ready') return state
  const generation = currentGeneration(state)
  const skills = { ...student.skills, [program.primarySkill]: Math.min(10, student.skills[program.primarySkill] + 3), [program.secondarySkill]: Math.min(10, student.skills[program.secondarySkill] + 2) }
  return {
    ...state,
    guild: { ...state.guild, academyReputation: state.guild.academyReputation + 2, adventurerPrestige: state.guild.adventurerPrestige + 1, institutionalMemory: state.guild.institutionalMemory + 1 },
    academy: { ...state.academy, reputation: state.academy.reputation + 2, enrollments: state.academy.enrollments.map((entry) => entry.id === enrollment.id ? { ...entry, status: 'graduated' } : entry) },
    characters: state.characters.map((entry) => entry.id === student.id ? { ...entry, employed: true, academyGraduate: true, academyEnrollmentId: undefined, profession: program.profession, level: Math.max(2, entry.level), experience: entry.experience + 90, careerStage: 'field', loyalty: Math.max(62, entry.loyalty), salary: 18 + Math.max(2, entry.level) * 6, skills, generationId: generation?.id } : entry),
    generations: state.generations.map((entry) => entry.id === generation?.id ? { ...entry, memberIds: [...new Set([...entry.memberIds, student.id])] } : entry),
    chronicle: [...state.chronicle, { id: `chronicle-graduate-${student.id}-${state.day}`, year: state.year, day: state.day, title: `${student.name} выпускается из академии`, text: `Новая профессия: ${program.profession}. Выпускник подписывает контракт с гильдией.`, category: 'character', importance: 3 }],
  }
}

export function upgradeGuildAcademy(state: GameState): GameState {
  const cost = 650 + state.academy.level * 480
  if (state.guild.treasury < cost || state.academy.level >= 4) return state
  return { ...state, guild: { ...state.guild, treasury: state.guild.treasury - cost, stability: Math.min(100, state.guild.stability + 2) }, academy: { ...state.academy, level: state.academy.level + 1, seats: state.academy.seats + 3, monthlyCost: state.academy.monthlyCost + 18, reputation: state.academy.reputation + 5 } }
}

export function appointCouncilSeat(state: GameState, seatId: string, holderId?: string): GameState {
  const character = state.characters.find((entry) => entry.id === holderId)
  if (holderId && (!character || !character.employed || ['dead', 'missing'].includes(character.status))) return state
  return { ...state, council: state.council.map((entry) => entry.id === seatId ? { ...entry, holderId } : entry), characters: state.characters.map((entry) => entry.id === holderId ? { ...entry, councilInfluence: Math.min(100, entry.councilInfluence + 8), fame: entry.fame + 2 } : entry) }
}

function proposalTemplate(state: GameState, rng: RNG): Omit<CouncilProposal, 'id' | 'createdYear' | 'createdDay' | 'deadlineDay' | 'deadlineYear' | 'votes' | 'status' | 'supportScore'> {
  const templates = [
    { type: 'finance' as const, title: 'Сократить расходы на полевые отряды', description: 'Казначей требует снизить число дорогих подготовительных закупок.', cost: 0 },
    { type: 'rescue' as const, title: 'Учредить обязательный резерв спасения', description: 'Ветераны требуют держать деньги и припасы для пропавших экспедиций.', cost: 180 },
    { type: 'publication' as const, title: 'Открыть часть архивов учёным', description: 'Учёное крыло предлагает обменять секретность на авторитет.', cost: 60 },
    { type: 'charter' as const, title: 'Пересмотреть устав гильдии', description: 'Молодые сотрудники требуют закрепить их права в новом уставе.', cost: 80 },
    { type: 'branch' as const, title: 'Расширить полномочия филиалов', description: 'Региональные руководители хотят самостоятельно заключать малые контракты.', cost: 0 },
    { type: 'artifact' as const, title: 'Продать спорный артефакт', description: 'Торговое крыло предлагает пополнить казну за счёт музейных запасов.', cost: 0 },
  ]
  const possible = templates.filter((entry) => entry.type !== 'artifact' || state.guild.artifacts > 0)
  return rng.pick(possible)
}

function createProposal(state: GameState): CouncilProposal {
  const rng = new RNG(`${state.seed}:council-proposal:${state.year}:${state.day}`)
  const template = proposalTemplate(state, rng)
  const sponsor = rng.pick(state.guildFactions.length ? state.guildFactions : [{ id: undefined } as any])
  const votes = state.council.filter((seat) => seat.holderId && seat.influence > 0).map((seat) => {
    const holder = state.characters.find((entry) => entry.id === seat.holderId)
    const inclination = (holder?.loyalty ?? 50) + (holder?.traits.includes('жадный') && template.type === 'artifact' ? 25 : 0) + rng.int(-35, 35)
    const choice: CouncilVoteChoice = inclination >= 58 ? 'support' : inclination <= 38 ? 'oppose' : 'abstain'
    return { voterId: seat.holderId!, choice, weight: seat.influence }
  })
  const supportScore = votes.reduce((sum, vote) => sum + (vote.choice === 'support' ? vote.weight : vote.choice === 'oppose' ? -vote.weight : 0), 0)
  return { id: `proposal-${state.year}-${state.day}`, ...template, createdYear: state.year, createdDay: state.day, deadlineDay: Math.min(360, state.day + 30), deadlineYear: state.day + 30 > 360 ? state.year + 1 : state.year, sponsorFactionId: sponsor?.id, votes, status: 'pending', supportScore }
}

export function resolveCouncilProposal(state: GameState, proposalId: string, choice: CouncilVoteChoice): GameState {
  const proposal = state.councilProposals.find((entry) => entry.id === proposalId)
  if (!proposal || proposal.status !== 'pending') return state
  const finalScore = proposal.supportScore + (choice === 'support' ? 4 : choice === 'oppose' ? -4 : 0)
  const passed = finalScore > 0 && state.guild.treasury >= proposal.cost
  let guild = { ...state.guild }
  let charter = { ...state.charter }
  if (passed) {
    guild.treasury -= proposal.cost
    if (proposal.type === 'finance') guild.stability = Math.min(100, guild.stability + 2)
    if (proposal.type === 'rescue') { guild.stability = Math.min(100, guild.stability + 4); guild.reputation += 2 }
    if (proposal.type === 'publication') { guild.scientificAuthority += 5; guild.politicalInfluence = Math.max(0, guild.politicalInfluence - 1) }
    if (proposal.type === 'charter') guild.charterInfluence += 1
    if (proposal.type === 'branch') charter.branchAuthority = 'autonomous'
    if (proposal.type === 'artifact' && guild.artifacts > 0) { guild.artifacts -= 1; guild.treasury += 450 }
  }
  const factionDelta = passed ? 3 : -2
  return {
    ...state, guild, charter,
    councilProposals: state.councilProposals.map((entry) => entry.id === proposal.id ? { ...entry, playerChoice: choice, status: passed ? 'passed' : 'rejected', resultText: passed ? 'Совет утвердил решение.' : 'Совет отклонил предложение.' } : entry),
    guildFactions: state.guildFactions.map((entry) => entry.id === proposal.sponsorFactionId ? { ...entry, loyalty: Math.max(0, Math.min(100, entry.loyalty + factionDelta)) } : entry),
    chronicle: [...state.chronicle, { id: `chronicle-${proposal.id}`, year: state.year, day: state.day, title: passed ? `Совет принимает: ${proposal.title}` : `Совет отклоняет: ${proposal.title}`, text: passed ? 'Решение вступает в силу.' : 'Внутреннее противоречие остаётся нерешённым.', category: 'guild', importance: 3 }],
  }
}

export function changeGuildCharter<K extends keyof GuildCharter>(state: GameState, key: K, value: GuildCharter[K]): GameState {
  if (state.guild.charterInfluence < 1 || state.charter[key] === value) return state
  return { ...state, guild: { ...state.guild, charterInfluence: state.guild.charterInfluence - 1, stability: Math.max(0, state.guild.stability - 1) }, charter: { ...state.charter, [key]: value }, chronicle: [...state.chronicle, { id: `chronicle-charter-${state.year}-${state.day}-${String(key)}`, year: state.year, day: state.day, title: 'Изменён устав гильдии', text: `Пересмотрено правило «${String(key)}».`, category: 'guild', importance: 3 }] }
}

export function foundGuildDoctrine(state: GameState, founderId: string): GameState {
  const founder = state.characters.find((entry) => entry.id === founderId)
  const generation = currentGeneration(state)
  if (!founder || !generation || !founder.employed || founder.level < 4 || state.doctrines.some((entry) => entry.founderId === founderId)) return state
  const id = `doctrine-${founderId}-${state.year}`
  const doctrine: GuildDoctrine = { id, name: `Школа ${founder.familyName ?? founder.name.split(' ').at(-1)}`, founderId, generationId: generation.id, createdYear: state.year, createdDay: state.day, principle: founder.traits[0] ? `Действовать ${founder.traits[0]}` : 'Проверять каждый маршрут', bonus: `+1 к обучению навыка ${Object.entries(founder.skills).sort((a, b) => b[1] - a[1])[0][0]}`, weakness: founder.fear, support: 18 + founder.fame, graduateIds: [] }
  return { ...state, doctrines: [...state.doctrines, doctrine], generations: state.generations.map((entry) => entry.id === generation.id ? { ...entry, doctrineIds: [...entry.doctrineIds, id] } : entry), chronicle: [...state.chronicle, { id: `chronicle-${id}`, year: state.year, day: state.day, title: `${founder.name} основывает собственную школу`, text: `${doctrine.name} закрепляет новый подход к подготовке исследователей.`, category: 'guild', importance: 4 }] }
}

export function createGuildMemorial(state: GameState, characterId: string, type: GuildMemorial['type']): GameState {
  const character = state.characters.find((entry) => entry.id === characterId)
  const costs: Record<GuildMemorial['type'], number> = { portrait: 80, hall: 600, award: 240, school: 480, memorial: 320 }
  const cost = costs[type]
  if (!character || state.guild.treasury < cost || !['dead', 'retired'].includes(character.status) || state.memorials.some((entry) => entry.characterId === characterId && entry.type === type)) return state
  const memorial: GuildMemorial = { id: `memorial-${type}-${characterId}`, characterId, type, name: `${type === 'hall' ? 'Зал' : type === 'award' ? 'Награда' : type === 'school' ? 'Школа' : type === 'portrait' ? 'Портрет' : 'Мемориал'} имени ${character.name}`, createdYear: state.year, createdDay: state.day, effect: type === 'school' ? '+2 к репутации академии' : type === 'hall' ? '+3 к устойчивости' : '+1 к памяти гильдии' }
  return { ...state, guild: { ...state.guild, treasury: state.guild.treasury - cost, stability: Math.min(100, state.guild.stability + (type === 'hall' ? 3 : 1)), institutionalMemory: state.guild.institutionalMemory + (type === 'school' ? 2 : 1), academyReputation: state.guild.academyReputation + (type === 'school' ? 2 : 0) }, memorials: [...state.memorials, memorial], chronicle: [...state.chronicle, { id: `chronicle-${memorial.id}`, year: state.year, day: state.day, title: memorial.name, text: 'Имя исследователя закреплено в культуре гильдии.', category: 'guild', importance: 3 }] }
}

function tickAcademy(state: GameState): GameState {
  let characters = [...state.characters]
  const enrollments = state.academy.enrollments.map((entry) => {
    if (entry.status !== 'training') return entry
    const program = state.academy.programs.find((item) => item.id === entry.programId)!
    const mentor = characters.find((item) => item.id === entry.mentorId)
    const monthly = 100 / program.durationMonths + state.academy.level * 0.8 + (mentor ? mentor.skills.leadership * 0.25 : 0)
    const progress = Math.min(100, entry.progress + monthly)
    return { ...entry, progress, performance: Math.min(100, entry.performance + (mentor ? 1 : 0)), status: progress >= 100 && entry.examsPassed > 0 ? 'ready' as const : 'training' as const }
  })
  const treasury = Math.max(0, state.guild.treasury - state.academy.monthlyCost)
  return { ...state, guild: { ...state.guild, treasury }, academy: { ...state.academy, enrollments } }
}

function tickFactions(state: GameState, rng: RNG): GameState {
  const refreshed = refreshGuildFactions(state).map((entry) => {
    let charterEffect = 0
    if (entry.type === 'secrecy' && state.charter.archiveAccess === 'restricted') charterEffect += 3
    if (entry.type === 'reformers' && state.charter.leadershipSelection === 'council') charterEffect += 3
    if (entry.type === 'commerce' && state.charter.artifactRights === 'sponsor') charterEffect += 3
    if (entry.type === 'veterans' && state.charter.missingExpeditions === 'mandatory') charterEffect += 3
    if (entry.type === 'branches' && state.charter.branchAuthority === 'autonomous') charterEffect += 3
    return { ...entry, loyalty: Math.max(0, Math.min(100, entry.loyalty + charterEffect + rng.int(-3, 2))), relationToLeader: Math.max(-100, Math.min(100, entry.relationToLeader + rng.int(-4, 4))) }
  })
  const mutinous = refreshed.filter((entry) => entry.loyalty < 18 && entry.influence > 20)
  return { ...state, guildFactions: refreshed, guild: { ...state.guild, stability: Math.max(0, state.guild.stability - mutinous.length) } }
}

function tickGeneration(state: GameState): GameState {
  const current = currentGeneration(state)
  if (!current || state.year - current.startedYear < 12) return state
  const nextId = `generation-${state.year}`
  const title = state.wars.some((entry) => entry.status === 'active') ? 'Поколение большой войны' : state.branches.length >= 2 ? 'Поколение филиалов' : state.academy.reputation >= 25 ? 'Поколение академии' : 'Новое поколение'
  return { ...state, generations: [...state.generations.map((entry) => entry.id === current.id ? { ...entry, endedYear: state.year } : entry), { id: nextId, name: title, startedYear: state.year, memberIds: state.characters.filter((entry) => entry.employed && entry.age <= 32).map((entry) => entry.id), doctrineIds: [], definingEvents: [title] }], characters: state.characters.map((entry) => entry.employed && entry.age <= 32 ? { ...entry, generationId: nextId } : entry), chronicle: [...state.chronicle, { id: `chronicle-${nextId}`, year: state.year, day: state.day, title: title, text: 'Внутри гильдии сформировалось новое поколение исследователей.', category: 'guild', importance: 4 }] }
}

export function guildInstitutionDayTick(state: GameState): GameState {
  let next = state
  const rng = new RNG(`${state.seed}:guild-politics:${state.year}:${state.day}`)
  if (state.day % 30 === 0) {
    next = tickAcademy(next)
    next = tickFactions(next, rng)
    next = { ...next, council: refreshGuildCouncil(next) }
  }
  const pending = next.councilProposals.some((entry) => entry.status === 'pending')
  if (next.day % 90 === 0 && !pending && next.guild.rank >= 2) next = { ...next, councilProposals: [...next.councilProposals.slice(-30), createProposal(next)] }
  if (next.day === 1) next = tickGeneration(next)
  return next
}
