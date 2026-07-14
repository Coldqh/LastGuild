import { FIRST_NAMES, LAST_NAMES } from '../data/content'
import type {
  AncientCivilization,
  ArtifactRecord,
  GameState,
  HistoricalEvent,
  HistoricalMapSnapshot,
  HistoricalPerson,
  HistoricalSimulationState,
  Realm,
  Settlement,
  Site,
  WorldData,
  WorldGenerationSettings,
  WorldWar,
} from '../types/game'
import { simulateEcosystemYears } from './ecosystem'
import { createInitialPoliticalWars, initializePolitics, politicsMonthTick } from './politics'
import { DEFAULT_APP_PREFERENCES } from './preferences'
import { RNG } from './rng'
import { initializeSociety, simulateSocietyYears } from './society'

const PRESENT_YEAR = 912
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

export function historySpan(settings: WorldGenerationSettings): number {
  const base = settings.historyDepth === 'ancient' ? 640 : settings.historyDepth === 'young' ? 190 : 380
  const conflict = settings.conflictLevel === 'war_torn' ? 40 : settings.conflictLevel === 'calm' ? -20 : 0
  return Math.max(150, base + conflict)
}

function snapshotTitle(year: number, startYear: number, endYear: number): string {
  const progress = (year - startYear) / Math.max(1, endYear - startYear)
  if (progress < .2) return 'Эпоха первых владений'
  if (progress < .48) return 'Эпоха старых держав'
  if (progress < .76) return 'Эпоха войн и переселений'
  if (year < endYear) return 'Преддверие современного мира'
  return 'Мир перед открытием гильдии'
}

function makeSnapshot(world: WorldData, year: number, startYear: number, endYear: number): HistoricalMapSnapshot {
  return {
    id: `historical-snapshot-${year}`,
    year,
    title: snapshotTitle(year, startYear, endYear),
    realmByTile: Object.fromEntries(world.tiles.map((tile) => [tile.id, tile.controllerRealmId ?? tile.stateId])),
    settlementStates: Object.fromEntries(world.settlements.map((settlement) => [settlement.id, {
      realmId: settlement.realmId,
      population: settlement.population,
      prosperity: settlement.prosperity,
      status: settlement.status,
    }])),
    routeStates: Object.fromEntries(world.routes.map((route) => [route.id, route.status])),
    eventIds: world.history.filter((event) => event.year <= year && event.year > year - 20).map((event) => event.id),
  }
}

function seedHistoryWorld(seed: string, input: WorldData, settings: WorldGenerationSettings, startYear: number): WorldData {
  const rng = new RNG(`${seed}:historical-seed`)
  const realmCapitalIds = new Set(input.realms.map((realm) => realm.capitalId))
  const seededSettlements = input.settlements.map((settlement) => {
    const isCapital = realmCapitalIds.has(settlement.id)
    const foundingOffset = isCapital ? rng.int(0, 22) : rng.int(15, Math.min(135, Math.max(30, historySpan(settings) - 35)))
    const populationScale = isCapital ? rng.float(.12, .24) : rng.float(.08, .2)
    return {
      ...settlement,
      foundedYear: startYear + foundingOffset,
      population: Math.max(isCapital ? 900 : 120, Math.round(settlement.population * populationScale)),
      prosperity: clamp(settlement.prosperity * rng.float(.5, .72)),
      safety: clamp(settlement.safety * rng.float(.55, .8)),
      growth: 0,
      unrest: clamp(settlement.unrest * .65),
      status: 'active' as const,
      abandonedYear: undefined,
      occupationRealmId: undefined,
      resistance: 0,
    }
  })
  const seededRealms = input.realms.map((realm, index) => ({
    ...realm,
    foundedYear: startYear + rng.int(0, 28 + index * 2),
    collapsedYear: undefined,
    wealth: clamp(realm.wealth * rng.float(.45, .7)),
    military: clamp(realm.military * rng.float(.42, .68)),
    stability: clamp(realm.stability * rng.float(.62, .86)),
    treasury: Math.max(120, Math.round((realm.treasury ?? realm.wealth * 20) * .35)),
    manpower: Math.max(350, Math.round((realm.manpower ?? realm.military * 80) * .28)),
    warExhaustion: 0,
    objective: undefined,
    coreTileIds: [],
    claimTileIds: [],
  }))
  const foundationHistory: HistoricalEvent[] = seededRealms.map((realm) => {
    const capital = seededSettlements.find((settlement) => settlement.id === realm.capitalId)
    return {
      id: `history-foundation-${realm.id}`,
      year: realm.foundedYear ?? startYear,
      day: 1,
      title: `Основано государство ${realm.name}`,
      description: `${capital?.name ?? 'Первое укреплённое поселение'} подчинило ближайшие общины и создало ${realm.government}.`,
      tags: ['history', 'state', 'foundation', realm.id],
      severity: 4,
      kind: 'state',
      cause: capital ? `рост ${capital.name}, торговля и необходимость общей защиты` : 'объединение соседних общин',
      consequence: 'Возникли налоги, постоянная армия и признанная граница.',
      publicVersion: `Правящий дом ${realm.name} объявил объединение добровольным.`,
      hiddenTruth: 'Часть общин подчинили силой, а ранние договоры позднее были переписаны.',
      realmIds: [realm.id],
      settlementIds: capital ? [capital.id] : [],
      siteIds: [],
      tileIds: capital ? [capital.tileId] : [],
    }
  })
  return {
    ...input,
    realms: seededRealms,
    settlements: seededSettlements,
    history: foundationHistory,
    armies: [],
    politics: {
      initializedYear: startYear,
      lastTickYear: startYear,
      lastTickDay: 1,
      borderChanges: 0,
      occupations: 0,
      warsStarted: 0,
      warsEnded: 0,
      realmCollapses: 0,
      activeClaims: 0,
      recentEvents: [],
    },
    historicalPeople: [],
    historicalArtifacts: [],
    historicalCivilizations: [],
    historicalSnapshots: [],
    historicalCurrentWars: [],
    historicalSimulation: {
      startYear,
      endYear: startYear,
      yearsSimulated: 0,
      snapshotsCreated: 0,
      majorEvents: 0,
      warsRecorded: 0,
      realmsFounded: seededRealms.length,
      realmsCollapsed: 0,
      settlementsRuined: 0,
      artifactsCreated: 0,
      figuresCreated: 0,
      auditWarnings: [],
      elapsedMs: 0,
    },
  }
}

