import type {
  BranchAutonomy,
  BranchSpecialization,
  Character,
  CharacterSkills,
  GameState,
  GuildBranch,
  Mentorship,
  PoliticalFaction,
  RivalExpedition,
  RivalGuild,
  RivalGuildArchetype,
  RivalGuildStance,
  WorldCrisis,
  WorldData,
} from '../types/game'
import { RNG } from './rng'

const GUILD_FIRST = ['Северная', 'Лазурная', 'Королевская', 'Пепельная', 'Золотая', 'Вольная', 'Тихая', 'Чёрная', 'Серебряная', 'Старая']
const GUILD_SECOND = ['экспедиция', 'компания', 'палата', 'коллегия', 'стража', 'артель', 'лига', 'канцелярия', 'обсерватория', 'дружина']
const LEADERS = ['Марек Дейн', 'Селена Вейл', 'Торвальд Кроу', 'Ирма Рилл', 'Эдран Фарен', 'Кассия Тал', 'Рагнар Брант', 'Мирель Харт']
const LEADER_TRAITS = ['холодный расчёт', 'одержимость славой', 'религиозная строгость', 'уважение к науке', 'готовность к грязной работе', 'верность покровителю']
const SPECIALIZATIONS: BranchSpecialization[] = ['cartography', 'archaeology', 'monsters', 'diplomacy', 'magic', 'trade']
const ARCHETYPES: RivalGuildArchetype[] = ['royal', 'academic', 'hunters', 'traders', 'relic_raiders', 'religious', 'free_company', 'secret']

export const specializationLabels: Record<BranchSpecialization, string> = {
  cartography: 'Картография', archaeology: 'Археология', monsters: 'Охота на чудовищ', diplomacy: 'Дипломатия', magic: 'Магические аномалии', trade: 'Торговые маршруты',
}

export const autonomyLabels: Record<BranchAutonomy, string> = {
  controlled: 'Полный контроль', limited: 'Ограниченная автономия', autonomous: 'Самостоятельный филиал',
}

export function stanceFromRelation(relation: number): RivalGuildStance {
  if (relation >= 65) return 'allied'
  if (relation >= 25) return 'cooperative'
  if (relation > -25) return 'neutral'
  if (relation > -65) return 'competitive'
  return 'hostile'
}

export function createStrategicLayer(seed: string, world: WorldData, characters: Character[]) {
  const rng = new RNG(`${seed}:strategy:v05`)
  const eligibleSettlements = world.settlements.filter((settlement) => !settlement.isGuildHome && ['capital', 'city', 'town', 'fortress', 'monastery'].includes(settlement.kind))
  const rivalCount = Math.max(4, Math.min(8, Math.round(world.realms.length * 1.2)))
  const rivalGuilds: RivalGuild[] = Array.from({ length: rivalCount }, (_, index) => {
    const archetype = ARCHETYPES[index % ARCHETYPES.length]
    const settlement = rng.pick(eligibleSettlements.length ? eligibleSettlements : world.settlements)
    const relation = rng.int(-45, 35)
    const favoredRealmId = settlement.realmId
    return {
      id: `rival-guild-${index + 1}`,
      name: `${rng.pick(GUILD_FIRST)} ${rng.pick(GUILD_SECOND)}`,
      archetype,
      headquartersSettlementId: settlement.id,
      leaderName: rng.pick(LEADERS),
      leaderTrait: rng.pick(LEADER_TRAITS),
      specialization: SPECIALIZATIONS[index % SPECIALIZATIONS.length],
      budget: rng.int(700, 3200),
      reputation: rng.int(18, 72),
      scientificAuthority: rng.int(8, 70),
      fieldStrength: rng.int(30, 86),
      secrecy: archetype === 'secret' || archetype === 'relic_raiders' ? rng.int(65, 95) : rng.int(15, 65),
      ethics: archetype === 'relic_raiders' ? rng.int(5, 30) : archetype === 'religious' ? rng.int(55, 90) : rng.int(25, 85),
      relation,
      stance: stanceFromRelation(relation),
      methods: rng.shuffle(['совместные исследования', 'подкуп проводников', 'давление через власти', 'выкуп карт', 'быстрые рейды', 'публичные лекции', 'тайные агенты']).slice(0, 3),
      favoredRealmId,
      discoveries: rng.int(0, 8),
      losses: rng.int(0, 4),
      activeExpeditionIds: [],
    }
  })

  const factionKinds: PoliticalFaction['kind'][] = ['court', 'army', 'faith', 'merchants', 'academy', 'local']
  const factionNames: Record<PoliticalFaction['kind'], string[]> = {
    court: ['Королевский двор', 'Княжеская канцелярия', 'Совет наследников'],
    army: ['Пограничное командование', 'Военный совет', 'Орден маршалов'],
    faith: ['Высший храм', 'Собор хранителей', 'Священный синод'],
    merchants: ['Союз торговых домов', 'Караванная палата', 'Совет портов'],
    academy: ['Королевская академия', 'Коллегия магистров', 'Общество древностей'],
    local: ['Провинциальные лорды', 'Союз свободных городов', 'Совет старост'],
  }
  const politicalFactions: PoliticalFaction[] = world.realms.flatMap((realm) => rng.shuffle(factionKinds).slice(0, 4).map((kind, index) => ({
    id: `faction-${realm.id}-${index}`,
    realmId: realm.id,
    name: rng.pick(factionNames[kind]),
    kind,
    influence: rng.int(25, 85),
    attitude: Math.max(-100, Math.min(100, realm.attitude + rng.int(-35, 35))),
    agenda: rng.pick(['расширить границы', 'контролировать древние находки', 'защитить торговые пути', 'ограничить магию', 'укрепить династию', 'подчинить исследовательские гильдии']),
    currentDemand: rng.pick(['передавать копии карт', 'не входить в священные руины', 'охранять караваны', 'раскрыть происхождение артефакта', 'найти доказательства старого договора']),
  })))

  const crisisKinds: WorldCrisis['kind'][] = ['war', 'succession', 'epidemic', 'religious', 'monster_migration', 'trade_collapse', 'magical_storm', 'rebellion']
  const crisisCount = world.realms.length >= 6 ? 3 : 2
  const crises: WorldCrisis[] = rng.shuffle(crisisKinds).slice(0, crisisCount).map((kind, index) => {
    const realm = rng.pick(world.realms)
    const settlements = world.settlements.filter((settlement) => settlement.realmId === realm.id)
    return {
      id: `crisis-${index + 1}`,
      kind,
      title: crisisTitle(kind, realm.name),
      description: crisisDescription(kind, realm.name),
      realmIds: [realm.id],
      settlementIds: rng.shuffle(settlements).slice(0, 2).map((settlement) => settlement.id),
      severity: rng.int(35, 72),
      progress: rng.int(5, 30),
      status: 'emerging',
      startedYear: 912,
      startedDay: 1,
      playerContribution: 0,
      effects: crisisEffects(kind),
    }
  })

  const leader = characters.filter((character) => character.employed).sort((a, b) => b.skills.leadership + b.fame / 10 - (a.skills.leadership + a.fame / 10))[0]
  return { rivalGuilds, politicalFactions, crises, leaderId: leader?.id }
}

