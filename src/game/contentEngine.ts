import { ARTIFACT_TEMPLATES } from '../data/artifacts'
import { CIVILIZATION_TEMPLATES } from '../data/civilizations'
import { EXPEDITION_CONTENT_EVENTS } from '../data/expeditionContent'
import { STORY_CHAIN_TEMPLATES, type StoryChainTemplate, type StoryStageTemplate } from '../data/storyChains'
import type {
  AncientCivilization,
  ArtifactRecord,
  BiomeId,
  ContentValidationIssue,
  DiscoveryDisposition,
  Expedition,
  ExpeditionDecision,
  GameState,
  Opportunity,
  RegionalIdentity,
  StoryChain,
  StoryStage,
  WorldData,
  WorldGenerationSettings,
  WorldTile,
} from '../types/game'
import { RNG } from './rng'

const REGION_SUFFIXES: Record<BiomeId, string[]> = {
  ocean: ['Внутреннее море', 'Серые воды'], coast: ['Соляной берег', 'Предел маяков'], plains: ['Широкие поля', 'Старый тракт'], forest: ['Лесной край', 'Зелёная граница'], ancient_forest: ['Старый лес', 'Корневая чаща'], hills: ['Каменные холмы', 'Земли курганов'], mountains: ['Высокий хребет', 'Перевальный край'], swamp: ['Чёрные топи', 'Затонувшая низина'], desert: ['Пыльный предел', 'Стеклянная пустошь'], tundra: ['Белая окраина', 'Северный холод'], ashlands: ['Пепельный рубеж', 'Мёртвая земля'],
}

const ARCHITECTURE_BY_CULTURE: Record<string, string> = {
  арденская: 'каменные стены, высокие кровли и укреплённые рынки', вельская: 'кирпичные башни, речные склады и арочные мосты', дворфийская: 'тяжёлые своды, рунические опоры и глубокие подвалы', эльфийская: 'живые галереи, открытые дворы и деревянные шпили', марская: 'белёные стены, внутренние сады и плоские крыши', 'орочья пограничная': 'земляные валы, длинные дома и трофейные ворота', тирская: 'яркие фасады, закрытые переходы и башни наблюдателей',
}

function tileDistance(a: WorldTile, b: WorldTile): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function mostCommon<T extends string>(values: T[], count = 2): T[] {
  const tally = new Map<T, number>()
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([value]) => value)
}

function createRegionalIdentities(seed: string, world: WorldData): RegionalIdentity[] {
  const rng = new RNG(`${seed}:content:regions`)
  return world.realms.map((realm, index) => {
    const tiles = world.tiles.filter((tile) => tile.stateId === realm.id && tile.biome !== 'ocean')
    const settlements = world.settlements.filter((settlement) => settlement.realmId === realm.id)
    const capital = settlements.find((settlement) => settlement.kind === 'capital') ?? settlements[0]
    const centerTile = world.tiles.find((tile) => tile.id === capital?.tileId) ?? tiles[0] ?? world.tiles[0]
    const dominantBiomes = mostCommon(tiles.map((tile) => tile.biome), 2)
    const goods = [...new Set(settlements.flatMap((settlement) => settlement.production))].slice(0, 4)
    const threats = world.monsterSpecies.filter((species) => species.habitats.some((habitat) => dominantBiomes.includes(habitat))).sort((a, b) => b.threat - a.threat).slice(0, 3).map((species) => species.name)
    const culture = realm.culture ?? 'смешанная'
    const suffix = rng.pick(REGION_SUFFIXES[dominantBiomes[0] ?? 'plains'])
    const nearbySites = world.sites.filter((site) => {
      const tile = world.tiles.find((candidate) => candidate.id === site.tileId)
      return tile?.stateId === realm.id
    }).map((site) => site.id)
    return {
      id: `region-identity-${index + 1}`,
      name: `${realm.name}: ${suffix}`,
      centerTileId: centerTile.id,
      tileIds: tiles.map((tile) => tile.id),
      dominantBiomes,
      cultures: [realm.culture],
      architecture: ARCHITECTURE_BY_CULTURE[culture] ?? 'смешанная пограничная архитектура',
      goods: goods.length ? goods : ['лес', 'зерно'],
      threats: threats.length ? threats : ['разбойники на дорогах'],
      politicalProblem: realm.currentIssue,
      legends: rng.shuffle(['дорога, исчезающая зимой', 'закрытая долина без официального владельца', 'родник, помнящий имена погибших', 'старая крепость под современным городом', 'ночные огни над древними курганами']).slice(0, 2),
      siteIds: nearbySites,
      knownLevel: realm.attitude > 15 ? 2 : 1,
    }
  })
}