function createShell(seed: string, settings: WorldGenerationSettings, world: WorldData, wars: WorldWar[], year: number, day: number, chronicle: GameState['chronicle']): GameState {
  return {
    seed,
    settings,
    world,
    wars,
    year,
    day,
    chronicle,
  } as GameState
}


function addPredecessorStates(seed: string, input: WorldData, snapshots: HistoricalMapSnapshot[], settings: WorldGenerationSettings, startYear: number, endYear: number): { world: WorldData; snapshots: HistoricalMapSnapshot[] } {
  const rng = new RNG(`${seed}:historical-predecessors`)
  const desired = settings.historyDepth === 'ancient' ? Math.min(3, input.realms.length) : settings.historyDepth === 'old' ? Math.min(2, input.realms.length) : Math.min(1, input.realms.length)
  if (!desired) return { world: input, snapshots }
  let world = { ...input, realms: input.realms.map((entry) => ({ ...entry })), sites: input.sites.map((entry) => ({ ...entry })), history: [...input.history] }
  let nextSnapshots = snapshots.map((entry) => ({ ...entry, realmByTile: { ...entry.realmByTile } }))
  const successors = rng.shuffle(world.realms.filter((realm) => !realm.collapsedYear)).slice(0, desired)
  successors.forEach((successor, index) => {
    const collapsedYear = Math.max(startYear + 45, endYear - rng.int(settings.historyDepth === 'ancient' ? 170 : 90, settings.historyDepth === 'ancient' ? 420 : 230))
    const foundedYear = Math.max(startYear, collapsedYear - rng.int(75, 210))
    const predecessorId = `historical-predecessor-${successor.id}`
    const predecessor: Realm = {
      ...successor,
      id: predecessorId,
      name: `${rng.pick(['Старая держава', 'Первое королевство', 'Высокое княжество', 'Древний союз'])} ${successor.name}`,
      ruler: `${rng.pick(['Король', 'Архонт', 'Великая княгиня', 'Первый магистр'])} ${rng.pick(FIRST_NAMES)}`,
      government: `исчезнувшая ${successor.government}`,
      governmentType: `исчезнувшая ${successor.governmentType ?? successor.government}`,
      description: `Предшественник государства ${successor.name}. Контролировал те же земли до голода, войны и распада управления.`,
      currentIssue: 'государство существует только в хрониках и притязаниях наследников',
      foundedYear,
      collapsedYear,
      predecessorOfRealmId: successor.id,
      successorOfRealmId: undefined,
      capitalId: successor.capitalId,
      stability: 0,
      legitimacy: 0,
      treasury: 0,
      manpower: 0,
      military: Math.max(20, successor.military * rng.float(.75, 1.15)),
      wealth: Math.max(20, successor.wealth * rng.float(.8, 1.2)),
      objective: undefined,
      coreTileIds: [],
      claimTileIds: [],
      subjectRealmIds: [],
      relations: {},
    }
    world.realms.push(predecessor)
    world.realms = world.realms.map((realm) => realm.id === successor.id ? { ...realm, successorOfRealmId: predecessorId } : realm)
    const successorTiles = new Set(world.tiles.filter((tile) => (tile.legalRealmId ?? tile.controllerRealmId ?? tile.stateId) === successor.id).map((tile) => tile.id))
    const linkedSites = rng.shuffle(world.sites.filter((site) => successorTiles.has(site.tileId))).slice(0, 3)
    world.sites = world.sites.map((site) => linkedSites.some((entry) => entry.id === site.id) ? { ...site, formerRealmIds: Array.from(new Set([...(site.formerRealmIds ?? []), predecessorId])) } : site)
    const famineId = `history-predecessor-famine-${predecessorId}`
    const warId = `history-predecessor-war-${predecessorId}`
    const collapseId = `history-predecessor-collapse-${predecessorId}`
    const capital = world.settlements.find((settlement) => settlement.id === predecessor.capitalId)
    const rival = rng.pick(world.realms.filter((realm) => realm.id !== successor.id && realm.id !== predecessorId && !realm.collapsedYear))
    const famine: HistoricalEvent = {
      id: famineId,
      year: collapsedYear - 7,
      day: 120,
      title: `Голод в землях ${predecessor.name}`,
      description: `Неурожай и закрытые дороги вызвали нехватку пищи в центральных поселениях.`,
      tags: ['history', 'famine', predecessorId],
      severity: 4,
      kind: 'catastrophe',
      cause: 'несколько плохих сезонов, падение торговли и давление миграций',
      consequence: 'налоги и снабжение армии резко сократились',
      publicVersion: 'Поздние хроники называют причиной только неурожай.',
      hiddenTruth: 'Кризис усилили реквизиции двора и отказ открыть государственные зернохранилища.',
      realmIds: [predecessorId],
      settlementIds: capital ? [capital.id] : [],
      siteIds: linkedSites.map((site) => site.id),
      tileIds: capital ? [capital.tileId] : [],
      consequenceEventIds: [warId],
    }
    const war: HistoricalEvent = {
      id: warId,
      year: collapsedYear - 3,
      day: 210,
      title: `Последняя война ${predecessor.name}`,
      description: `${predecessor.name} вступило в войну${rival ? ` с державой ${rival.name}` : ''}, не имея устойчивого снабжения.`,
      tags: ['history', 'war', predecessorId],
      severity: 5,
      kind: 'war',
      cause: 'слабость после голода и борьба за пограничные ресурсы',
      consequence: 'армия потерпела поражение, а провинции перестали подчиняться столице',
      publicVersion: 'Придворная версия обвиняет предательство пограничных наместников.',
      hiddenTruth: 'Армия распалась из-за голода, долгов и отсутствия пополнений.',
      realmIds: [predecessorId, ...(rival ? [rival.id] : [])],
      settlementIds: capital ? [capital.id] : [],
      siteIds: linkedSites.map((site) => site.id),
      tileIds: [...successorTiles].slice(0, 6),
      causeEventIds: [famineId],
      consequenceEventIds: [collapseId],
    }
    const collapse: HistoricalEvent = {
      id: collapseId,
      year: collapsedYear,
      day: 330,
      title: `Распад государства ${predecessor.name}`,
      description: `Столица потеряла власть над дорогами и гарнизонами. На её землях позже возникло государство ${successor.name}.`,
      tags: ['history', 'state', 'collapse', predecessorId, successor.id],
      severity: 5,
      kind: 'state',
      cause: 'голод, военное поражение, долги и отделение провинций',
      consequence: `Появилось государство-преемник ${successor.name}, а старые границы остались предметом споров.`,
      publicVersion: `${successor.name} объявляет себя законным наследником прежней державы.`,
      hiddenTruth: 'Преемственность была создана позднее через поддельные родословные и выборочные архивы.',
      realmIds: [predecessorId, successor.id],
      settlementIds: capital ? [capital.id] : [],
      siteIds: linkedSites.map((site) => site.id),
      tileIds: [...successorTiles].slice(0, 12),
      causeEventIds: [famineId, warId],
      actualOutcome: 'Старая администрация исчезла, но местные элиты сохранили часть власти в новом государстве.',
    }
    world.history.push(famine, war, collapse)
    nextSnapshots = nextSnapshots.map((snapshot) => {
      if (snapshot.year >= collapsedYear) return snapshot
      const realmByTile = { ...snapshot.realmByTile }
      for (const tileId of successorTiles) if (realmByTile[tileId] === successor.id) realmByTile[tileId] = predecessorId
      return { ...snapshot, realmByTile, eventIds: Array.from(new Set([...snapshot.eventIds, ...(snapshot.year >= foundedYear ? [famineId, warId, collapseId].filter((id) => world.history.find((event) => event.id === id)!.year <= snapshot.year) : [])])) }
    })
  })
  return { world, snapshots: nextSnapshots }
}

