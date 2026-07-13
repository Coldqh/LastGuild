import type { CharacterInjuryRecord, DungeonExploration, GameState } from '../types/game'
import { RNG } from './rng'
import { startCombatEncounter } from './combat'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function startDungeonExploration(state: GameState, expeditionId: string, siteId: string): GameState {
  if (state.pendingDungeon) return state
  const expedition = state.expeditions.find((candidate) => candidate.id === expeditionId)
  const site = state.world.sites.find((candidate) => candidate.id === siteId)
  if (!expedition || !site || !site.zones.length) return state
  const entry = site.zones.find((zone) => zone.kind === 'entrance') ?? site.zones[0]
  const pendingDungeon: DungeonExploration = {
    id: `dungeon-${expeditionId}-${siteId}-${state.day}`,
    expeditionId,
    siteId,
    currentZoneId: entry.id,
    discoveredZoneIds: Array.from(new Set([entry.id, ...site.zones.filter((zone) => zone.explored).map((zone) => zone.id)])),
    securedZoneIds: site.zones.filter((zone) => zone.secured).map((zone) => zone.id),
    logs: [`Отряд вошёл в ${site.name}. Разведан вход и выбран путь вглубь.`],
  }
  return {
    ...state,
    pendingDungeon,
    expeditions: state.expeditions.map((candidate) => candidate.id === expedition.id ? {
      ...candidate,
      dungeonSiteIds: Array.from(new Set([...candidate.dungeonSiteIds, siteId])),
      logs: [...candidate.logs, { day: state.day, title: `Вход в ${site.name}`, text: 'Начато поэтапное исследование подземелья.', type: 'discovery' }],
    } : candidate),
  }
}

function trapInjury(rng: RNG, expeditionId: string, trap: string, danger: number): CharacterInjuryRecord {
  const severity = clamp(Math.ceil(danger / 2), 1, 5) as 1 | 2 | 3 | 4 | 5
  return {
    id: `injury-dungeon-${expeditionId}-${rng.int(1000, 999999)}`,
    name: `${trap}: травма в подземелье`,
    severity,
    permanent: severity >= 4 && rng.bool(0.45),
    recoveryDays: severity * rng.int(6, 12),
    effect: 'снижение полевой эффективности до лечения',
    sourceExpeditionId: expeditionId,
    treated: false,
  }
}

