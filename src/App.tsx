import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  FastForward,
  Map,
  Menu,
  Network,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react'
import ArchiveView from './components/ArchiveView'
import CombatModal from './components/CombatModal'
import CommandCenter from './components/CommandCenter'
import DungeonExplorationModal from './components/DungeonExplorationModal'
import ExpeditionDebriefModal from './components/ExpeditionDebriefModal'
import ExpeditionDecisionModal from './components/ExpeditionDecisionModal'
import ExpeditionPlanner from './components/ExpeditionPlanner'
import GuildView from './components/GuildView'
import InfluenceView from './components/InfluenceView'
import RosterView from './components/RosterView'
import SettingsModal from './components/SettingsModal'
import TutorialPanel from './components/TutorialPanel'
import WorldMap from './components/WorldMap'
import WorldSetupModal from './components/WorldSetupModal'
import { createNewGame } from './game/gameFactory'
import {
  advanceDays,
  assignGuildPosition,
  createExpeditionFromDraft,
  dismissCharacter,
  hireCharacter,
  payDebt,
  resolveExpeditionDebrief,
  resolveExpeditionDecision,
  upgradeRoom,
  type DebriefResolution,
  type ExpeditionDraft,
} from './game/simulation'
import { clearSave, loadGame, saveGame } from './game/storage'
import { autoResolveCombat, finalizeCombat, issueCombatCommand, stepCombat } from './game/combat'
import { establishDungeonCamp, exploreDungeonZone, leaveDungeon } from './game/dungeon'
import { DEFAULT_WORLD_SETTINGS, DIFFICULTY_RULES } from './game/worldSettings'
import { appointGuildLeader, assignMentorship, changeBranchAutonomy, conductRivalAction, createStrategicLayer, openBranch, respondToCrisis } from './game/strategy'
import { loadPreferences, savePreferences, type AppPreferences } from './game/preferences'
import type { TutorialStepId } from './game/onboarding'
import type { BranchAutonomy, BranchSpecialization, CharacterSkills, CombatCommandType, GameState, GuildPositionId, ViewId, WorldGenerationSettings } from './types/game'

const views: Array<{ id: ViewId; label: string; icon: typeof Building2 }> = [
  { id: 'headquarters', label: 'Штаб', icon: Building2 },
  { id: 'world', label: 'Карта мира', icon: Map },
  { id: 'roster', label: 'Персонажи', icon: Users },
  { id: 'expeditions', label: 'Экспедиции', icon: Compass },
  { id: 'archive', label: 'Архив', icon: BookOpen },
  { id: 'influence', label: 'Влияние', icon: Network },
]

const seasons = ['Зима', 'Весна', 'Лето', 'Осень']
const TUTORIAL_KEY = 'last-guild-tutorial-v1'

function applyCompetitors(state: GameState, enabled: boolean): GameState {
  if (!enabled) return {
    ...state,
    rivalGuilds: [],
    rivalExpeditions: [],
    opportunities: state.opportunities.map((entry) => ({ ...entry, contestedByIds: [] })),
  }
  if (state.rivalGuilds.length) return state
  const strategic = createStrategicLayer(state.seed, state.world, state.characters)
  return { ...state, rivalGuilds: strategic.rivalGuilds, rivalExpeditions: [] }
}

function initialState(): GameState {
  const preferences = loadPreferences()
  return applyCompetitors(loadGame() ?? createNewGame('last-guild-demo', DEFAULT_WORLD_SETTINGS), preferences.competitorsEnabled)
}

function loadTutorialProgress(): TutorialStepId[] {
  try { return JSON.parse(localStorage.getItem(TUTORIAL_KEY) ?? '[]') } catch { return [] }
}