function createRuinsFromHistory(seed: string, world: WorldData, endYear: number): { world: WorldData; ruinedCount: number } {
  const rng = new RNG(`${seed}:historical-ruins`)
  const existingTileIds = new Set(world.sites.map((site) => site.tileId))
  const collapsedRealmIds = new Set(world.realms.filter((realm) => realm.collapsedYear).map((realm) => realm.id))
  const candidates = world.settlements
    .filter((settlement) => !existingTileIds.has(settlement.tileId))
    .filter((settlement) => settlement.status === 'ruined' || collapsedRealmIds.has(settlement.legalRealmId ?? settlement.realmId) || (settlement.prosperity < 16 && settlement.population < 500))
    .sort((a, b) => (a.status === 'ruined' ? -1 : 1) - (b.status === 'ruined' ? -1 : 1) || a.population - b.population)
    .slice(0, Math.max(3, Math.min(14, Math.ceil(world.settlements.length * .22))))
  if (!candidates.length) return { world, ruinedCount: 0 }

  const candidateIds = new Set(candidates.map((settlement) => settlement.id))
  const sites: Site[] = candidates.map((settlement, index) => {
    const realmId = settlement.legalRealmId ?? settlement.realmId
    const realm = world.realms.find((entry) => entry.id === realmId)
    const destroyedYear = settlement.abandonedYear ?? realm?.collapsedYear ?? endYear - rng.int(25, 180)
    return {
      id: `historical-ruin-${settlement.id}`,
      name: `Руины ${settlement.name}`,
      tileId: settlement.tileId,
      type: settlement.kind === 'monastery' ? 'shrine' : settlement.kind === 'fortress' || settlement.kind === 'capital' ? 'ruins' : 'dungeon',
      origin: `${settlement.name} было ${settlement.kind === 'capital' ? 'столицей' : 'поселением'} государства ${realm?.name ?? 'исчезнувшей власти'}.`,
      age: Math.max(1, endYear - destroyedYear),
      danger: Math.min(10, Math.max(3, Math.round(4 + settlement.unrest / 22 + rng.float(0, 2)))),
      depth: settlement.kind === 'capital' ? 5 : settlement.kind === 'fortress' ? 4 : 3,
      state: rng.bool(.35) ? 'rumored' : 'unknown',
      monsterTags: world.monsterSpecies.filter((species) => species.habitats.includes(world.tiles.find((tile) => tile.id === settlement.tileId)?.biome ?? 'plains')).slice(0, 2).map((species) => species.id),
      rewards: ['городские записи', 'монеты исчезнувшей власти', 'печати владельцев'],
      truth: `Поселение погибло после накопления голода, войны и потери управления. Официальные хроники называют только последнюю катастрофу.`,
      layers: ['первоначальное поселение', 'период укрепления', 'следы последнего кризиса', 'логово поздних обитателей'],
      zones: [
        { id: `historical-ruin-${settlement.id}-gate`, name: 'Разрушенные ворота', kind: 'entrance', danger: 3, historyLayer: 'следы последнего кризиса', description: 'Ворота проломлены, на камне сохранились знаки осады и поздних лагерей.', connections: [`historical-ruin-${settlement.id}-square`], rewards: ['обломки гербов'], explored: false, secured: false },
        { id: `historical-ruin-${settlement.id}-square`, name: 'Мёртвая площадь', kind: 'hall', danger: 5, historyLayer: 'период укрепления', description: 'Площадь окружена обвалившимися домами и засыпанными подвалами.', connections: [`historical-ruin-${settlement.id}-gate`, `historical-ruin-${settlement.id}-archive`], rewards: ['монеты', 'городская печать'], explored: false, secured: false },
        { id: `historical-ruin-${settlement.id}-archive`, name: 'Засыпанный архив', kind: 'vault', danger: 7, historyLayer: 'первоначальное поселение', description: 'Под слоями золы и камня сохранились документы нескольких эпох.', connections: [`historical-ruin-${settlement.id}-square`], rewards: ['летописи', 'карта старых границ'], explored: false, secured: false },
      ],
      exploration: 0,
      campEstablished: false,
      foundedYear: settlement.foundedYear,
      destroyedYear,
      originalSettlementId: settlement.id,
      formerRealmIds: realmId ? [realmId] : [],
      historicalPersonIds: [],
    }
  })
  const siteBySettlement = new Map(sites.map((site) => [site.originalSettlementId!, site]))
  const settlements = world.settlements.map((settlement) => candidateIds.has(settlement.id) ? { ...settlement, status: 'ruined' as const, population: 0, abandonedYear: siteBySettlement.get(settlement.id)?.destroyedYear } : settlement)
  const tiles = world.tiles.map((tile) => {
    const settlement = world.settlements.find((entry) => entry.tileId === tile.id && candidateIds.has(entry.id))
    const site = settlement ? siteBySettlement.get(settlement.id) : undefined
    return site ? { ...tile, siteId: site.id, settlementId: undefined, danger: Math.min(10, tile.danger + 1.5) } : tile
  })
  const events: HistoricalEvent[] = sites.map((site) => {
    const settlement = world.settlements.find((entry) => entry.id === site.originalSettlementId)!
    return {
      id: `history-destruction-${settlement.id}`,
      year: site.destroyedYear ?? endYear,
      day: 300,
      title: `${settlement.name} стал руинами`,
      description: `${settlement.name} потерял население и власть. Поздние обитатели заняли оставшиеся подвалы и стены.`,
      tags: ['history', 'settlement', 'ruin', settlement.id],
      severity: 5,
      kind: 'settlement',
      cause: 'долгий упадок, война, голод или потеря торгового пути',
      consequence: 'На месте поселения появился опасный исторический объект.',
      publicVersion: `Город погиб в одной последней катастрофе.`,
      hiddenTruth: 'Разрушение заняло годы и было результатом нескольких связанных кризисов.',
      realmIds: site.formerRealmIds,
      settlementIds: [settlement.id],
      siteIds: [site.id],
      tileIds: [site.tileId],
    }
  })
  return { world: { ...world, settlements, tiles, sites: [...world.sites, ...sites], history: [...world.history, ...events] }, ruinedCount: sites.length }
}