function assignCivilizations(seed: string, world: WorldData, settings: WorldGenerationSettings, regions: RegionalIdentity[]): { world: WorldData; civilizations: AncientCivilization[] } {
  const rng = new RNG(`${seed}:content:civilizations`)
  const count = Math.min(CIVILIZATION_TEMPLATES.length, settings.historyDepth === 'ancient' ? 5 : settings.historyDepth === 'old' ? 4 : 3)
  const templates = rng.shuffle(CIVILIZATION_TEMPLATES).slice(0, count)
  let sites = world.sites.map((site) => ({ ...site }))
  const usedSites = new Set<string>()
  const civilizations: AncientCivilization[] = templates.map((template, index) => {
    const candidates = sites.filter((site) => {
      if (usedSites.has(site.id)) return false
      const tile = world.tiles.find((entry) => entry.id === site.tileId)
      return template.preferredSiteTypes.includes(site.type) || (tile && template.preferredBiomes.includes(tile.biome))
    })
    const fallback = sites.filter((site) => !usedSites.has(site.id))
    const selectedSites = rng.shuffle(candidates.length >= 3 ? candidates : fallback).slice(0, Math.min(6, Math.max(3, Math.round(sites.length / Math.max(4, count * 2)))))
    selectedSites.forEach((site) => usedSites.add(site.id))
    const name = `${rng.pick(template.nameParts)}${index > 1 && rng.bool(0.35) ? ` ${rng.pick(['Старший', 'Восточный', 'Последний'])}` : ''}`
    const territory = new Set<string>()
    for (const site of selectedSites) {
      const center = world.tiles.find((tile) => tile.id === site.tileId)
      if (!center) continue
      for (const tile of world.tiles) if (tile.biome !== 'ocean' && tileDistance(tile, center) <= 3.4) territory.add(tile.id)
    }
    const civilization: AncientCivilization = {
      id: `civilization-${index + 1}`,
      templateId: template.id,
      name,
      people: template.people,
      era: template.era,
      architecture: template.architecture,
      religion: template.religion,
      magicTradition: template.magicTradition,
      riseCause: rng.pick(template.riseCauses),
      fallCause: rng.pick(template.fallCauses),
      legacy: rng.shuffle(template.legacies).slice(0, 3),
      siteIds: selectedSites.map((site) => site.id),
      territoryTileIds: [...territory],
      artifactIds: [],
      knownLevel: Math.max(0, settings.startingKnowledge - 1),
      publicHistory: rng.pick(template.publicHistories),
      hiddenTruth: rng.pick(template.hiddenTruths),
    }
    sites = sites.map((site) => {
      if (!civilization.siteIds.includes(site.id)) return site
      const region = regions.find((entry) => entry.tileIds.includes(site.tileId))
      return {
        ...site,
        civilizationId: civilization.id,
        regionalIdentityId: region?.id,
        origin: `${site.origin}. Объект связан с цивилизацией ${name}.`,
        layers: [...new Set([`${template.era}: ${template.architecture}`, ...site.layers])],
        truth: `${site.truth} ${civilization.hiddenTruth}`,
      }
    })
    return civilization
  })
  const enrichedRegions = regions.map((region) => ({ ...region, siteIds: sites.filter((site) => site.regionalIdentityId === region.id).map((site) => site.id) }))
  void enrichedRegions
  return { world: { ...world, sites }, civilizations }
}