function crisisTitle(kind: WorldCrisis['kind'], realmName: string): string {
  const titles: Record<WorldCrisis['kind'], string> = {
    war: `Пограничная война ${realmName}`,
    succession: `Спор о наследовании в ${realmName}`,
    epidemic: `Лихорадка в землях ${realmName}`,
    religious: `Раскол веры в ${realmName}`,
    monster_migration: `Миграция чудовищ к ${realmName}`,
    trade_collapse: `Крах караванных путей ${realmName}`,
    magical_storm: `Магическая буря над ${realmName}`,
    rebellion: `Провинциальное восстание в ${realmName}`,
  }
  return titles[kind]
}

function crisisDescription(kind: WorldCrisis['kind'], realmName: string): string {
  const texts: Record<WorldCrisis['kind'], string> = {
    war: `Соседние правители стягивают отряды к спорным перевалам. Карты и проводники стали военным ресурсом.`,
    succession: `Смерть старого правителя расколола знать. Каждая сторона ищет документы и союзников.`,
    epidemic: `Болезнь распространяется вдоль дорог. Города закрывают ворота, лекарства дорожают.`,
    religious: `Храмы спорят о древних текстах. Археологические находки могут усилить любую сторону.`,
    monster_migration: `Стаи покидают старые логова и давят на поселения. Причина пока неизвестна.`,
    trade_collapse: `Главный маршрут стал опасен, караваны исчезают, провинциальные города беднеют.`,
    magical_storm: `Нестабильная магия меняет дороги и будит старые сооружения.`,
    rebellion: `Провинции отказываются платить налоги и захватывают заставы.`,
  }
  return `${texts[kind]} Затронуто государство ${realmName}.`
}

function crisisEffects(kind: WorldCrisis['kind']): string[] {
  const effects: Record<WorldCrisis['kind'], string[]> = {
    war: ['опасность границ растёт', 'военные контракты дорожают'], succession: ['отношения фракций нестабильны', 'документы получают политическую цену'],
    epidemic: ['лечение дороже', 'поселения теряют население'], religious: ['храмы требуют контроля находок', 'научный авторитет становится спорным'],
    monster_migration: ['популяции двигаются к дорогам', 'охотничьи контракты учащаются'], trade_collapse: ['доходы поселений падают', 'новые маршруты ценнее'],
    magical_storm: ['магические риски растут', 'аномалии открывают новые места'], rebellion: ['границы контроля слабеют', 'местные фракции усиливаются'],
  }
  return effects[kind]
}

function activeRivalExpeditions(state: GameState, guildId: string): RivalExpedition[] {
  return state.rivalExpeditions.filter((expedition) => expedition.rivalGuildId === guildId && ['preparing', 'traveling'].includes(expedition.status))
}