function figuresFromHistory(seed: string, world: WorldData, startYear: number, endYear: number): HistoricalPerson[] {
  const rng = new RNG(`${seed}:historical-figures`)
  const figures: HistoricalPerson[] = []
  for (const realm of world.realms) {
    const culture = world.cultures.find((entry) => entry.name === realm.culture || entry.id === realm.culture)
    const people = world.peoples.find((entry) => entry.cultureId === culture?.id)
    const foundation = world.history.find((event) => event.tags.includes('foundation') && event.realmIds?.includes(realm.id))
    const bornYear = Math.max(startYear - 30, (realm.foundedYear ?? startYear) - rng.int(24, 48))
    figures.push({
      id: `historical-founder-${realm.id}`,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      role: 'founder',
      ancestry: people?.ancestry ?? 'человек',
      cultureId: culture?.id,
      realmId: realm.id,
      settlementId: realm.capitalId,
      bornYear,
      diedYear: Math.min(endYear, bornYear + rng.int(48, 82)),
      ambition: `объединить земли вокруг ${world.settlements.find((entry) => entry.id === realm.capitalId)?.name ?? 'столицы'}`,
      reputation: realm.collapsedYear ? rng.int(45, 82) : rng.int(58, 92),
      legacy: realm.collapsedYear ? `Основал ${realm.name}, но поздние правители потеряли созданное государство.` : `Считается основателем политической традиции ${realm.name}.`,
      eventIds: foundation ? [foundation.id] : [],
      artifactIds: [],
    })
  }
  const warEvents = world.history.filter((event) => event.kind === 'war' && (event.severity ?? 0) >= 4).slice(-12)
  for (const event of warEvents) {
    const realmId = event.realmIds?.[0]
    const realm = world.realms.find((entry) => entry.id === realmId)
    const bornYear = event.year - rng.int(25, 48)
    figures.push({
      id: `historical-commander-${event.id}`,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      role: rng.bool(.18) ? 'rebel' : 'commander',
      ancestry: world.peoples.find((entry) => entry.cultureId === world.cultures.find((culture) => culture.name === realm?.culture)?.id)?.ancestry ?? 'человек',
      realmId,
      settlementId: event.settlementIds?.[0],
      bornYear,
      diedYear: Math.min(endYear, bornYear + rng.int(38, 73)),
      ambition: event.cause ?? 'одержать победу и сохранить власть',
      reputation: rng.int(48, 96),
      legacy: `${event.title}. ${event.actualOutcome ?? event.consequence ?? event.description}`,
      eventIds: [event.id],
      artifactIds: [],
    })
  }
  return figures.slice(0, 36)
}