function createArtifacts(seed: string, world: WorldData, settings: WorldGenerationSettings, civilizations: AncientCivilization[]): ArtifactRecord[] {
  const rng = new RNG(`${seed}:content:artifacts`)
  const count = settings.ruinDensity === 'dense' ? 10 : settings.ruinDensity === 'sparse' ? 6 : 8
  const templates = rng.shuffle(ARTIFACT_TEMPLATES).slice(0, count)
  return templates.map((template, index) => {
    const preferredCivilizations = civilizations.filter((civilization) => template.civilizationTags.includes(civilization.templateId))
    const civilization = rng.pick(preferredCivilizations.length ? preferredCivilizations : civilizations)
    const civSites = world.sites.filter((site) => civilization?.siteIds.includes(site.id))
    const preferredSites = civSites.filter((site) => template.preferredSiteTypes.includes(site.type))
    const site = rng.pick(preferredSites.length ? preferredSites : civSites.length ? civSites : world.sites)
    const parts = rng.int(template.parts[0], template.parts[1])
    return {
      id: `artifact-${index + 1}`,
      name: rng.pick(template.names),
      civilizationId: civilization?.id,
      creator: template.creator,
      originalPurpose: template.purpose,
      power: template.power,
      cost: template.cost,
      publicLegend: rng.pick(template.legends),
      hiddenTruth: rng.pick(template.truths),
      currentSiteId: site?.id,
      ownerType: 'lost',
      parts,
      recoveredParts: 0,
      status: rng.bool(0.25) ? 'rumored' : 'lost',
      relatedDiscoveryIds: [],
      knownLevel: settings.startingKnowledge >= 3 && rng.bool(0.35) ? 1 : 0,
    }
  })
}

function targetForStage(rng: RNG, template: StoryStageTemplate, world: WorldData, used: Set<string>, civilization?: AncientCivilization, artifact?: ArtifactRecord): { tileId: string; siteId?: string } {
  const availableSites = world.sites.filter((site) => !used.has(site.id))
  const civSites = world.sites.filter((site) => civilization?.siteIds.includes(site.id) && !used.has(site.id))
  const artifactSite = world.sites.find((site) => site.id === artifact?.currentSiteId)
  let site = template.target === 'artifact_site' ? artifactSite
    : template.target === 'civilization_site' ? rng.pick(civSites.length ? civSites : availableSites)
      : template.target === 'monster_lair' ? rng.pick(world.sites.filter((entry) => entry.type === 'lair' && !used.has(entry.id)))
        : template.target === 'remote_site' ? rng.pick(rng.shuffle(availableSites).sort((a, b) => b.danger - a.danger).slice(0, Math.max(1, Math.ceil(availableSites.length / 3))))
          : undefined
  if (template.target === 'settlement') {
    const settlement = rng.pick(world.settlements.filter((entry) => !entry.isGuildHome && entry.status !== 'ruined'))
    return { tileId: settlement?.tileId ?? world.tiles.find((tile) => tile.biome !== 'ocean')!.id }
  }
  if (!site) site = rng.pick(availableSites.length ? availableSites : world.sites)
  if (site) used.add(site.id)
  return { tileId: site?.tileId ?? world.tiles.find((tile) => tile.biome !== 'ocean')!.id, siteId: site?.id }
}

function instantiateStoryChain(seed: string, template: StoryChainTemplate, index: number, world: WorldData, civilizations: AncientCivilization[], artifacts: ArtifactRecord[]): StoryChain {
  const rng = new RNG(`${seed}:content:story:${template.id}:${index}`)
  const civilization = template.civilizationRequired ? rng.pick(civilizations) : rng.bool(0.55) ? rng.pick(civilizations) : undefined
  const civilizationArtifacts = artifacts.filter((artifact) => artifact.civilizationId === civilization?.id)
  const artifact = template.artifactRequired ? rng.pick(civilizationArtifacts.length ? civilizationArtifacts : artifacts) : rng.bool(0.4) ? rng.pick(civilizationArtifacts.length ? civilizationArtifacts : artifacts) : undefined
  const used = new Set<string>()
  const stages: StoryStage[] = template.stages.map((stage, stageIndex) => {
    const target = targetForStage(rng, stage, world, used, civilization, artifact)
    return {
      id: `${template.id}-stage-${stageIndex + 1}`,
      title: stage.title,
      description: stage.description,
      objectiveType: stage.objectiveType,
      requiredRoles: stage.requiredRoles,
      reward: stage.reward,
      dangerModifier: stage.dangerModifier,
      targetTileId: target.tileId,
      siteId: target.siteId,
      artifactId: stage.target === 'artifact_site' || (artifact && stageIndex === stagesArtifactIndex(template)) ? artifact?.id : undefined,
      civilizationId: civilization?.id,
      status: stageIndex === 0 && template.rarity !== 'legendary' ? 'available' : 'locked',
      completionText: stage.completionText,
    }
  })
  return {
    id: `story-${template.id}`,
    title: template.title,
    summary: template.summary,
    kind: template.kind,
    rarity: template.rarity,
    status: template.rarity === 'legendary' ? 'dormant' : 'active',
    civilizationId: civilization?.id,
    artifactId: artifact?.id,
    stages,
    currentStageIndex: 0,
    flags: {},
  }
}