function launchRivalExpedition(state: GameState, guild: RivalGuild, rng: RNG): GameState {
  if (activeRivalExpeditions(state, guild.id).length > 0) return state
  const targets = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day && !(opportunity.contestedByIds ?? []).includes(guild.id))
  if (!targets.length) return state
  const preferred = targets.filter((opportunity) => {
    const map: Record<BranchSpecialization, string[]> = {
      cartography: ['картография', 'разведка'], archaeology: ['руины', 'артефакт', 'поиск'], monsters: ['охота', 'спасение'], diplomacy: ['дипломатия', 'разведка'], magic: ['артефакт', 'исследование', 'руины'], trade: ['картография', 'дипломатия'],
    }
    return map[guild.specialization].includes(opportunity.type)
  })
  const opportunity = rng.pick(preferred.length ? preferred : targets)
  const etaDays = Math.max(8, Math.round(38 - guild.fieldStrength / 3 + opportunity.dangerEstimate * 2 + rng.int(-5, 8)))
  const expedition: RivalExpedition = {
    id: `rival-expedition-${state.year}-${state.day}-${guild.id}`,
    rivalGuildId: guild.id,
    opportunityId: opportunity.id,
    targetTileId: opportunity.targetTileId,
    title: opportunity.title,
    status: 'preparing',
    startedDay: state.day,
    startedYear: state.year,
    etaDays,
    progress: 0,
    strength: guild.fieldStrength,
    secrecy: guild.secrecy,
  }
  return {
    ...state,
    rivalGuilds: state.rivalGuilds.map((entry) => entry.id === guild.id ? { ...entry, activeExpeditionIds: [...entry.activeExpeditionIds, expedition.id], budget: Math.max(0, entry.budget - opportunity.dangerEstimate * 12) } : entry),
    rivalExpeditions: [...state.rivalExpeditions, expedition],
    opportunities: state.opportunities.map((entry) => entry.id === opportunity.id ? { ...entry, contestedByIds: [...(entry.contestedByIds ?? []), guild.id] } : entry),
  }
}

function tickRivalExpeditions(state: GameState, rng: RNG): GameState {
  let next = state
  for (const expedition of state.rivalExpeditions.filter((entry) => ['preparing', 'traveling'].includes(entry.status))) {
    const guild = next.rivalGuilds.find((entry) => entry.id === expedition.rivalGuildId)
    if (!guild) continue
    const status = expedition.status === 'preparing' && expedition.progress >= 12 ? 'traveling' : expedition.status
    const increment = status === 'preparing' ? rng.float(4, 9) : rng.float(2.3, 5.8) + expedition.strength / 55
    const progress = expedition.progress + increment
    if (progress < 100) {
      next = { ...next, rivalExpeditions: next.rivalExpeditions.map((entry) => entry.id === expedition.id ? { ...entry, status, progress } : entry) }
      continue
    }
    const opportunity = next.opportunities.find((entry) => entry.id === expedition.opportunityId)
    const successChance = Math.max(0.2, Math.min(0.88, 0.44 + expedition.strength / 180 - (opportunity?.dangerEstimate ?? 5) / 24))
    const success = rng.bool(successChance)
    const site = next.world.sites.find((candidate) => candidate.tileId === expedition.targetTileId)
    next = {
      ...next,
      rivalExpeditions: next.rivalExpeditions.map((entry) => entry.id === expedition.id ? { ...entry, status: success ? 'completed' : 'failed', progress: 100 } : entry),
      rivalGuilds: next.rivalGuilds.map((entry) => entry.id === guild.id ? {
        ...entry,
        activeExpeditionIds: entry.activeExpeditionIds.filter((id) => id !== expedition.id),
        reputation: Math.max(0, entry.reputation + (success ? 4 : -2)),
        discoveries: entry.discoveries + (success ? 1 : 0),
        losses: entry.losses + (success ? 0 : rng.int(1, 3)),
      } : entry),
      opportunities: next.opportunities.map((entry) => entry.id === expedition.opportunityId ? { ...entry, accepted: success ? true : entry.accepted } : entry),
      world: site && success ? { ...next.world, sites: next.world.sites.map((entry) => entry.id === site.id ? { ...entry, state: entry.state === 'unknown' ? 'discovered' : entry.state } : entry) } : next.world,
      chronicle: [...next.chronicle, {
        id: `chronicle-rival-${expedition.id}`,
        day: next.day, year: next.year,
        title: success ? `${guild.name} завершает экспедицию` : `${guild.name} несёт потери`,
        text: success ? `Конкуренты первыми закрыли задачу «${expedition.title}» и укрепили своё имя.` : `Отряд конкурентов не справился с задачей «${expedition.title}». Часть людей не вернулась.`,
        category: 'world', importance: success ? 2 : 3,
      }],
    }
  }
  return next
}