function artifactsFromHistory(seed: string, world: WorldData, figures: HistoricalPerson[], settings: WorldGenerationSettings): ArtifactRecord[] {
  const rng = new RNG(`${seed}:historical-artifacts`)
  const candidateEvents = world.history
    .filter((event) => (event.severity ?? 0) >= 4 && ['state', 'war', 'religion', 'catastrophe'].includes(event.kind ?? ''))
    .sort((a, b) => a.year - b.year)
  const target = settings.historyDepth === 'ancient' ? 12 : settings.historyDepth === 'young' ? 5 : 8
  return rng.shuffle(candidateEvents).slice(0, target).map((event, index) => {
    const creator = figures.find((figure) => figure.eventIds.includes(event.id)) ?? rng.pick(figures)
    const site = event.siteIds?.length ? world.sites.find((entry) => event.siteIds?.includes(entry.id)) : rng.pick(world.sites.filter((entry) => entry.state !== 'cleared'))
    const type = event.kind === 'war' ? 'знамя' : event.kind === 'religion' ? 'реликвия' : event.kind === 'state' ? 'печать' : 'инструмент'
    const id = `historical-artifact-${index + 1}`
    const name = `${rng.pick(['Последняя', 'Сломанная', 'Чёрная', 'Серебряная', 'Пепельная', 'Каменная'])} ${rng.pick(['корона', 'печать', 'клятва', 'карта', 'чаша', 'реликвия', 'стела'])}`
    if (creator) creator.artifactIds.push(id)
    return {
      id,
      name,
      creator: creator?.name ?? `мастер эпохи ${event.year} года`,
      creatorPersonId: creator?.id,
      createdYear: event.year,
      originalPurpose: `${type}, созданный во время события «${event.title}»`,
      power: event.kind === 'catastrophe' ? 'сохраняет остаточную магическую энергию события' : 'служит доказательством прав, договоров или старой власти',
      cost: 'использование может возродить старые претензии и конфликты',
      publicLegend: event.publicVersion ?? event.description,
      hiddenTruth: event.hiddenTruth ?? `Предмет связан с истинными причинами события «${event.title}».`,
      currentSiteId: site?.id,
      ownerType: 'lost',
      ownerId: undefined,
      parts: rng.int(1, 3),
      recoveredParts: 0,
      status: rng.bool(.3) ? 'rumored' : 'lost',
      relatedDiscoveryIds: [],
      knownLevel: 0,
      ownerHistory: [{ year: event.year, ownerType: 'realm', ownerId: event.realmIds?.[0], eventId: event.id, note: `Создан после события «${event.title}».` }, { year: Math.min(endYearFromWorld(world), event.year + rng.int(15, 95)), ownerType: 'lost', eventId: event.id, note: 'Предмет исчез во время следующего политического кризиса.' }],
    }
  })
}

