import type { Character, GameState, GuildPosition } from '../types/game'
import { DEFAULT_WORLD_SETTINGS } from './worldSettings'

const SAVE_KEY = 'last-guild-save-v4'
const LEGACY_KEYS = ['last-guild-save-v3', 'last-guild-save-v2']

const defaultPositions = (): GuildPosition[] => [
  { id: 'expedition_master', name: 'Мастер экспедиций', description: 'Отвечает за составы, маршруты и дисциплину.', effect: '+5 к слаженности новых отрядов' },
  { id: 'chief_archivist', name: 'Главный архивист', description: 'Проверяет отчёты и качество доказательств.', effect: '+10 к качеству открытий' },
  { id: 'quartermaster', name: 'Квартмейстер', description: 'Контролирует склад и закупки.', effect: '−8% месячных расходов' },
  { id: 'chief_healer', name: 'Главный лекарь', description: 'Руководит лечением и реабилитацией.', effect: '+35% скорость восстановления' },
  { id: 'mentor', name: 'Наставник новичков', description: 'Передаёт опыт молодому составу.', effect: '+20% опыта после экспедиций' },
  { id: 'diplomat', name: 'Дипломат гильдии', description: 'Работает с властями и заказчиками.', effect: '+2 репутации при публикации' },
]

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

function normalizeCharacter(character: any, state: any): Character {
  const stage = character.careerStage ?? (character.fame >= 50 ? 'legend' : character.expeditions >= 7 ? 'veteran' : character.expeditions >= 2 ? 'field' : 'recruit')
  return {
    ...character,
    origin: character.origin ?? 'Происхождение не записано',
    homeSettlementId: character.homeSettlementId ?? state.world?.startSettlementId ?? '',
    experience: character.experience ?? (character.level ?? 1) * 35,
    careerStage: stage,
    injuries: character.injuries ?? [],
    injuryRecords: character.injuryRecords ?? (character.injuries ?? []).map((name: string, index: number) => ({
      id: `legacy-injury-${character.id}-${index}`,
      name,
      severity: 2,
      permanent: true,
      recoveryDays: 0,
      effect: 'Старая травма',
      treated: true,
    })),
    relationships: character.relationships ?? {},
    memories: (character.memories ?? []).map((memory: any, index: number) => ({
      id: memory.id ?? `legacy-memory-${character.id}-${index}`,
      title: memory.title ?? 'Старое воспоминание',
      description: memory.description ?? memory.title ?? 'Подробности утрачены.',
      intensity: memory.intensity ?? 45,
      valence: memory.valence ?? 'mixed',
      type: memory.type ?? 'expedition',
      year: memory.year ?? state.year ?? 912,
      day: memory.day ?? 1,
      expeditionId: memory.expeditionId,
      relatedCharacterIds: memory.relatedCharacterIds ?? [],
    })),
  } as Character
}

function normalizeState(parsed: any): GameState | null {
  if (!parsed || ![2, 3, 4].includes(parsed.version)) return null
  const settings = { ...DEFAULT_WORLD_SETTINGS, ...(parsed.settings ?? {}) }
  const normalized: GameState = {
    ...parsed,
    version: 4,
    settings,
    pendingDecision: parsed.pendingDecision,
    pendingDebrief: parsed.pendingDebrief,
    discoveries: parsed.discoveries ?? [],
    consequences: parsed.consequences ?? [],
    guild: {
      ...parsed.guild,
      positions: parsed.guild?.positions ?? defaultPositions(),
    },
    world: {
      ...parsed.world,
      routes: parsed.world?.routes ?? [],
      tiles: (parsed.world?.tiles ?? []).map((tile: any) => ({ ...tile, magic: tile.magic ?? 0.35, hasRoad: tile.hasRoad ?? false, hasRiver: tile.hasRiver ?? false })),
      realms: (parsed.world?.realms ?? []).map((realm: any) => ({ ...realm, dominantFaith: realm.dominantFaith ?? 'местные культы', currentIssue: realm.currentIssue ?? 'пограничные споры', relations: realm.relations ?? {} })),
      sites: (parsed.world?.sites ?? []).map((site: any) => ({ ...site, layers: site.layers ?? ['первоначальный комплекс', 'следы поздних обитателей'] })),
    },
    characters: (parsed.characters ?? []).map((character: any) => normalizeCharacter(character, parsed)),
    opportunities: (parsed.opportunities ?? []).map((opportunity: any) => ({
      ...opportunity,
      requiredRoles: opportunity.requiredRoles ?? ['Следопыт'],
      riskProfile: opportunity.riskProfile ?? { route: opportunity.dangerEstimate, combat: opportunity.dangerEstimate, climate: 3, disease: 3, politics: 2, magic: 3 },
    })),
    expeditions: (parsed.expeditions ?? []).map((expedition: any) => ({
      ...expedition,
      riskProfile: expedition.riskProfile ?? { route: 4, combat: 4, climate: 3, disease: 3, politics: 2, magic: 3 },
      reports: expedition.reports ?? [],
    })),
  }
  return normalized
}

export function loadGame(): GameState | null {
  for (const key of [SAVE_KEY, ...LEGACY_KEYS]) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      const normalized = normalizeState(JSON.parse(raw))
      if (normalized) {
        saveGame(normalized)
        return normalized
      }
    } catch { /* corrupted save: try older slot */ }
  }
  return null
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
  for (const key of LEGACY_KEYS) localStorage.removeItem(key)
}