function tickBranches(state: GameState, rng: RNG): GameState {
  let treasuryDelta = 0
  let nextRivals = [...state.rivalGuilds]
  let characters = [...state.characters]
  let nextBranches: GuildBranch[] = []
  let chronicle = [...state.chronicle]
  for (const branch of state.branches) {
    const share = branch.autonomy === 'controlled' ? 0.7 : branch.autonomy === 'limited' ? 0.45 : 0.2
    const gross = Math.max(0, branch.income + rng.int(-15, 28) + branch.level * 8)
    const upkeep = branch.upkeep + branch.staff * 2
    const net = gross - upkeep
    treasuryDelta += Math.max(0, Math.round(net * share))
    const hidden = branch.autonomy === 'autonomous' ? Math.max(0, net - Math.round(net * share)) : Math.max(0, branch.hiddenFunds - 2)
    const loyaltyShift = branch.autonomy === 'controlled' ? rng.int(-3, 1) : branch.autonomy === 'limited' ? rng.int(-1, 2) : rng.int(-2, 3)
    const loyalty = Math.max(0, Math.min(100, branch.loyalty + loyaltyShift + (net >= 0 ? 1 : -3)))
    if (branch.autonomy === 'autonomous' && loyalty <= 15) {
      const settlement = state.world.settlements.find((entry) => entry.id === branch.settlementId)
      const splinterId = `rival-splinter-${branch.id}`
      nextRivals.push({
        id: splinterId, name: branch.name, archetype: 'free_company', headquartersSettlementId: branch.settlementId,
        leaderName: state.characters.find((entry) => entry.id === branch.leaderId)?.name ?? 'бывший руководитель филиала', leaderTrait: 'обида на центральный штаб', specialization: branch.specialization,
        budget: branch.treasury + hidden + 300, reputation: branch.reputation, scientificAuthority: 15, fieldStrength: 42 + branch.level * 5, secrecy: 35, ethics: 45,
        relation: -75, stance: 'hostile', methods: ['переманивание сотрудников', 'борьба за старые контакты', 'присвоение архивов'], favoredRealmId: settlement?.realmId ?? state.world.realms[0].id,
        discoveries: 0, losses: 0, activeExpeditionIds: [],
      })
      characters = characters.map((character) => character.id === branch.leaderId ? { ...character, employed: false, rivalGuildId: splinterId, assignedBranchId: undefined, loyalty: Math.max(0, character.loyalty - 30) } : character)
      chronicle.push({ id: `chronicle-branch-split-${branch.id}`, day: state.day, year: state.year, title: `${branch.name} отделяется`, text: 'Филиал отказался подчиняться центральному штабу и стал независимым конкурентом.', category: 'guild', importance: 5 })
      continue
    }
    nextBranches.push({ ...branch, treasury: Math.max(0, branch.treasury + net - Math.max(0, Math.round(net * share))), hiddenFunds: hidden, loyalty })
  }
  return { ...state, guild: { ...state.guild, treasury: state.guild.treasury + treasuryDelta }, characters, branches: nextBranches, rivalGuilds: nextRivals, chronicle }
}

function tickCrises(state: GameState, rng: RNG): GameState {
  let world = state.world
  const crises = state.crises.map((crisis) => {
    if (crisis.status === 'resolved' || crisis.status === 'collapsed') return crisis
    const pressure = rng.int(2, 7) + Math.round(crisis.severity / 25) - Math.round(crisis.playerContribution / 18)
    const progress = Math.max(0, Math.min(110, crisis.progress + pressure))
    const status: WorldCrisis['status'] = progress >= 100 ? 'collapsed' : progress >= 35 ? 'active' : 'emerging'
    if (status === 'collapsed') {
      world = {
        ...world,
        realms: world.realms.map((realm) => crisis.realmIds.includes(realm.id) ? { ...realm, stability: Math.max(5, realm.stability - Math.round(crisis.severity / 6)), wealth: Math.max(5, realm.wealth - Math.round(crisis.severity / 8)) } : realm),
        settlements: world.settlements.map((settlement) => crisis.settlementIds.includes(settlement.id) ? { ...settlement, prosperity: Math.max(5, settlement.prosperity - Math.round(crisis.severity / 7)), safety: Math.max(5, settlement.safety - Math.round(crisis.severity / 8)) } : settlement),
      }
    }
    return { ...crisis, progress, status }
  })
  return { ...state, world, crises }
}

function tickMentorships(state: GameState): GameState {
  let characters = [...state.characters]
  const mentorships = state.mentorships.map((mentorship) => {
    const mentor = characters.find((entry) => entry.id === mentorship.mentorId)
    const apprentice = characters.find((entry) => entry.id === mentorship.apprenticeId)
    if (!mentor || !apprentice || ['dead', 'missing'].includes(mentor.status) || ['dead', 'missing'].includes(apprentice.status)) return mentorship
    let progress = mentorship.progress + Math.max(1, Math.round((mentor.skills[mentorship.inheritedSkill] + mentor.skills.leadership) / 6))
    if (progress >= 100) {
      progress -= 100
      characters = characters.map((entry) => entry.id === apprentice.id ? {
        ...entry,
        experience: entry.experience + 30,
        skills: { ...entry.skills, [mentorship.inheritedSkill]: Math.min(10, entry.skills[mentorship.inheritedSkill] + 1) },
        loyalty: Math.min(100, entry.loyalty + 4),
        memories: [...entry.memories, { id: `memory-mentor-${state.year}-${state.day}-${mentor.id}`, title: 'Урок наставника', description: `${mentor.name} передал практический опыт: ${mentorship.doctrine}.`, intensity: 48, valence: 'positive' as const, type: 'career' as const, year: state.year, day: state.day, relatedCharacterIds: [mentor.id] }].slice(-18),
      } : entry)
    }
    return { ...mentorship, progress }
  })
  return { ...state, characters, mentorships }
}