function stagesArtifactIndex(template: StoryChainTemplate): number {
  const direct = template.stages.findIndex((stage) => stage.target === 'artifact_site' || stage.objectiveType === 'артефакт')
  return direct >= 0 ? direct : template.stages.length - 1
}

function createStoryChains(seed: string, world: WorldData, settings: WorldGenerationSettings, civilizations: AncientCivilization[], artifacts: ArtifactRecord[]): StoryChain[] {
  const rng = new RNG(`${seed}:content:chains`)
  const nonLegendary = STORY_CHAIN_TEMPLATES.filter((template) => template.rarity !== 'legendary')
  const count = settings.mapSize === 'vast' ? 7 : settings.mapSize === 'compact' ? 5 : 6
  const selected = rng.shuffle(nonLegendary).slice(0, count)
  const legendary = rng.pick(STORY_CHAIN_TEMPLATES.filter((template) => template.rarity === 'legendary'))
  return [...selected, legendary].map((template, index) => instantiateStoryChain(seed, template, index, world, civilizations, artifacts))
}

function riskProfile(world: WorldData, tileId: string, modifier: number) {
  const tile = world.tiles.find((entry) => entry.id === tileId)
  const danger = Math.max(1, Math.min(10, (tile?.danger ?? 4) + modifier))
  return {
    route: Math.max(1, Math.min(10, Math.round((tile?.travelCost ?? 2) + danger / 2))),
    combat: danger,
    climate: ['swamp', 'desert', 'tundra', 'ashlands'].includes(tile?.biome ?? '') ? Math.min(10, 5 + modifier) : Math.min(10, 3 + modifier),
    disease: ['swamp', 'ancient_forest'].includes(tile?.biome ?? '') ? Math.min(10, 5 + modifier) : Math.min(10, 2 + modifier),
    politics: tile?.stateId ? Math.min(10, 3 + modifier) : Math.min(10, 5 + modifier),
    magic: Math.min(10, Math.max(1, Math.round((tile?.magic ?? 0.35) * 8 + modifier))),
  }
}

function storyOpportunity(state: GameState, chain: StoryChain, stage: StoryStage): Opportunity {
  return {
    id: `story-opportunity-${chain.id}-${stage.id}`,
    title: `${chain.title}: ${stage.title}`,
    type: stage.objectiveType,
    description: stage.description,
    source: chain.rarity === 'rare' || chain.rarity === 'legendary' ? 'закрытый архив гильдии' : 'связанные свидетельства',
    targetTileId: stage.targetTileId,
    reward: Math.round(stage.reward * (chain.rarity === 'legendary' ? 1.35 : chain.rarity === 'rare' ? 1.18 : 1)),
    deadlineDay: Math.min(360, state.day + (chain.rarity === 'legendary' ? 120 : 75)),
    dangerEstimate: Math.round(Object.values(riskProfile(state.world, stage.targetTileId, stage.dangerModifier)).reduce((sum, value) => sum + value, 0) / 6),
    knowledgeRequirement: Math.max(2, stage.dangerModifier + 2),
    accepted: false,
    requiredRoles: stage.requiredRoles,
    riskProfile: riskProfile(state.world, stage.targetTileId, stage.dangerModifier),
    storyChainId: chain.id,
    storyStageId: stage.id,
    contentTags: ['story', chain.kind, chain.rarity],
  }
}

