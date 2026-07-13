import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  FastForward,
  Gavel,
  GraduationCap,
  Hammer,
  History,
  Map,
  Landmark,
  Menu,
  Network,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Swords,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import CommandCenter from './components/CommandCenter'
import TutorialPanel from './components/TutorialPanel'

const ArchiveView = lazy(() => import('./components/ArchiveView'))
const CombatModal = lazy(() => import('./components/CombatModal'))
const DungeonExplorationModal = lazy(() => import('./components/DungeonExplorationModal'))
const ExpeditionDebriefModal = lazy(() => import('./components/ExpeditionDebriefModal'))
const ExpeditionDecisionModal = lazy(() => import('./components/ExpeditionDecisionModal'))
const ExpeditionPlanner = lazy(() => import('./components/ExpeditionPlanner'))
const ActiveExpeditionsView = lazy(() => import('./components/ActiveExpeditionsView'))
const GuildView = lazy(() => import('./components/GuildView'))
const HiringPanel = lazy(() => import('./components/HiringPanel'))
const RoomsView = lazy(() => import('./components/RoomsView'))
const PositionsView = lazy(() => import('./components/PositionsView'))
const AcademyPanel = lazy(() => import('./components/AcademyPanel'))
const CouncilPanel = lazy(() => import('./components/CouncilPanel'))
const LegacyView = lazy(() => import('./components/LegacyView'))
const InfluenceView = lazy(() => import('./components/InfluenceView'))
const LivingWorldView = lazy(() => import('./components/LivingWorldView'))
const RosterView = lazy(() => import('./components/RosterView'))
const SettingsModal = lazy(() => import('./components/SettingsModal'))
const WorldMap = lazy(() => import('./components/WorldMap'))
const WorldSetupModal = lazy(() => import('./components/WorldSetupModal'))
import { createNewGame } from './game/gameFactory'
import {
  advanceDays,
  advanceUntilEvent,
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
import { appointCouncilSeat, assignAcademyMentor, changeGuildCharter, createGuildMemorial, enrollAcademyStudent, foundGuildDoctrine, graduateAcademyStudent, holdAcademyExam, resolveCouncilProposal, upgradeGuildAcademy } from './game/guildPolitics'
import { loadPreferences, savePreferences, type AppPreferences } from './game/preferences'
import type { TutorialStepId } from './game/onboarding'
import type { AcademyProgramId, BranchAutonomy, BranchSpecialization, CharacterSkills, CombatCommandType, CouncilVoteChoice, GameState, GuildCharter, GuildMemorial, GuildPositionId, ViewId, WorldGenerationSettings } from './types/game'

const viewGroups: Array<{ label: string; items: Array<{ id: ViewId; label: string; icon: typeof Building2 }> }> = [
  { label: 'Гильдия', items: [
    { id: 'headquarters', label: 'Штаб', icon: Building2 },
    { id: 'hiring', label: 'Наём', icon: UserPlus },
    { id: 'roster', label: 'Персонажи', icon: Users },
    { id: 'rooms', label: 'Помещения', icon: Hammer },
    { id: 'positions', label: 'Должности', icon: BriefcaseBusiness },
    { id: 'academy', label: 'Академия', icon: GraduationCap },
    { id: 'council', label: 'Совет', icon: Gavel },
    { id: 'legacy', label: 'Наследие', icon: History },
  ] },
  { label: 'Экспедиции', items: [
    { id: 'world', label: 'Карта мира', icon: Map },
    { id: 'expeditions', label: 'Контракты', icon: Compass },
    { id: 'active_expeditions', label: 'Активные походы', icon: Activity },
    { id: 'archive', label: 'Архив', icon: BookOpen },
  ] },
  { label: 'Мир', items: [
    { id: 'influence', label: 'Влияние', icon: Network },
    { id: 'living_world', label: 'Живой мир', icon: Landmark },
  ] },
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

  useEffect(() => {
    document.body.classList.toggle('compact-ui', preferences.compactCardsEnabled)
    return () => document.body.classList.remove('compact-ui')
  }, [preferences.compactCardsEnabled])

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
    if (next === 'expeditions' || next === 'active_expeditions') markTutorial('expeditions')
  }

  const advance = (days: number) => {
    markTutorial('time')
    setState((current) => advanceDays(current, days))
  }

  const runUntilEvent = () => {
    markTutorial('time')
    setState((current) => advanceUntilEvent(current, 120))
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
  const hireFromHeadquarters = (characterId: string) => { markTutorial('hire'); setState((current) => hireCharacter(current, characterId)) }
  const enrollStudent = (characterId: string, programId: AcademyProgramId, mentorId?: string) => setState((current) => enrollAcademyStudent(current, characterId, programId, mentorId))
  const academyMentor = (enrollmentId: string, mentorId?: string) => setState((current) => assignAcademyMentor(current, enrollmentId, mentorId))
  const academyExam = (enrollmentId: string) => setState((current) => holdAcademyExam(current, enrollmentId))
  const graduateStudent = (enrollmentId: string) => setState((current) => graduateAcademyStudent(current, enrollmentId))
  const upgradeAcademy = () => setState((current) => upgradeGuildAcademy(current))
  const councilSeat = (seatId: string, holderId?: string) => setState((current) => appointCouncilSeat(current, seatId, holderId))
  const proposalVote = (proposalId: string, choice: CouncilVoteChoice) => setState((current) => resolveCouncilProposal(current, proposalId, choice))
  const charterChange = <K extends keyof GuildCharter>(key: K, value: GuildCharter[K]) => setState((current) => changeGuildCharter(current, key, value))
  const foundDoctrine = (founderId: string) => setState((current) => foundGuildDoctrine(current, founderId))
  const createMemorial = (characterId: string, type: GuildMemorial['type']) => setState((current) => createGuildMemorial(current, characterId, type))

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
      case 'hiring': return <HiringPanel state={state} onHire={hireFromHeadquarters} />
      case 'roster': return <RosterView state={state} onDismiss={(characterId) => setState((current) => dismissCharacter(current, characterId))} />
      case 'rooms': return <RoomsView state={state} onUpgrade={(roomId) => { markTutorial('upgrade'); setState((current) => upgradeRoom(current, roomId)) }} />
      case 'positions': return <PositionsView state={state} onAssign={assignPosition} />
      case 'academy': return <AcademyPanel state={state} onEnroll={enrollStudent} onAssignMentor={academyMentor} onExam={academyExam} onGraduate={graduateStudent} onUpgrade={upgradeAcademy} />
      case 'council': return <CouncilPanel state={state} onSeat={councilSeat} onProposal={proposalVote} onCharter={charterChange} />
      case 'legacy': return <LegacyView state={state} onFoundDoctrine={foundDoctrine} onMemorial={createMemorial} />
      case 'world': return <WorldMap state={state} />
      case 'expeditions': return <ExpeditionPlanner state={state} onLaunch={(draft) => { launch(draft); setView('active_expeditions') }} />
      case 'active_expeditions': return <ActiveExpeditionsView state={state} onOpenContracts={() => changeView('expeditions')} />
      case 'archive': return <ArchiveView state={state} />
      case 'living_world': return <LivingWorldView state={state} />
      case 'influence': return <InfluenceView state={state} onRivalAction={rivalAction} onOpenBranch={createBranch} onChangeBranchAutonomy={setBranchAutonomy} onRespondCrisis={crisisResponse} onAssignMentorship={mentorship} onAppointLeader={appointLeader} />
      default: return <>{preferences.decisionCenterEnabled && <CommandCenter state={state} onNavigate={changeView} />}<GuildView state={state} onPayDebt={(amount) => setState((current) => payDebt(current, amount))} /></>
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

        <nav className="grouped-sidebar-nav">
          {viewGroups.map((group) => <section className="sidebar-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon
              const badge = item.id === 'expeditions'
                ? state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day).length
                : item.id === 'active_expeditions'
                  ? activeExpeditions.length + state.expeditions.filter((entry) => entry.status === 'missing').length + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0)
                : item.id === 'influence'
                  ? state.crises.filter((crisis) => crisis.status === 'active').length + (preferences.competitorsEnabled ? state.rivalExpeditions.filter((expedition) => ['preparing', 'traveling'].includes(expedition.status)).length : 0)
                  : item.id === 'headquarters' ? urgentCount
                  : item.id === 'hiring' ? state.characters.filter((entry) => !entry.employed && !entry.rivalGuildId && !entry.academyEnrollmentId && !['dead', 'missing', 'retired'].includes(entry.status)).length
                  : item.id === 'academy' ? state.academy.enrollments.filter((entry) => ['training', 'ready'].includes(entry.status)).length
                  : item.id === 'council' ? state.councilProposals.filter((entry) => entry.status === 'pending').length
                  : item.id === 'positions' ? state.guild.positions.filter((entry) => !entry.holderId).length
                  : 0
              return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)}><Icon size={18} /><span>{item.label}</span>{badge > 0 && <b>{badge}</b>}<ChevronRight className="nav-arrow" size={14} /></button>
            })}
          </section>)}
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
          <small>v0.7.2 · Expedition UX</small>
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
            <button disabled={timeBlocked} onClick={runUntilEvent}><FastForward size={14} />До события</button>
          </div>
          {timeBlocked && <span className="time-blocked">Время остановлено: {blockedReason}</span>}
          <div className="topbar-resources">
            <span><b>{state.guild.treasury}</b> крон</span>
            <span><b>{state.guild.supplies}</b> припасов</span>
            <span className={state.guild.debt > state.guild.treasury * 2 ? 'danger-text' : ''}><b>{state.guild.debt}</b> долг</span>
          </div>
          <button className="topbar-settings" title="Настройки" onClick={() => setSettingsModal(true)}><SettingsIcon size={18} /></button>
        </header>
        <main><Suspense fallback={<div className="view-loading">Загрузка раздела…</div>}>{renderView()}</Suspense></main>
      </div>

      {preferences.tutorialEnabled && <TutorialPanel completed={tutorialCompleted} onNavigate={changeView} onDismiss={() => updatePreferences({ ...preferences, tutorialEnabled: false })} />}
      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      <Suspense fallback={null}>
      {seedModal && <WorldSetupModal settings={worldSettings} seed={seedInput} onSeedChange={setSeedInput} onSettingsChange={setWorldSettings} onClose={() => setSeedModal(false)} onCreate={createWorld} />}
      {settingsModal && <SettingsModal state={state} preferences={preferences} onPreferencesChange={updatePreferences} onLoadState={(next) => setState(applyCompetitors(next, preferences.competitorsEnabled))} onClose={() => setSettingsModal(false)} onNewWorld={openWorldSetup} onForceUpdate={forceUpdate} />}
      {state.pendingDecision && <ExpeditionDecisionModal decision={state.pendingDecision} state={state} onChoose={(choiceId) => setState((current) => resolveExpeditionDecision(current, choiceId))} />}
      {state.pendingDebrief && <ExpeditionDebriefModal debrief={state.pendingDebrief} state={state} onResolve={resolveDebrief} />}
      {state.pendingDungeon && <DungeonExplorationModal state={state} onExplore={(zoneId) => setState((current) => exploreDungeonZone(current, zoneId))} onCamp={() => setState((current) => establishDungeonCamp(current))} onLeave={() => setState((current) => leaveDungeon(current))} />}
      {state.pendingCombat && <CombatModal state={state} onStep={() => setState((current) => stepCombat(current))} onAuto={() => setState((current) => autoResolveCombat(current))} onCommand={combatCommand} onFinalize={() => setState((current) => finalizeCombat(current))} />}
      </Suspense>
    </div>
  )
}