function ensureGuildLeader(state: GameState): GameState {
  const current = state.characters.find((character) => character.id === state.guild.leaderId)
  if (current && current.employed && !current.assignedBranchId && !['dead', 'missing', 'retired'].includes(current.status)) return state
  const candidate = state.characters.filter((character) => character.employed && !character.assignedBranchId && !['dead', 'missing', 'retired'].includes(character.status)).sort((a, b) => (b.skills.leadership * 10 + b.fame + b.loyalty / 2) - (a.skills.leadership * 10 + a.fame + a.loyalty / 2))[0]
  if (!candidate) return state
  return {
    ...state,
    guild: { ...state.guild, leaderId: candidate.id, stability: Math.max(5, state.guild.stability - 3) },
    chronicle: [...state.chronicle, { id: `chronicle-leader-${state.year}-${state.day}-${candidate.id}`, day: state.day, year: state.year, title: `${candidate.name} возглавляет гильдию`, text: 'После кризиса руководства старшие сотрудники признали нового главу.', category: 'guild', importance: 4 }],
  }
}



function spawnCrisis(state: GameState, rng: RNG): GameState {
  const unresolved = state.crises.filter((crisis) => !['resolved', 'collapsed'].includes(crisis.status))
  if (unresolved.length >= Math.max(2, Math.round(state.world.realms.length / 2))) return state
  const kinds: WorldCrisis['kind'][] = ['war', 'succession', 'epidemic', 'religious', 'monster_migration', 'trade_collapse', 'magical_storm', 'rebellion']
  const realm = rng.pick(state.world.realms)
  const kind = rng.pick(kinds)
  const settlements = state.world.settlements.filter((settlement) => settlement.realmId === realm.id)
  const crisis: WorldCrisis = {
    id: `crisis-${state.year}-${state.day}-${state.crises.length + 1}`,
    kind,
    title: crisisTitle(kind, realm.name),
    description: crisisDescription(kind, realm.name),
    realmIds: [realm.id],
    settlementIds: rng.shuffle(settlements).slice(0, 2).map((settlement) => settlement.id),
    severity: rng.int(32, 78),
    progress: rng.int(4, 18),
    status: 'emerging',
    startedYear: state.year,
    startedDay: state.day,
    playerContribution: 0,
    effects: crisisEffects(kind),
  }
  return { ...state, crises: [...state.crises, crisis], chronicle: [...state.chronicle, { id: `chronicle-new-crisis-${crisis.id}`, day: state.day, year: state.year, title: crisis.title, text: crisis.description, category: 'world', importance: 3 }] }
}

function annualStrategicTick(state: GameState, rng: RNG): GameState {
  const activeCrisisRealms = new Set(state.crises.filter((crisis) => crisis.status === 'active').flatMap((crisis) => crisis.realmIds))
  const world = {
    ...state.world,
    realms: state.world.realms.map((realm) => {
      const crisisPenalty = activeCrisisRealms.has(realm.id) ? rng.int(2, 7) : 0
      return {
        ...realm,
        wealth: Math.max(5, Math.min(100, realm.wealth + rng.int(-4, 6) - crisisPenalty)),
        stability: Math.max(5, Math.min(100, realm.stability + rng.int(-5, 6) - crisisPenalty)),
        attitude: Math.max(-100, Math.min(100, realm.attitude + rng.int(-4, 4))),
      }
    }),
    settlements: state.world.settlements.map((settlement) => ({
      ...settlement,
      population: Math.max(80, Math.round(settlement.population * (1 + rng.float(-0.018, 0.032)))),
      prosperity: Math.max(5, Math.min(100, settlement.prosperity + rng.int(-3, 4))),
    })),
  }
  const rivalGuilds = state.rivalGuilds.map((guild) => {
    const relation = Math.max(-100, Math.min(100, guild.relation + rng.int(-5, 5)))
    return {
      ...guild,
      budget: Math.max(0, guild.budget + guild.reputation * 4 + rng.int(-180, 260)),
      fieldStrength: Math.max(10, Math.min(100, guild.fieldStrength + rng.int(-5, 7))),
      scientificAuthority: Math.max(0, Math.min(100, guild.scientificAuthority + rng.int(-3, 6))),
      relation,
      stance: stanceFromRelation(relation),
    }
  })
  const politicalFactions = state.politicalFactions.map((faction) => ({
    ...faction,
    influence: Math.max(5, Math.min(100, faction.influence + rng.int(-8, 8))),
    attitude: Math.max(-100, Math.min(100, faction.attitude + rng.int(-6, 6))),
  }))
  return { ...state, world, rivalGuilds, politicalFactions }
}