export function ensureStoryOpportunities(state: GameState): GameState {
  let opportunities = [...state.opportunities]
  let chains = state.storyChains.map((chain) => ({ ...chain, stages: chain.stages.map((stage) => ({ ...stage })) }))
  const outstanding = opportunities.filter((opportunity) => opportunity.storyChainId && !opportunity.accepted && opportunity.deadlineDay >= state.day).length
  let slots = Math.max(0, 3 - outstanding)
  for (const chain of chains) {
    if (slots <= 0 || chain.status !== 'active') continue
    const stage = chain.stages[chain.currentStageIndex]
    if (!stage || !['available', 'active'].includes(stage.status)) continue
    const existing = opportunities.find((entry) => entry.storyChainId === chain.id && entry.storyStageId === stage.id && entry.deadlineDay >= state.day)
    if (existing) {
      stage.opportunityId = existing.id
      if (existing.accepted) stage.status = 'active'
      continue
    }
    const opportunity = storyOpportunity(state, chain, stage)
    opportunities.push(opportunity)
    stage.opportunityId = opportunity.id
    stage.status = 'available'
    slots -= 1
  }
  return { ...state, opportunities, storyChains: chains }
}

export function initializeContentEngine(seed: string, worldInput: WorldData, settings: WorldGenerationSettings) {
  const regionalIdentities = createRegionalIdentities(seed, worldInput)
  const assigned = assignCivilizations(seed, worldInput, settings, regionalIdentities)
  const civilizations = assigned.civilizations
  const artifactsCatalog = createArtifacts(seed, assigned.world, settings, civilizations)
  for (const civilization of civilizations) civilization.artifactIds = artifactsCatalog.filter((artifact) => artifact.civilizationId === civilization.id).map((artifact) => artifact.id)
  const storyChains = createStoryChains(seed, assigned.world, settings, civilizations, artifactsCatalog)
  const regional = regionalIdentities.map((region) => ({ ...region, siteIds: assigned.world.sites.filter((site) => region.tileIds.includes(site.tileId)).map((site) => site.id) }))
  const partial = { world: assigned.world, civilizations, artifactsCatalog, storyChains, regionalIdentities: regional }
  return { ...partial, contentValidation: validateContent(partial) }
}

export function pickContentExpeditionDecision(state: GameState, expedition: Expedition, tile: WorldTile, rng: RNG): ExpeditionDecision | undefined {
  const used = new Set(expedition.contentEventIds ?? [])
  const members = state.characters.filter((character) => expedition.memberIds.includes(character.id))
  const site = tile.siteId ? state.world.sites.find((entry) => entry.id === tile.siteId) : undefined
  const hasArtifactRumor = state.artifactsCatalog.some((artifact) => artifact.currentSiteId === site?.id || (artifact.knownLevel > 0 && artifact.status !== 'recovered'))
  const candidates = EXPEDITION_CONTENT_EVENTS.filter((event) => {
    if (used.has(event.id)) return false
    if (event.biomes && !event.biomes.includes(tile.biome)) return false
    if (event.requiresCivilization && !site?.civilizationId) return false
    if (event.requiresArtifactRumor && !hasArtifactRumor) return false
    if (event.requiredProfessions && !event.requiredProfessions.some((profession) => members.some((member) => member.profession === profession))) return false
    if (event.requiredTraits && !event.requiredTraits.some((trait) => members.some((member) => member.traits.includes(trait)))) return false
    if (event.fearTags && !event.fearTags.some((fear) => members.some((member) => member.fear.includes(fear)))) return false
    return true
  })
  if (!candidates.length || !rng.bool(0.48)) return undefined
  const weighted = candidates.flatMap((event) => Array.from({ length: Math.max(1, event.weight) }, () => event))
  const event = rng.pick(weighted)
  return {
    id: `content-decision-${event.id}-${state.year}-${state.day}-${expedition.id}`,
    contentEventId: event.id,
    expeditionId: expedition.id,
    locationTileId: tile.id,
    title: event.title,
    text: event.text,
    choices: event.choices.map((choice) => ({ ...choice })),
  }
}

function activateRareStory(state: GameState): GameState {
  const dormant = state.storyChains.filter((chain) => chain.status === 'dormant')
  if (!dormant.length || state.guild.rank < 2 || state.discoveries.length < 3) return state
  const rng = new RNG(`${state.seed}:rare-story:${state.year}:${state.day}`)
  if (!rng.bool(state.guild.rank >= 4 ? 0.42 : 0.18)) return state
  const selected = rng.pick(dormant)
  const storyChains = state.storyChains.map((chain) => chain.id === selected.id ? {
    ...chain,
    status: 'active' as const,
    startedYear: state.year,
    startedDay: state.day,
    stages: chain.stages.map((stage, index) => ({ ...stage, status: index === 0 ? 'available' as const : stage.status })),
  } : chain)
  return {
    ...state,
    storyChains,
    chronicle: [...state.chronicle, { id: `chronicle-story-activate-${selected.id}-${state.year}-${state.day}`, year: state.year, day: state.day, title: `Открыта редкая история: ${selected.title}`, text: selected.summary, category: 'discovery', importance: 5 }],
  }
}