export default function App() {
  const [state, setState] = useState<GameState>(initialState)
  const [view, setView] = useState<ViewId>('headquarters')
  const [menuOpen, setMenuOpen] = useState(false)
  const [seedModal, setSeedModal] = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
  const [seedInput, setSeedInput] = useState('')
  const [worldSettings, setWorldSettings] = useState<WorldGenerationSettings>({ ...DEFAULT_WORLD_SETTINGS })
  const [savePulse, setSavePulse] = useState(false)
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences)
  const [tutorialCompleted, setTutorialCompleted] = useState<TutorialStepId[]>(loadTutorialProgress)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveGame(state)
      setSavePulse(true)
      window.setTimeout(() => setSavePulse(false), 900)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (!tutorialCompleted.includes('headquarters')) {
      setTutorialCompleted((steps) => [...steps, 'headquarters'])
    }
  }, [tutorialCompleted])

  useEffect(() => { localStorage.setItem(TUTORIAL_KEY, JSON.stringify(tutorialCompleted)) }, [tutorialCompleted])

  const markTutorial = (step: TutorialStepId) => setTutorialCompleted((steps) => steps.includes(step) ? steps : [...steps, step])
  const activeExpeditions = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning')
  const urgentCount = useMemo(() => {
    const expiring = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay - state.day <= 8).length
    const injured = state.characters.filter((character) => character.status === 'recovering' && character.health < 45).length
    return expiring + injured + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0)
  }, [state])

  const timeBlocked = Boolean(state.pendingDecision || state.pendingDebrief || state.pendingCombat || state.pendingDungeon)
  const blockedReason = state.pendingCombat ? 'бой' : state.pendingDecision ? 'решение экспедиции' : state.pendingDungeon ? 'подземелье' : state.pendingDebrief ? 'разбор возвращения' : ''

  const changeView = (next: ViewId) => {
    setView(next)
    setMenuOpen(false)
    if (next === 'roster') markTutorial('roster')
    if (next === 'expeditions') markTutorial('expeditions')
  }

  const advance = (days: number) => {
    markTutorial('time')
    setState((current) => advanceDays(current, days))
  }

  const advanceUntilEvent = () => {
    markTutorial('time')
    setState((current) => {
      let next = current
      for (let index = 0; index < 30; index += 1) {
        if (next.pendingDecision || next.pendingDebrief || next.pendingCombat || next.pendingDungeon) break
        next = advanceDays(next, 1)
      }
      return next
    })
  }

  const launch = (draft: ExpeditionDraft) => { markTutorial('launch'); setState((current) => createExpeditionFromDraft(current, draft)) }
  const resolveDebrief = (resolution: DebriefResolution) => { markTutorial('debrief'); setState((current) => resolveExpeditionDebrief(current, resolution)) }
  const assignPosition = (positionId: GuildPositionId, holderId?: string) => setState((current) => assignGuildPosition(current, positionId, holderId))
  const combatCommand = (command: CombatCommandType, targetId?: string) => setState((current) => issueCombatCommand(current, command, targetId))
  const rivalAction = (rivalId: string, action: 'cooperate' | 'exchange' | 'pressure') => setState((current) => conductRivalAction(current, rivalId, action))
  const createBranch = (settlementId: string, leaderId: string, specialization: BranchSpecialization, autonomy: BranchAutonomy) => setState((current) => openBranch(current, settlementId, leaderId, specialization, autonomy))
  const setBranchAutonomy = (branchId: string, autonomy: BranchAutonomy) => setState((current) => changeBranchAutonomy(current, branchId, autonomy))
  const crisisResponse = (crisisId: string, mode: 'fund' | 'expedition' | 'neutral') => setState((current) => respondToCrisis(current, crisisId, mode))
  const mentorship = (mentorId: string, apprenticeId: string, skill: keyof CharacterSkills) => setState((current) => assignMentorship(current, mentorId, apprenticeId, skill))
  const appointLeader = (characterId: string) => setState((current) => appointGuildLeader(current, characterId))

  const updatePreferences = (next: AppPreferences) => {
    setPreferences(next)
    savePreferences(next)
    setState((current) => applyCompetitors(current, next.competitorsEnabled))
    if (!next.tutorialEnabled) setTutorialCompleted([])
  }

  const openWorldSetup = () => {
    setWorldSettings({ ...state.settings })
    setSeedInput('')
    setSettingsModal(false)
    setSeedModal(true)
  }

  const createWorld = () => {
    const next = applyCompetitors(createNewGame(seedInput || undefined, worldSettings), preferences.competitorsEnabled)
    clearSave()
    setState(next)
    setTutorialCompleted([])
    setView('headquarters')
    setSeedModal(false)
    setSeedInput('')
  }

  const forceUpdate = async () => {
    saveGame(state)
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys()
        await Promise.all(keys.map((cacheKey) => window.caches.delete(cacheKey)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(async (registration) => {
          try { await registration.update(); await registration.unregister() } catch { /* stale worker must not block refresh */ }
        }))
      }
    } finally {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('force-update', Date.now().toString())
      window.location.replace(nextUrl.toString())
    }
  }

  const renderView = () => {
    switch (view) {
      case 'world': return <WorldMap state={state} />
      case 'roster': return <RosterView state={state} onHire={(characterId) => { markTutorial('hire'); setState((current) => hireCharacter(current, characterId)) }} onDismiss={(characterId) => setState((current) => dismissCharacter(current, characterId))} />
      case 'expeditions': return <ExpeditionPlanner state={state} onLaunch={launch} />
      case 'archive': return <ArchiveView state={state} />
      case 'influence': return <InfluenceView state={state} onRivalAction={rivalAction} onOpenBranch={createBranch} onChangeBranchAutonomy={setBranchAutonomy} onRespondCrisis={crisisResponse} onAssignMentorship={mentorship} onAppointLeader={appointLeader} />
      default: return <>{preferences.decisionCenterEnabled && <CommandCenter state={state} onNavigate={changeView} />}<GuildView state={state} onUpgrade={(roomId) => { markTutorial('upgrade'); setState((current) => upgradeRoom(current, roomId)) }} onPayDebt={(amount) => setState((current) => payDebt(current, amount))} onAssignPosition={assignPosition} /></>
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Shield size={26} /><Swords size={14} /></div>
          <div><strong>THE LAST GUILD</strong><span>Экспедиционный архив</span></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)}><X /></button>
        </div>

        <nav>
          {views.map((item) => {
            const Icon = item.icon
            const badge = item.id === 'expeditions'
              ? activeExpeditions.length + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0)
              : item.id === 'influence'
                ? state.crises.filter((crisis) => crisis.status === 'active').length + (preferences.competitorsEnabled ? state.rivalExpeditions.filter((expedition) => ['preparing', 'traveling'].includes(expedition.status)).length : 0)
                : item.id === 'headquarters' && urgentCount ? urgentCount : 0
            return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)}><Icon size={19} /><span>{item.label}</span>{badge > 0 && <b>{badge}</b>}<ChevronRight className="nav-arrow" size={15} /></button>
          })}
        </nav>

        <div className="sidebar-world">
          <p className="eyebrow">Текущий мир</p>
          <strong>{state.seed}</strong>
          <span>{state.world.realms.length} государства · {preferences.competitorsEnabled ? `${state.rivalGuilds.length} конкурентов` : 'без конкурентов'}</span>
          <span>{state.settings.preset} · {DIFFICULTY_RULES[state.settings.difficulty].label}</span>
          <button className="text-button" onClick={openWorldSetup}><RotateCcw size={15} />Новый мир</button>
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-settings-button" onClick={() => setSettingsModal(true)}><SettingsIcon size={15} />Настройки</button>
          <span className={`save-indicator ${savePulse ? 'pulse' : ''}`}><Save size={14} />{savePulse ? 'Сохранено' : 'Автосохранение'}</span>
          <small>v0.5.1 · Core Loop & UX</small>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)}><Menu /></button>
          <div className="topbar-date"><CalendarDays size={18} /><div><strong>{state.year} год · день {state.day}</strong><span>{seasons[state.season]}</span></div></div>
          <div className="time-controls">
            <Clock3 size={17} />
            <button disabled={timeBlocked} onClick={() => advance(1)}>+1 день</button>
            <button disabled={timeBlocked} onClick={() => advance(7)}>+7 дней</button>
            <button disabled={timeBlocked} onClick={() => advance(30)}>+30 дней</button>
            <button disabled={timeBlocked} onClick={advanceUntilEvent}><FastForward size={14} />До события</button>
          </div>
          {timeBlocked && <span className="time-blocked">Время остановлено: {blockedReason}</span>}
          <div className="topbar-resources">
            <span><b>{state.guild.treasury}</b> крон</span>
            <span><b>{state.guild.supplies}</b> припасов</span>
            <span className={state.guild.debt > state.guild.treasury * 2 ? 'danger-text' : ''}><b>{state.guild.debt}</b> долг</span>
          </div>
          <button className="topbar-settings" title="Настройки" onClick={() => setSettingsModal(true)}><SettingsIcon size={18} /></button>
        </header>
        <main>{renderView()}</main>
      </div>

      {preferences.tutorialEnabled && <TutorialPanel completed={tutorialCompleted} onNavigate={changeView} onDismiss={() => updatePreferences({ ...preferences, tutorialEnabled: false })} />}
      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      {seedModal && <WorldSetupModal settings={worldSettings} seed={seedInput} onSeedChange={setSeedInput} onSettingsChange={setWorldSettings} onClose={() => setSeedModal(false)} onCreate={createWorld} />}
      {settingsModal && <SettingsModal state={state} preferences={preferences} onPreferencesChange={updatePreferences} onLoadState={(next) => setState(applyCompetitors(next, preferences.competitorsEnabled))} onClose={() => setSettingsModal(false)} onNewWorld={openWorldSetup} onForceUpdate={forceUpdate} />}
      {state.pendingDecision && <ExpeditionDecisionModal decision={state.pendingDecision} state={state} onChoose={(choiceId) => setState((current) => resolveExpeditionDecision(current, choiceId))} />}
      {state.pendingDebrief && <ExpeditionDebriefModal debrief={state.pendingDebrief} state={state} onResolve={resolveDebrief} />}
      {state.pendingDungeon && <DungeonExplorationModal state={state} onExplore={(zoneId) => setState((current) => exploreDungeonZone(current, zoneId))} onCamp={() => setState((current) => establishDungeonCamp(current))} onLeave={() => setState((current) => leaveDungeon(current))} />}
      {state.pendingCombat && <CombatModal state={state} onStep={() => setState((current) => stepCombat(current))} onAuto={() => setState((current) => autoResolveCombat(current))} onCommand={combatCommand} onFinalize={() => setState((current) => finalizeCombat(current))} />}
    </div>
  )
}