function poachCharacters(state: GameState, rng: RNG): GameState {
  const candidates = state.characters.filter((character) => !character.employed && !character.rivalGuildId && !['dead', 'missing', 'retired'].includes(character.status))
  if (!candidates.length || !rng.bool(0.3)) return state
  const rival = rng.pick(state.rivalGuilds)
  const target = rng.pick(candidates.sort((a, b) => b.level + b.fame / 20 - (a.level + a.fame / 20)).slice(0, Math.min(8, candidates.length)))
  return {
    ...state,
    characters: state.characters.map((character) => character.id === target.id ? { ...character, rivalGuildId: rival.id, loyalty: Math.max(0, character.loyalty - 5) } : character),
    rivalGuilds: state.rivalGuilds.map((entry) => entry.id === rival.id ? { ...entry, fieldStrength: Math.min(100, entry.fieldStrength + Math.max(1, target.level)), budget: Math.max(0, entry.budget - 80 - target.level * 20) } : entry),
    chronicle: [...state.chronicle, { id: `chronicle-poach-${state.year}-${state.day}-${target.id}`, day: state.day, year: state.year, title: `${rival.name} нанимает ${target.name}`, text: 'Конкуренты усилили состав раньше, чем гильдия успела предложить контракт.', category: 'character', importance: 2 }],
  }
}

function spawnGreatContract(state: GameState, rng: RNG): GameState {
  const existing = state.opportunities.some((opportunity) => opportunity.greatContract && !opportunity.accepted && opportunity.deadlineDay >= state.day)
  if (existing || state.guild.rank < 2) return state
  const site = rng.pick(state.world.sites.filter((entry) => entry.danger >= 6 && entry.state !== 'cleared'))
  if (!site) return state
  const realm = state.world.realms.find((entry) => entry.id === state.world.tiles.find((tile) => tile.id === site.tileId)?.stateId)
  const rivalIds = rng.shuffle(state.rivalGuilds).slice(0, Math.min(2, state.rivalGuilds.length)).map((guild) => guild.id)
  const opportunity = {
    id: `great-contract-${state.year}-${state.day}`,
    title: `Великая экспедиция: ${site.name}`,
    type: site.type === 'lair' ? 'охота' : 'руины',
    description: `Исследовать объект мирового значения и получить доказательства раньше конкурентов. ${realm ? `Права предъявляет ${realm.name}.` : ''}`,
    source: realm?.ruler ?? 'международный научный конгресс',
    targetTileId: site.tileId,
    reward: 1400 + site.danger * 180,
    deadlineDay: Math.min(360, state.day + 90),
    dangerEstimate: Math.min(10, site.danger + 1),
    knowledgeRequirement: 6,
    accepted: false,
    requiredRoles: ['Археолог', 'Следопыт', 'Лекарь'],
    riskProfile: { route: 7, combat: site.danger, climate: 6, disease: 5, politics: realm ? Math.max(4, Math.round((100 - realm.stability) / 10)) : 5, magic: Math.min(10, site.danger + 1) },
    contestedByIds: rivalIds,
    greatContract: true,
  }
  return { ...state, opportunities: [...state.opportunities, opportunity], chronicle: [...state.chronicle, { id: `chronicle-great-contract-${state.year}-${state.day}`, day: state.day, year: state.year, title: opportunity.title, text: 'Появился контракт, способный изменить положение гильдии в регионе.', category: 'world', importance: 4 }] }
}

export function strategicDayTick(state: GameState): GameState {
  let next = ensureGuildLeader(state)
  const progressScore = next.guild.reputation + next.guild.scientificAuthority + next.guild.politicalInfluence * 2 + next.discoveries.length * 3
  const rank = progressScore >= 220 ? 4 : progressScore >= 130 ? 3 : progressScore >= 65 ? 2 : 1
  if (rank > next.guild.rank) {
    next = { ...next, guild: { ...next.guild, rank, maxActiveExpeditions: Math.max(next.guild.maxActiveExpeditions, rank) }, chronicle: [...next.chronicle, { id: `chronicle-rank-${rank}-${next.year}-${next.day}`, day: next.day, year: next.year, title: `Гильдия получает ${rank} ранг`, text: 'Известность, архив и политические связи открыли новый уровень контрактов и регионального присутствия.', category: 'guild', importance: 4 }] }
  }
  const rng = new RNG(`${next.seed}:strategy-day:${next.year}:${next.day}`)
  next = tickRivalExpeditions(next, rng)
  if (next.day % 45 === 0) {
    for (const guild of next.rivalGuilds) if (rng.bool(0.65)) next = launchRivalExpedition(next, guild, rng)
  }
  if (next.day % 30 === 0) {
    next = tickBranches(next, rng)
    next = tickCrises(next, rng)
    next = tickMentorships(next)
    next = poachCharacters(next, rng)
  }
  if (next.day % 90 === 0) next = spawnGreatContract(next, rng)
  if (next.day % 120 === 0) next = spawnCrisis(next, rng)
  if (next.day === 1) {
    next = annualStrategicTick(next, rng)
    const active = next.rivalExpeditions.filter((expedition) => ['preparing', 'traveling'].includes(expedition.status))
    const archive = next.rivalExpeditions.filter((expedition) => !['preparing', 'traveling'].includes(expedition.status)).slice(-400)
    next = { ...next, rivalExpeditions: [...archive, ...active] }
  }
  return next
}

