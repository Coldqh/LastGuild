import { lazy, Suspense, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  Flag,
  Hammer,
  History,
  Map,
  Landmark,
  LibraryBig,
  Menu,
  Network,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import CommandCenter from './components/CommandCenter'
import TutorialPanel from './components/TutorialPanel'

const ArchiveView = lazy(() => import('./components/ArchiveView'))
const CampaignView = lazy(() => import('./components/CampaignView'))
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
const LegacyView = lazy(() => import('./components/LegacyView'))
const InfluenceView = lazy(() => import('./components/InfluenceView'))
const LivingWorldView = lazy(() => import('./components/LivingWorldView'))
const LoreCodexView = lazy(() => import('./components/LoreCodexView'))
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
import { appointGuildLeader, assignMentorship, conductRivalAction, createStrategicLayer, respondToCrisis } from './game/strategy'
import { createGuildMemorial, foundGuildDoctrine } from './game/guildPolitics'
import { loadPreferences, savePreferences, type AppPreferences } from './game/preferences'
import { selectCampaignGoal } from './game/campaign'
import type { TutorialStepId } from './game/onboarding'
import type { CharacterSkills, CombatCommandType, GameState, GuildMemorial, GuildPositionId, ViewId, WorldGenerationSettings } from './types/game'

const viewGroups: Array<{ label: string; items: Array<{ id: ViewId; label: string; icon: typeof Building2 }> }> = [
  { label: 'Гильдия', items: [
    { id: 'headquarters', label: 'Штаб', icon: Building2 },
    { id: 'campaign', label: 'Кампания', icon: Flag },
    { id: 'hiring', label: 'Наём', icon: UserPlus },
    { id: 'roster', label: 'Персонажи', icon: Users },
    { id: 'rooms', label: 'Помещения', icon: Hammer },
    { id: 'positions', label: 'Должности', icon: BriefcaseBusiness },
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
    { id: 'lore', label: 'Энциклопедия', icon: LibraryBig },
  ] },
]

const mobileMenuGroups: Array<{ label: string; itemIds: ViewId[] }> = [
  { label: 'Гильдия', itemIds: ['campaign', 'hiring', 'roster', 'rooms', 'positions', 'legacy'] },
  { label: 'Мир и знания', itemIds: ['archive', 'influence', 'living_world', 'lore'] },
]

const seasons = ['Зима', 'Весна', 'Лето', 'Осень']
const TUTORIAL_KEY = 'last-guild-tutorial-v1'
const BRAND_FULL = `${import.meta.env.BASE_URL}branding/logo-full-dark-v2.png`

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

  useEffect(() => {
    document.body.classList.toggle('mobile-menu-open', menuOpen)
    return () => document.body.classList.remove('mobile-menu-open')
  }, [menuOpen])

  const markTutorial = (step: TutorialStepId) => setTutorialCompleted((steps) => steps.includes(step) ? steps : [...steps, step])
  const activeExpeditions = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning')
  const urgentCount = useMemo(() => {
    const expiring = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay - state.day <= 8).length
    const injured = state.characters.filter((character) => character.status === 'recovering' && character.health < 45).length
    return expiring + injured + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0)
  }, [state])

  const timeBlocked = Boolean(state.pendingDecision || state.pendingDebrief || state.pendingCombat || state.pendingDungeon)
  const blockedReason = state.pendingCombat ? 'бой' : state.pendingDecision ? 'решение экспедиции' : state.pendingDungeon ? 'подземелье' : state.pendingDebrief ? 'разбор возвращения' : ''


  const mobileQuickNav: Array<{ id: ViewId | 'menu'; label: string; icon: typeof Building2; badge?: number }> = [
    { id: 'headquarters', label: 'Штаб', icon: Building2, badge: urgentCount },
    { id: 'expeditions', label: 'Контракты', icon: Compass, badge: state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day).length },
    { id: 'active_expeditions', label: 'Походы', icon: Activity, badge: activeExpeditions.length + state.expeditions.filter((entry) => entry.status === 'missing').length + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0) },
    { id: 'world', label: 'Карта', icon: Map },
    { id: 'menu', label: 'Ещё', icon: Menu },
  ]


  const badgeForView = (itemId: ViewId): number => itemId === 'expeditions'
    ? state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day).length
    : itemId === 'active_expeditions'
      ? activeExpeditions.length + state.expeditions.filter((entry) => entry.status === 'missing').length + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0)
      : itemId === 'influence'
        ? state.crises.filter((crisis) => crisis.status === 'active').length + (preferences.competitorsEnabled ? state.rivalExpeditions.filter((expedition) => ['preparing', 'traveling'].includes(expedition.status)).length : 0)
        : itemId === 'headquarters' ? urgentCount
        : itemId === 'campaign' ? (state.campaign.selectedGoalId ? 0 : 1)
        : itemId === 'hiring' ? state.characters.filter((entry) => !entry.employed && !entry.rivalGuildId && !['dead', 'missing', 'retired'].includes(entry.status)).length
        : itemId === 'positions' ? state.guild.positions.filter((entry) => !entry.holderId).length
        : 0

  const changeView = (next: ViewId) => {
    setView(next)
    setMenuOpen(false)
    if (next === 'roster') markTutorial('roster')
    if (next === 'expeditions' || next === 'active_expeditions') markTutorial('expeditions')
  }

  const activateMobileView = (event: ReactPointerEvent<HTMLButtonElement>, next: ViewId) => {
    event.preventDefault()
    event.stopPropagation()
    changeView(next)
  }

  const activateMobileAction = (event: ReactPointerEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault()
    event.stopPropagation()
    setMenuOpen(false)
    action()
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
  const crisisResponse = (crisisId: string, mode: 'fund' | 'expedition' | 'neutral') => setState((current) => respondToCrisis(current, crisisId, mode))
  const mentorship = (mentorId: string, apprenticeId: string, skill: keyof CharacterSkills) => setState((current) => assignMentorship(current, mentorId, apprenticeId, skill))
  const appointLeader = (characterId: string) => setState((current) => appointGuildLeader(current, characterId))
  const hireFromHeadquarters = (characterId: string) => { markTutorial('hire'); setState((current) => hireCharacter(current, characterId)) }
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
      case 'campaign': return <CampaignView state={state} onSelectGoal={(goalId) => setState((current) => selectCampaignGoal(current, goalId))} onNavigate={changeView} />
      case 'hiring': return <HiringPanel state={state} onHire={hireFromHeadquarters} />
      case 'roster': return <RosterView state={state} onDismiss={(characterId) => setState((current) => dismissCharacter(current, characterId))} />
      case 'rooms': return <RoomsView state={state} onUpgrade={(roomId) => { markTutorial('upgrade'); setState((current) => upgradeRoom(current, roomId)) }} />
      case 'positions': return <PositionsView state={state} onAssign={assignPosition} />
      case 'legacy': return <LegacyView state={state} onFoundDoctrine={foundDoctrine} onMemorial={createMemorial} />
      case 'world': return <WorldMap state={state} />
      case 'expeditions': return <ExpeditionPlanner state={state} onLaunch={(draft) => { launch(draft); setView('active_expeditions') }} />
      case 'active_expeditions': return <ActiveExpeditionsView state={state} onOpenContracts={() => changeView('expeditions')} />
      case 'archive': return <ArchiveView state={state} />
      case 'living_world': return <LivingWorldView state={state} />
      case 'lore': return <LoreCodexView state={state} />
      case 'influence': return <InfluenceView state={state} onRivalAction={rivalAction} onRespondCrisis={crisisResponse} onAssignMentorship={mentorship} onAppointLeader={appointLeader} />
      default: return <>{preferences.decisionCenterEnabled && <CommandCenter state={state} onNavigate={changeView} />}<GuildView state={state} onPayDebt={(amount) => setState((current) => payDebt(current, amount))} /></>
    }
  }

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-main">
            <img className="brand-logo" src={BRAND_FULL} alt="The Last Guild" />
            <span className="brand-subtitle">Экспедиционный архив</span>
          </div>
          <button type="button" className="mobile-close" onPointerUp={(event) => activateMobileAction(event, () => undefined)} aria-label="Закрыть меню"><X /></button>
        </div>

        <nav className="grouped-sidebar-nav desktop-sidebar-nav">
          {viewGroups.map((group) => <section className="sidebar-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon
              const badge = badgeForView(item.id)
              return <button type="button" key={item.id} className={view === item.id ? 'active' : ''} onPointerUp={(event) => activateMobileView(event, item.id)} aria-current={view === item.id ? 'page' : undefined}><Icon size={18} /><span>{item.label}</span>{badge > 0 && <b>{badge}</b>}<ChevronRight className="nav-arrow" size={14} /></button>
            })}
          </section>)}
        </nav>

        <div className="mobile-menu-content">
          <div className="mobile-menu-title"><strong>Ещё</strong></div>
          {mobileMenuGroups.map((group) => (
            <section className="mobile-menu-group" key={group.label}>
              <p>{group.label}</p>
              <div className="mobile-menu-grid">
                {viewGroups.flatMap((entry) => entry.items).filter((item) => group.itemIds.includes(item.id)).map((item) => {
                  const Icon = item.icon
                  const badge = badgeForView(item.id)
                  return <button type="button" key={item.id} className={view === item.id ? 'active' : ''} onPointerUp={(event) => activateMobileView(event, item.id)} aria-current={view === item.id ? 'page' : undefined}>
                    <span className="mobile-menu-grid-icon"><Icon size={18} />{badge > 0 && <b>{badge}</b>}</span>
                    <strong>{item.id === 'campaign' ? 'Цели' : item.label}</strong>
                  </button>
                })}
              </div>
            </section>
          ))}
          <section className="mobile-menu-group mobile-system-group">
            <p>Система</p>
            <div className="mobile-menu-grid">
              <button type="button" onPointerUp={(event) => activateMobileAction(event, () => setSettingsModal(true))}><SettingsIcon size={18} /><strong>Настройки</strong></button>
              <button type="button" onPointerUp={(event) => activateMobileAction(event, openWorldSetup)}><RotateCcw size={18} /><strong>Новый мир</strong></button>
            </div>
          </section>
        </div>

        <div className="sidebar-world desktop-sidebar-meta">
          <p className="eyebrow">Текущий мир</p>
          <strong>{state.seed}</strong>
          <span>{state.world.realms.length} государства · {preferences.competitorsEnabled ? `${state.rivalGuilds.length} конкурентов` : 'без конкурентов'}</span>
          <span>{state.settings.preset} · {DIFFICULTY_RULES[state.settings.difficulty].label}</span>
          <button className="text-button" onClick={openWorldSetup}><RotateCcw size={15} />Новый мир</button>
        </div>
        <div className="sidebar-footer desktop-sidebar-meta">
          <button className="sidebar-settings-button" onClick={() => setSettingsModal(true)}><SettingsIcon size={15} />Настройки</button>
          <span className={`save-indicator ${savePulse ? 'pulse' : ''}`}><Save size={14} />{savePulse ? 'Сохранено' : 'Автосохранение'}</span>
          <small>v0.8.6 · Realms, territory and war</small>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню"><Menu /></button>
          <div className="topbar-date"><CalendarDays size={18} /><div><strong>{state.year} год · день {state.day}</strong><span>{seasons[state.season]}</span></div></div>
          <div className="time-controls desktop-time-controls">
            <Clock3 size={17} />
            <button disabled={timeBlocked} onClick={() => advance(1)}>+1 день</button>
            <button disabled={timeBlocked} onClick={() => advance(7)}>+7 дней</button>
            <button disabled={timeBlocked} onClick={() => advance(30)}>+30 дней</button>
            <button disabled={timeBlocked} onClick={runUntilEvent}><FastForward size={14} />До события</button>
          </div>
          <div className="mobile-time-actions">
            <button disabled={timeBlocked} onClick={() => advance(1)} aria-label="Следующий день"><Clock3 size={17} /><span>+1</span></button>
            <button disabled={timeBlocked} onClick={runUntilEvent} aria-label="До следующего события"><FastForward size={17} /></button>
          </div>
          {timeBlocked && <span className="time-blocked">Время остановлено: {blockedReason}</span>}
          <div className="topbar-resources desktop-resources">
            <span className="resource-pill"><b>{state.guild.treasury}</b><small>крон</small></span>
            <span className="resource-pill"><b>{state.guild.supplies}</b><small>припасы</small></span>
            <span className={`resource-pill ${state.guild.debt > state.guild.treasury * 2 ? 'danger-text' : ''}`}><b>{state.guild.debt}</b><small>долг</small></span>
          </div>
          <button className="topbar-settings" title="Настройки" onClick={() => setSettingsModal(true)} aria-label="Настройки"><SettingsIcon size={18} /></button>
        </header>
        <main><Suspense fallback={<div className="view-loading">Загрузка раздела…</div>}>{renderView()}</Suspense></main>
      </div>

      <nav className={`mobile-bottom-nav ${menuOpen || settingsModal ? 'is-hidden' : ''}`} aria-label="Быстрая навигация">
        {mobileQuickNav.map((item) => {
          const Icon = item.icon
          const active = item.id !== 'menu' && view === item.id
          return (
            <button
              key={item.id}
              className={active ? 'active' : ''}
              type="button"
              onPointerUp={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (item.id === 'menu') setMenuOpen(true)
                else changeView(item.id)
              }}
              aria-label={item.label}
            >
              <span className="mobile-nav-icon">
                <Icon size={18} />
                {item.badge && item.badge > 0 ? <b>{item.badge > 99 ? '99+' : item.badge}</b> : null}
              </span>
              <small>{item.label}</small>
            </button>
          )
        })}
      </nav>

      {preferences.tutorialEnabled && <TutorialPanel completed={tutorialCompleted} onNavigate={changeView} onDismiss={() => updatePreferences({ ...preferences, tutorialEnabled: false })} />}
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