export function exploreDungeonZone(state: GameState, zoneId: string): GameState {
  const dungeon = state.pendingDungeon
  if (!dungeon || state.pendingCombat) return state
  const site = state.world.sites.find((candidate) => candidate.id === dungeon.siteId)
  const expedition = state.expeditions.find((candidate) => candidate.id === dungeon.expeditionId)
  const zone = site?.zones.find((candidate) => candidate.id === zoneId)
  if (!site || !expedition || !zone) return state
  const current = site.zones.find((candidate) => candidate.id === dungeon.currentZoneId)
  const accessible = dungeon.discoveredZoneIds.includes(zone.id) || current?.connections.includes(zone.id)
  if (!accessible) return state

  const rng = new RNG(`${state.seed}:${dungeon.id}:${zone.id}:${state.day}`)
  const members = state.characters.filter((character) => expedition.memberIds.includes(character.id) && character.status === 'expedition')
  const knowledge = members.length
    ? members.reduce((sum, member) => sum + Math.max(member.skills.history, member.skills.scouting, member.skills.arcana), 0) / members.length
    : 0
  const success = knowledge + rng.float(-2, 3) >= zone.danger
  let characters = state.characters
  let medicineLoss = 0
  let moraleShift = success ? 4 : -8
  const logs = [...dungeon.logs]

  if (zone.trap && rng.bool(success ? 0.18 : 0.62) && members.length) {
    const victim = rng.pick(members)
    const injury = trapInjury(rng, expedition.id, zone.trap, zone.danger)
    medicineLoss = 2
    moraleShift -= 5
    characters = characters.map((character) => character.id === victim.id ? {
      ...character,
      health: Math.max(5, character.health - zone.danger * 3),
      injuryRecords: [...character.injuryRecords, injury].slice(-14),
      injuries: [...character.injuries, injury.name].slice(-10),
    } : character)
    logs.push(`${victim.name} попал под угрозу «${zone.trap}» и получил травму.`)
  }

  logs.push(success
    ? `Зона «${zone.name}» исследована. Обнаружено: ${zone.rewards.join(', ')}.`
    : `Исследование зоны «${zone.name}» сорвалось. Отряд потерял время и ресурсы.`)
  const discoveredZoneIds = Array.from(new Set([...dungeon.discoveredZoneIds, zone.id, ...(success ? zone.connections : [])]))
  const securedZoneIds = Array.from(new Set([...dungeon.securedZoneIds, ...(success && !zone.guardSpeciesId ? [zone.id] : [])]))
  const exploredCount = site.zones.filter((candidate) => candidate.explored || candidate.id === zone.id).length
  const exploration = Math.round((exploredCount / site.zones.length) * 100)

  let next: GameState = {
    ...state,
    characters,
    pendingDungeon: { ...dungeon, currentZoneId: zone.id, discoveredZoneIds, securedZoneIds, logs: logs.slice(-20) },
    world: {
      ...state.world,
      sites: state.world.sites.map((candidate) => candidate.id === site.id ? {
        ...candidate,
        exploration,
        state: exploration >= 100 ? 'surveyed' : exploration >= 35 ? 'discovered' : candidate.state,
        zones: candidate.zones.map((entry) => entry.id === zone.id ? { ...entry, explored: true, secured: entry.secured || (success && !entry.guardSpeciesId) } : entry),
      } : candidate),
    },
    expeditions: state.expeditions.map((candidate) => candidate.id === expedition.id ? {
      ...candidate,
      food: Math.max(0, candidate.food - (success ? 2 : 5)),
      medicine: Math.max(0, candidate.medicine - medicineLoss),
      morale: clamp(candidate.morale + moraleShift, 0, 100),
      discoveries: success && !candidate.discoveries.includes(site.id) ? [...candidate.discoveries, site.id] : candidate.discoveries,
      logs: [...candidate.logs, { day: state.day, title: zone.name, text: logs.at(-1)!, type: success ? 'discovery' : 'event' }],
    } : candidate),
  }

  if (zone.guardSpeciesId) {
    next = startCombatEncounter(next, {
      expeditionId: expedition.id,
      tileId: site.tileId,
      source: 'dungeon_zone',
      speciesId: zone.guardSpeciesId,
      siteId: site.id,
      zoneId: zone.id,
      advantage: success ? 1 : -1,
    })
  }
  return next
}

export function establishDungeonCamp(state: GameState): GameState {
  const dungeon = state.pendingDungeon
  if (!dungeon) return state
  const site = state.world.sites.find((candidate) => candidate.id === dungeon.siteId)
  const expedition = state.expeditions.find((candidate) => candidate.id === dungeon.expeditionId)
  if (!site || !expedition || dungeon.securedZoneIds.length < 2 || site.campEstablished) return state
  return {
    ...state,
    pendingDungeon: { ...dungeon, logs: [...dungeon.logs, 'Создан укреплённый базовый лагерь. Следующие походы смогут начать глубже.'].slice(-20) },
    world: { ...state.world, sites: state.world.sites.map((candidate) => candidate.id === site.id ? { ...candidate, campEstablished: true } : candidate) },
    expeditions: state.expeditions.map((candidate) => candidate.id === expedition.id ? {
      ...candidate,
      food: Math.max(0, candidate.food - 6),
      morale: Math.min(100, candidate.morale + 10),
      logs: [...candidate.logs, { day: state.day, title: 'Базовый лагерь', text: `Внутри ${site.name} создана безопасная точка снабжения.`, type: 'report' }],
    } : candidate),
  }
}

export function leaveDungeon(state: GameState): GameState {
  const dungeon = state.pendingDungeon
  if (!dungeon) return state
  const site = state.world.sites.find((candidate) => candidate.id === dungeon.siteId)
  return {
    ...state,
    pendingDungeon: undefined,
    expeditions: state.expeditions.map((candidate) => candidate.id === dungeon.expeditionId ? {
      ...candidate,
      progress: candidate.progress + 0.25,
      logs: [...candidate.logs, { day: state.day, title: `Выход из ${site?.name ?? 'подземелья'}`, text: `Исследовано ${site?.exploration ?? 0}% комплекса. Отряд вернулся к основному маршруту.`, type: 'report' }],
    } : candidate),
  }
}