export function openBranch(state: GameState, settlementId: string, leaderId: string, specialization: BranchSpecialization, autonomy: BranchAutonomy): GameState {
  const settlement = state.world.settlements.find((entry) => entry.id === settlementId)
  const leader = state.characters.find((entry) => entry.id === leaderId)
  if (!settlement || !leader || !leader.employed || leader.assignedBranchId || state.guild.leaderId === leaderId || ['dead', 'missing', 'retired', 'expedition'].includes(leader.status)) return state
  if (state.branches.some((branch) => branch.settlementId === settlementId)) return state
  const cost = 900 + state.branches.length * 450
  if (state.guild.treasury < cost || state.guild.rank < 2) return state
  const branch: GuildBranch = {
    id: `branch-${state.year}-${state.day}-${state.branches.length + 1}`,
    name: `${state.guild.name}: ${settlement.name}`,
    settlementId, leaderId, specialization, autonomy, level: 1,
    treasury: 180, reputation: 8, loyalty: Math.max(35, leader.loyalty), staff: 4, upkeep: 38, income: 62,
    openedYear: state.year, openedDay: state.day, hiddenFunds: 0,
  }
  return {
    ...state,
    guild: { ...state.guild, treasury: state.guild.treasury - cost, politicalInfluence: state.guild.politicalInfluence + 2, charterInfluence: state.guild.charterInfluence + 1 },
    characters: state.characters.map((entry) => entry.id === leaderId ? { ...entry, fame: entry.fame + 6, loyalty: Math.min(100, entry.loyalty + 5), assignedBranchId: branch.id } : entry),
    branches: [...state.branches, branch],
    chronicle: [...state.chronicle, { id: `chronicle-branch-${branch.id}`, day: state.day, year: state.year, title: `Открыт филиал в ${settlement.name}`, text: `${leader.name} назначен руководителем. Специализация: ${specializationLabels[specialization]}.`, category: 'guild', importance: 4 }],
  }
}

export function changeBranchAutonomy(state: GameState, branchId: string, autonomy: BranchAutonomy): GameState {
  return { ...state, branches: state.branches.map((branch) => branch.id === branchId ? { ...branch, autonomy, loyalty: Math.max(0, Math.min(100, branch.loyalty + (autonomy === 'autonomous' ? 8 : autonomy === 'controlled' ? -8 : 2))) } : branch) }
}

export function conductRivalAction(state: GameState, rivalId: string, action: 'cooperate' | 'exchange' | 'pressure'): GameState {
  const rival = state.rivalGuilds.find((entry) => entry.id === rivalId)
  if (!rival) return state
  const costs = action === 'cooperate' ? { money: 120, influence: 0, relation: 15 } : action === 'exchange' ? { money: 60, influence: 0, relation: 8 } : { money: 0, influence: 3, relation: -16 }
  if (state.guild.treasury < costs.money || state.guild.politicalInfluence < costs.influence) return state
  const relation = Math.max(-100, Math.min(100, rival.relation + costs.relation))
  const rivalSettlement = state.world.settlements.find((entry) => entry.id === rival.headquartersSettlementId)
  const rivalTile = state.world.tiles.find((entry) => entry.id === rivalSettlement?.tileId)
  const exchangeTarget = action === 'exchange' && rivalTile
    ? state.world.tiles.filter((tile) => tile.knowledge < 2 && tile.biome !== 'ocean').sort((a, b) => Math.hypot(a.x - rivalTile.x, a.y - rivalTile.y) - Math.hypot(b.x - rivalTile.x, b.y - rivalTile.y))[0]
    : undefined
  return {
    ...state,
    guild: {
      ...state.guild,
      treasury: state.guild.treasury - costs.money,
      politicalInfluence: state.guild.politicalInfluence - costs.influence,
      scientificAuthority: state.guild.scientificAuthority + (action === 'exchange' ? 2 : 0),
      reputation: state.guild.reputation + (action === 'cooperate' ? 1 : 0),
    },
    world: exchangeTarget ? { ...state.world, tiles: state.world.tiles.map((tile) => tile.id === exchangeTarget.id ? { ...tile, knowledge: Math.max(1, tile.knowledge) as typeof tile.knowledge } : tile) } : state.world,
    rivalGuilds: state.rivalGuilds.map((entry) => entry.id === rivalId ? {
      ...entry,
      relation,
      stance: stanceFromRelation(relation),
      budget: Math.max(0, entry.budget + (action === 'cooperate' ? 80 : action === 'exchange' ? 30 : -180)),
      fieldStrength: Math.max(5, entry.fieldStrength + (action === 'pressure' ? -2 : 0)),
    } : entry),
    chronicle: [...state.chronicle, {
      id: `chronicle-rival-action-${state.day}-${rivalId}`,
      day: state.day,
      year: state.year,
      title: `${action === 'cooperate' ? 'Предложено сотрудничество' : action === 'exchange' ? 'Обмен сведениями' : 'Политическое давление'}: ${rival.name}`,
      text: action === 'exchange' && exchangeTarget ? 'Организации обменялись частью региональных карт.' : action === 'pressure' ? 'Через покровителей ограничено финансирование конкурента.' : 'Организации согласовали временное сотрудничество.',
      category: 'world',
      importance: 2,
    }],
  }
}