function endYearFromWorld(world: WorldData): number {
  return Math.max(PRESENT_YEAR, ...world.history.map((event) => event.year))
}

function civilizationsFromCollapsedRealms(world: WorldData, artifacts: ArtifactRecord[]): AncientCivilization[] {
  return world.realms.filter((realm) => realm.collapsedYear).slice(0, 8).map((realm, index) => {
    const sites = world.sites.filter((site) => site.formerRealmIds?.includes(realm.id) || site.originalSettlementId === realm.capitalId)
    const territory = world.tiles.filter((tile) => tile.legalRealmId === realm.id || tile.claimedByRealmIds?.includes(realm.id)).map((tile) => tile.id)
    const foundation = world.history.find((event) => event.tags.includes('foundation') && event.realmIds?.includes(realm.id))
    const collapse = world.history.find((event) => event.title.includes(realm.name) && event.year === realm.collapsedYear)
    return {
      id: `historical-civilization-${index + 1}`,
      templateId: 'historical-realm',
      name: realm.name,
      people: realm.culture,
      era: `${realm.foundedYear ?? '?'}–${realm.collapsedYear}`,
      architecture: `государственные постройки культуры «${realm.culture}»`,
      religion: realm.dominantFaith,
      magicTradition: 'магические практики сохранились фрагментарно в государственных архивах',
      riseCause: foundation?.cause ?? 'рост столицы и объединение соседних поселений',
      fallCause: collapse?.cause ?? 'войны, кризис снабжения и потеря легитимности',
      legacy: ['старые границы', 'династические претензии', 'руины административных центров'],
      siteIds: sites.map((site) => site.id),
      territoryTileIds: territory,
      artifactIds: artifacts.filter((artifact) => artifact.ownerHistory?.some((entry) => entry.ownerId === realm.id)).map((artifact) => artifact.id),
      knownLevel: 0,
      publicHistory: `${realm.name} описывается поздними хронистами как единая и стабильная держава.`,
      hiddenTruth: 'Власть была неоднородной, а часть земель контролировалась только через дороги, гарнизоны и договоры.',
    }
  })
}