export function contentDayTick(state: GameState): GameState {
  let next = state
  if (next.day % 30 === 0) next = ensureStoryOpportunities(next)
  if (next.day % 90 === 0) next = activateRareStory(next)
  if (next.day % 120 === 0) next = { ...next, contentValidation: validateContent(next) }
  return next
}

export function advanceStoryAfterDebrief(state: GameState, expeditionId: string, disposition: DiscoveryDisposition, success: boolean): GameState {
  const expedition = state.expeditions.find((entry) => entry.id === expeditionId)
  if (!expedition?.storyChainId || !expedition.storyStageId) return state
  const chain = state.storyChains.find((entry) => entry.id === expedition.storyChainId)
  if (!chain || chain.status !== 'active') return state
  const stageIndex = chain.stages.findIndex((stage) => stage.id === expedition.storyStageId)
  if (stageIndex < 0) return state
  const current = chain.stages[stageIndex]
  if (!success) {
    return {
      ...state,
      storyChains: state.storyChains.map((entry) => entry.id === chain.id ? { ...entry, stages: entry.stages.map((stage) => stage.id === current.id ? { ...stage, status: 'available' as const, opportunityId: undefined } : stage) } : entry),
    }
  }
  const finalStage = stageIndex >= chain.stages.length - 1
  const endingId = finalStage ? (disposition === 'published' ? 'truth-published' : disposition === 'secret' ? 'truth-buried' : disposition === 'sold' ? 'truth-sold' : 'truth-archived') : undefined
  const storyChains = state.storyChains.map((entry) => {
    if (entry.id !== chain.id) return entry
    return {
      ...entry,
      currentStageIndex: finalStage ? stageIndex : stageIndex + 1,
      status: finalStage ? 'completed' as const : 'active' as const,
      completedYear: finalStage ? state.year : entry.completedYear,
      completedDay: finalStage ? state.day : entry.completedDay,
      endingId: endingId ?? entry.endingId,
      stages: entry.stages.map((stage, index) => index === stageIndex ? { ...stage, status: 'completed' as const } : index === stageIndex + 1 && !finalStage ? { ...stage, status: 'available' as const } : stage),
    }
  })
  const relatedDiscoveries = state.discoveries.filter((discovery) => discovery.expeditionId === expeditionId)
  const artifactsCatalog = state.artifactsCatalog.map((artifact) => {
    if (artifact.id !== current.artifactId && artifact.id !== chain.artifactId) return artifact
    const recoveredParts = finalStage ? artifact.parts : Math.min(artifact.parts, artifact.recoveredParts + 1)
    return {
      ...artifact,
      recoveredParts,
      status: recoveredParts >= artifact.parts ? 'recovered' as const : 'partial' as const,
      ownerType: recoveredParts >= artifact.parts ? 'guild' as const : artifact.ownerType,
      ownerId: recoveredParts >= artifact.parts ? state.guild.name : artifact.ownerId,
      knownLevel: Math.min(5, artifact.knownLevel + 2),
      relatedDiscoveryIds: [...new Set([...artifact.relatedDiscoveryIds, ...relatedDiscoveries.map((discovery) => discovery.id)])],
    }
  })
  const civilizations = state.civilizations.map((civilization) => civilization.id === (current.civilizationId ?? chain.civilizationId) ? { ...civilization, knownLevel: Math.min(5, civilization.knownLevel + (finalStage ? 2 : 1)) } : civilization)
  let next: GameState = {
    ...state,
    storyChains,
    artifactsCatalog,
    civilizations,
    chronicle: [...state.chronicle, {
      id: `chronicle-story-stage-${chain.id}-${current.id}-${state.year}-${state.day}`,
      year: state.year,
      day: state.day,
      title: finalStage ? `Завершена история: ${chain.title}` : current.title,
      text: finalStage ? `${current.completionText} Итог: ${endingId}.` : current.completionText,
      category: 'discovery',
      importance: finalStage ? 5 : 3,
    }],
  }
  next = ensureStoryOpportunities(next)
  return { ...next, contentValidation: validateContent(next) }
}