export function respondToCrisis(state: GameState, crisisId: string, mode: 'fund' | 'expedition' | 'neutral'): GameState {
  const crisis = state.crises.find((entry) => entry.id === crisisId)
  if (!crisis || ['resolved', 'collapsed'].includes(crisis.status)) return state
  const cost = mode === 'fund' ? 240 : mode === 'expedition' ? 100 : 0
  if (state.guild.treasury < cost) return state
  const contribution = mode === 'fund' ? 18 : mode === 'expedition' ? 11 : -2
  const progress = Math.max(0, crisis.progress - contribution)
  const resolved = progress === 0 && crisis.playerContribution + Math.max(0, contribution) >= 25
  return {
    ...state,
    guild: { ...state.guild, treasury: state.guild.treasury - cost, politicalInfluence: Math.max(0, state.guild.politicalInfluence + (mode === 'neutral' ? -1 : 2)), reputation: state.guild.reputation + (resolved ? 4 : mode === 'neutral' ? 0 : 1) },
    crises: state.crises.map((entry) => entry.id === crisisId ? { ...entry, progress, playerContribution: entry.playerContribution + Math.max(0, contribution), status: resolved ? 'resolved' : entry.status } : entry),
    politicalFactions: state.politicalFactions.map((faction) => crisis.realmIds.includes(faction.realmId) ? { ...faction, attitude: Math.max(-100, Math.min(100, faction.attitude + (mode === 'neutral' ? -3 : mode === 'fund' ? 7 : 5))) } : faction),
    chronicle: [...state.chronicle, { id: `chronicle-crisis-response-${state.day}-${crisisId}`, day: state.day, year: state.year, title: `Решение по кризису: ${crisis.title}`, text: mode === 'fund' ? 'Гильдия выделила деньги и специалистов.' : mode === 'expedition' ? 'Подготовлена полевая помощь и разведка.' : 'Гильдия сохранила нейтралитет.', category: 'world', importance: mode === 'neutral' ? 1 : 3 }],
  }
}

export function assignMentorship(state: GameState, mentorId: string, apprenticeId: string, inheritedSkill: keyof CharacterSkills): GameState {
  const mentor = state.characters.find((entry) => entry.id === mentorId)
  const apprentice = state.characters.find((entry) => entry.id === apprenticeId)
  if (!mentor || !apprentice || mentor.id === apprentice.id || !mentor.employed || !apprentice.employed) return state
  if (mentor.level < 3 || apprentice.level > 3 || state.mentorships.some((entry) => entry.apprenticeId === apprenticeId)) return state
  const mentorship: Mentorship = { id: `mentorship-${mentorId}-${apprenticeId}`, mentorId, apprenticeId, startedYear: state.year, startedDay: state.day, progress: 0, inheritedSkill, doctrine: mentor.traits[0] ? `работать ${mentor.traits[0]}` : 'проверять каждое решение' }
  return {
    ...state,
    mentorships: [...state.mentorships, mentorship],
    characters: state.characters.map((entry) => entry.id === mentorId ? { ...entry, apprenticeIds: [...entry.apprenticeIds, apprenticeId] } : entry.id === apprenticeId ? { ...entry, mentorId } : entry),
    chronicle: [...state.chronicle, { id: `chronicle-mentorship-${mentorship.id}`, day: state.day, year: state.year, title: `${mentor.name} берёт ученика`, text: `${apprentice.name} начинает обучение по навыку «${inheritedSkill}».`, category: 'character', importance: 2 }],
  }
}

export function appointGuildLeader(state: GameState, characterId: string): GameState {
  const candidate = state.characters.find((entry) => entry.id === characterId)
  if (!candidate || !candidate.employed || candidate.assignedBranchId || ['dead', 'missing', 'retired', 'expedition'].includes(candidate.status) || candidate.skills.leadership < 4) return state
  return {
    ...state,
    guild: { ...state.guild, leaderId: characterId, stability: Math.max(0, state.guild.stability - 2 + Math.round(candidate.loyalty / 30)) },
    characters: state.characters.map((entry) => entry.id === characterId ? { ...entry, fame: entry.fame + 8, careerStage: entry.careerStage === 'legend' ? 'legend' : 'leader' } : entry),
    chronicle: [...state.chronicle, { id: `chronicle-appointed-leader-${state.year}-${state.day}`, day: state.day, year: state.year, title: `${candidate.name} назначен главой`, text: 'Гильдия получила нового руководителя. Старшие сотрудники оценивают решение.', category: 'guild', importance: 5 }],
  }
}