function historyAudit(world: WorldData, wars: WorldWar[], initialRealmCount: number, elapsedMs: number): string[] {
  const warnings: string[] = []
  const land = world.tiles.filter((tile) => tile.biome !== 'ocean')
  const living = world.realms.filter((realm) => !realm.collapsedYear)
  const controlCounts = new Map<string, number>()
  for (const tile of land) if (tile.controllerRealmId) controlCounts.set(tile.controllerRealmId, (controlCounts.get(tile.controllerRealmId) ?? 0) + 1)
  const largestShare = land.length ? Math.max(0, ...controlCounts.values()) / land.length : 0
  const activeWars = wars.filter((war) => war.status !== 'ended')
  const population = world.settlements.filter((entry) => entry.status !== 'ruined').reduce((sum, entry) => sum + entry.population, 0)
  const soldiers = world.armies.reduce((sum, army) => sum + army.soldiers, 0)
  if (!living.length) warnings.push('Все государства распались к началу кампании.')
  if (living.length > Math.max(10, initialRealmCount * 2.5)) warnings.push('Государства дробятся слишком быстро.')
  if (largestShare > .72) warnings.push('Одна держава контролирует более 72% суши.')
  if (activeWars.length > Math.max(3, living.length / 2)) warnings.push('Слишком много войн осталось активными одновременно.')
  if (population > 0 && soldiers / population > .16) warnings.push('Армии забирают чрезмерную долю населения.')
  if (world.politics.realmCollapses > Math.max(12, world.realms.length * 1.7)) warnings.push('Государства распадаются слишком часто.')
  if (world.settlements.filter((entry) => entry.status === 'ruined').length > world.settlements.length * .45) warnings.push('Почти половина поселений стала руинами.')
  if (elapsedMs > 8500) warnings.push('Историческая генерация слишком тяжёлая для слабого телефона.')
  return warnings
}

export interface HistoricalSimulationResult {
  world: WorldData
  wars: WorldWar[]
  snapshots: HistoricalMapSnapshot[]
}