export function validateContent(content: Pick<GameState, 'world' | 'civilizations' | 'artifactsCatalog' | 'storyChains' | 'regionalIdentities'>): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = []
  const siteIds = new Set(content.world.sites.map((site) => site.id))
  const tileIds = new Set(content.world.tiles.map((tile) => tile.id))
  const civIds = new Set(content.civilizations.map((civilization) => civilization.id))
  const artifactIds = new Set(content.artifactsCatalog.map((artifact) => artifact.id))
  for (const civilization of content.civilizations) {
    if (civilization.siteIds.length === 0) issues.push({ id: `civ-empty-${civilization.id}`, severity: 'error', sourceType: 'civilization', sourceId: civilization.id, message: 'У цивилизации нет связанных мест.' })
    for (const siteId of civilization.siteIds) if (!siteIds.has(siteId)) issues.push({ id: `civ-site-${civilization.id}-${siteId}`, severity: 'error', sourceType: 'civilization', sourceId: civilization.id, message: `Не найдено место ${siteId}.` })
  }
  for (const artifact of content.artifactsCatalog) {
    if (artifact.civilizationId && !civIds.has(artifact.civilizationId)) issues.push({ id: `artifact-civ-${artifact.id}`, severity: 'error', sourceType: 'artifact', sourceId: artifact.id, message: 'Связанная цивилизация отсутствует.' })
    if (artifact.currentSiteId && !siteIds.has(artifact.currentSiteId)) issues.push({ id: `artifact-site-${artifact.id}`, severity: 'error', sourceType: 'artifact', sourceId: artifact.id, message: 'Текущее место артефакта отсутствует.' })
    if (artifact.parts < 1 || artifact.recoveredParts > artifact.parts) issues.push({ id: `artifact-parts-${artifact.id}`, severity: 'error', sourceType: 'artifact', sourceId: artifact.id, message: 'Некорректное число частей артефакта.' })
  }
  for (const chain of content.storyChains) {
    if (chain.civilizationId && !civIds.has(chain.civilizationId)) issues.push({ id: `story-civ-${chain.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'Связанная цивилизация истории отсутствует.' })
    if (chain.artifactId && !artifactIds.has(chain.artifactId)) issues.push({ id: `story-main-artifact-${chain.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'Главный артефакт истории отсутствует.' })
    if (!chain.stages.length) issues.push({ id: `story-empty-${chain.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'История не содержит этапов.' })
    const stageIds = new Set<string>()
    for (const stage of chain.stages) {
      if (stageIds.has(stage.id)) issues.push({ id: `story-duplicate-${chain.id}-${stage.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: `Повторяющийся этап ${stage.id}.` })
      stageIds.add(stage.id)
      if (!tileIds.has(stage.targetTileId)) issues.push({ id: `story-tile-${chain.id}-${stage.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'Целевая клетка этапа отсутствует.' })
      if (stage.siteId && !siteIds.has(stage.siteId)) issues.push({ id: `story-site-${chain.id}-${stage.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'Целевое место этапа отсутствует.' })
      if (stage.artifactId && !artifactIds.has(stage.artifactId)) issues.push({ id: `story-artifact-${chain.id}-${stage.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'Связанный артефакт отсутствует.' })
    }
    if (chain.currentStageIndex < 0 || chain.currentStageIndex >= chain.stages.length) issues.push({ id: `story-index-${chain.id}`, severity: 'error', sourceType: 'story', sourceId: chain.id, message: 'Текущий этап истории вне диапазона.' })
  }
  for (const region of content.regionalIdentities) {
    if (!tileIds.has(region.centerTileId)) issues.push({ id: `region-center-${region.id}`, severity: 'error', sourceType: 'region', sourceId: region.id, message: 'Центр региона отсутствует.' })
    if (!region.tileIds.length) issues.push({ id: `region-empty-${region.id}`, severity: 'warning', sourceType: 'region', sourceId: region.id, message: 'Регион не содержит клеток.' })
  }
  return issues
}