export function simulateWorldHistory(seed: string, input: WorldData, settings: WorldGenerationSettings, endYear = PRESENT_YEAR): HistoricalSimulationResult {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const span = historySpan(settings)
  const startYear = endYear - span
  const initialRealmCount = input.realms.length
  let world = seedHistoryWorld(seed, input, settings, startYear)
  world = initializeSociety(seed, world, settings, startYear)
  world = initializePolitics(seed, world, settings, startYear)
  let wars = createInitialPoliticalWars(seed, world, settings, startYear)
  let chronicle: GameState['chronicle'] = []
  let snapshots: HistoricalMapSnapshot[] = [makeSnapshot(world, startYear, startYear, endYear)]
  const snapshotEvery = settings.historyDepth === 'ancient' ? 50 : settings.historyDepth === 'young' ? 25 : 40

  const epochYears = settings.historyDepth === 'ancient' ? 10 : settings.historyDepth === 'young' ? 5 : 8
  for (let epochStart = startYear; epochStart < endYear; epochStart += epochYears) {
    const year = Math.min(endYear - 1, epochStart + epochYears - 1)
    // Historical generation uses coarse epochs. One ecological and social step represents
    // the dominant change of the whole epoch; the live campaign returns to monthly ticks.
    world = simulateEcosystemYears(world, seed, settings, 1, year)
    world = simulateSocietyYears(world, seed, settings, 1, year)
    for (const day of [90, 180, 270, 360]) {
      const next = politicsMonthTick(createShell(seed, settings, world, wars, year, day, chronicle), DEFAULT_APP_PREFERENCES)
      world = next.world
      wars = next.wars
      chronicle = next.chronicle
    }
    const elapsedYears = year - startYear + 1
    if (elapsedYears % snapshotEvery < epochYears || year === endYear - 1) snapshots.push(makeSnapshot(world, year + 1, startYear, endYear))
  }

  const predecessorLayer = addPredecessorStates(seed, world, snapshots, settings, startYear, endYear)
  world = predecessorLayer.world
  snapshots = predecessorLayer.snapshots
  const ruins = createRuinsFromHistory(seed, world, endYear)
  world = ruins.world
  const figures = figuresFromHistory(seed, world, startYear, endYear)
  const artifacts = artifactsFromHistory(seed, world, figures, settings)
  const civilizations = civilizationsFromCollapsedRealms(world, artifacts)
  const linkedArtifacts = artifacts.map((artifact) => ({ ...artifact, civilizationId: civilizations.find((civilization) => civilization.artifactIds.includes(artifact.id))?.id }))
  const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started)
  const warnings = historyAudit(world, wars, initialRealmCount, elapsed)
  const currentStart = world.settlements.find((entry) => entry.id === world.startSettlementId && entry.status !== 'ruined')
  const replacementStart = currentStart ?? world.settlements
    .filter((entry) => entry.status !== 'ruined' && ['village', 'town'].includes(entry.kind))
    .sort((a, b) => a.prosperity - b.prosperity || a.population - b.population)[0]
    ?? world.settlements.find((entry) => entry.status !== 'ruined')
  if (replacementStart) {
    world = {
      ...world,
      startSettlementId: replacementStart.id,
      settlements: world.settlements.map((entry) => ({ ...entry, isGuildHome: entry.id === replacementStart.id })),
    }
  }

  const simulation: HistoricalSimulationState = {
    startYear,
    endYear,
    yearsSimulated: span,
    snapshotsCreated: snapshots.length,
    majorEvents: world.history.filter((event) => (event.severity ?? 0) >= 4).length,
    warsRecorded: world.politics.warsStarted,
    realmsFounded: world.realms.length,
    realmsCollapsed: world.realms.filter((realm) => realm.collapsedYear).length,
    settlementsRuined: ruins.ruinedCount,
    artifactsCreated: linkedArtifacts.length,
    figuresCreated: figures.length,
    auditWarnings: warnings.length ? warnings : ['Критических перекосов исторической симуляции не найдено.'],
    elapsedMs: elapsed,
  }
  const currentWars = wars.filter((war) => war.status !== 'ended').map((war) => {
    const age = endYear - war.startedYear
    return age > 4 ? { ...war, startedYear: endYear - 2, startedDay: 1, attackerExhaustion: Math.min(war.attackerExhaustion, 42), defenderExhaustion: Math.min(war.defenderExhaustion, 42) } : war
  })
  world = {
    ...world,
    history: world.history.sort((a, b) => a.year - b.year || (a.day ?? 0) - (b.day ?? 0)).slice(-1800),
    historicalPeople: figures,
    historicalArtifacts: linkedArtifacts,
    historicalCivilizations: civilizations,
    historicalSnapshots: snapshots,
    historicalCurrentWars: currentWars,
    historicalSimulation: simulation,
  }
  return { world, wars: world.historicalCurrentWars, snapshots }
}

export function ensureHistoricalWorld(seed: string, input: WorldData, settings: WorldGenerationSettings, currentYear = PRESENT_YEAR): WorldData {
  const hasHistoricalIndex = Boolean(input.historicalSimulation?.snapshotsCreated && input.historicalSnapshots?.length)
  if (hasHistoricalIndex && input.historicalPeople && input.historicalArtifacts && input.historicalCivilizations) return input
  const startYear = currentYear - historySpan(settings)
  const snapshots = [makeSnapshot(input, startYear, startYear, currentYear), makeSnapshot(input, currentYear, startYear, currentYear)]
  const figures = figuresFromHistory(seed, input, startYear, currentYear)
  const artifacts = artifactsFromHistory(seed, input, figures, settings)
  const civilizations = civilizationsFromCollapsedRealms(input, artifacts)
  const linkedArtifacts = artifacts.map((artifact) => ({ ...artifact, civilizationId: civilizations.find((civilization) => civilization.artifactIds.includes(artifact.id))?.id }))
  return {
    ...input,
    historicalPeople: figures,
    historicalArtifacts: linkedArtifacts,
    historicalCivilizations: civilizations,
    historicalSnapshots: snapshots,
    historicalCurrentWars: [],
    historicalSimulation: {
      startYear,
      endYear: currentYear,
      yearsSimulated: 0,
      snapshotsCreated: snapshots.length,
      majorEvents: input.history.filter((event) => (event.severity ?? 0) >= 4).length,
      warsRecorded: input.politics?.warsStarted ?? 0,
      realmsFounded: input.realms.length,
      realmsCollapsed: input.realms.filter((realm) => realm.collapsedYear).length,
      settlementsRuined: input.settlements.filter((entry) => entry.status === 'ruined').length,
      artifactsCreated: linkedArtifacts.length,
      figuresCreated: figures.length,
      auditWarnings: ['Старое сохранение получило исторический индекс без повторного изменения мира.'],
      elapsedMs: 0,
    },
  }
}
