import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
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
import DungeonExplorationModal from './components/DungeonExplorationModal'
import ExpeditionDebriefModal from './components/ExpeditionDebriefModal'
import ExpeditionDecisionModal from './components/ExpeditionDecisionModal'
import ExpeditionPlanner from './components/ExpeditionPlanner'
import GuildView from './components/GuildView'
import InfluenceView from './components/InfluenceView'
import RosterView from './components/RosterView'
import SettingsModal from './components/SettingsModal'
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
import { appointGuildLeader, assignMentorship, changeBranchAutonomy, conductRivalAction, openBranch, respondToCrisis } from './game/strategy'
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

function initialState(): GameState {
  return loadGame() ?? createNewGame('last-guild-demo', DEFAULT_WORLD_SETTINGS)
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveGame(state)
      setSavePulse(true)
      window.setTimeout(() => setSavePulse(false), 900)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [state])

  const activeExpeditions = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning')
  const urgentCount = useMemo(() => {
    const expiring = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay - state.day <= 8).length
    const injured = state.characters.filter((character) => character.status === 'recovering' && character.health < 45).length
    return expiring + injured + (state.pendingDecision ? 1 : 0) + (state.pendingDebrief ? 1 : 0) + (state.pendingCombat ? 1 : 0) + (state.pendingDungeon ? 1 : 0)
  }, [state])

  const timeBlocked = Boolean(state.pendingDecision || state.pendingDebrief || state.pendingCombat || state.pendingDungeon)
  const changeView = (next: ViewId) => { setView(next); setMenuOpen(false) }
  const advance = (days: number) => setState((current) => advanceDays(current, days))
  const launch = (draft: ExpeditionDraft) => setState((current) => createExpeditionFromDraft(current, draft))
  const resolveDebrief = (resolution: DebriefResolution) => setState((current) => resolveExpeditionDebrief(current, resolution))
  const assignPosition = (positionId: GuildPositionId, holderId?: string) => setState((current) => assignGuildPosition(current, positionId, holderId))
  const combatCommand = (command: CombatCommandType, targetId?: string) => setState((current) => issueCombatCommand(current, command, targetId))
  const rivalAction = (rivalId: string, action: 'cooperate' | 'exchange' | 'pressure') => setState((current) => conductRivalAction(current, rivalId, action))
  const createBranch = (settlementId: string, leaderId: string, specialization: BranchSpecialization, autonomy: BranchAutonomy) => setState((current) => openBranch(current, settlementId, leaderId, specialization, autonomy))
  const setBranchAutonomy = (branchId: string, autonomy: BranchAutonomy) => setState((current) => changeBranchAutonomy(current, branchId, autonomy))
  const crisisResponse = (crisisId: string, mode: 'fund' | 'expedition' | 'neutral') => setState((current) => respondToCrisis(current, crisisId, mode))
  const mentorship = (mentorId: string, apprenticeId: string, skill: keyof CharacterSkills) => setState((current) => assignMentorship(current, mentorId, apprenticeId, skill))
  const appointLeader = (characterId: string) => setState((current) => appointGuildLeader(current, characterId))

  const openWorldSetup = () => {
    setWorldSettings({ ...state.settings })
    setSeedInput('')
    setSettingsModal(false)
    setSeedModal(true)
  }

  const createWorld = () => {
    const next = createNewGame(seedInput || undefined, worldSettings)
    clearSave()
    setState(next)
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
          try { await registration.update(); await registration.unregister() } catch { /* a stale worker must not block refresh */ }
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
      case 'roster': return <RosterView state={state} onHire={(characterId) => setState((current) => hireCharacter(current, characterId))} onDismiss={(characterId) => setState((current) => dismissCharacter(current, characterId))} />
      case 'expeditions': return <ExpeditionPlanner state={state} onLaunch={launch} />
      case 'archive': return <ArchiveView state={state} />
      case 'influence': return <InfluenceView state={state} onRivalAction={rivalAction} onOpenBranch={createBranch} onChangeBranchAutonomy={setBranchAutonomy} onRespondCrisis={crisisResponse} onAssignMentorship={mentorship} onAppointLeader={appointLeader} />
      default: return <GuildView state={state} onUpgrade={(roomId) => setState((current) => upgradeRoom(current, roomId))} onPayDebt={(amount) => setState((current) => payDebt(current, amount))} onAssignPosition={assignPosition} />
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
                ? state.crises.filter((crisis) => crisis.status === 'active').length + state.rivalExpeditions.filter((expedition) => ['preparing', 'traveling'].includes(expedition.status)).length
                : item.id === 'headquarters' && urgentCount ? urgentCount : 0
            return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)}><Icon size={19} /><span>{item.label}</span>{badge > 0 && <b>{badge}</b>}<ChevronRight className="nav-arrow" size={15} /></button>
          })}
        </nav>

        <div className="sidebar-world">
          <p className="eyebrow">Текущий мир</p>
          <strong>{state.seed}</strong>
          <span>{state.world.realms.length} государства · {state.rivalGuilds.length} конкурентов</span>
          <span>{state.settings.preset} · {DIFFICULTY_RULES[state.settings.difficulty].label}</span>
          <button className="text-button" onClick={openWorldSetup}><RotateCcw size={15} />Новый мир</button>
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-settings-button" onClick={() => setSettingsModal(true)}><SettingsIcon size={15} />Настройки</button>
          <span className={`save-indicator ${savePulse ? 'pulse' : ''}`}><Save size={14} />{savePulse ? 'Сохранено' : 'Автосохранение'}</span>
          <small>v0.5 · Guilds & Politics</small>
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
            <button disabled={timeBlocked} onClick={() => advance(360)}>+1 год</button>
          </div>
          <div className="topbar-resources">
            <span><b>{state.guild.treasury}</b> крон</span>
            <span><b>{state.guild.supplies}</b> припасов</span>
            <span className={state.guild.debt > state.guild.treasury * 2 ? 'danger-text' : ''}><b>{state.guild.debt}</b> долг</span>
          </div>
          <button className="topbar-settings" title="Настройки" onClick={() => setSettingsModal(true)}><SettingsIcon size={18} /></button>
        </header>
        <main>{renderView()}</main>
      </div>

      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      {seedModal && <WorldSetupModal settings={worldSettings} seed={seedInput} onSeedChange={setSeedInput} onSettingsChange={setWorldSettings} onClose={() => setSeedModal(false)} onCreate={createWorld} />}
      {settingsModal && <SettingsModal state={state} onClose={() => setSettingsModal(false)} onNewWorld={openWorldSetup} onForceUpdate={forceUpdate} />}
      {state.pendingDecision && <ExpeditionDecisionModal decision={state.pendingDecision} state={state} onChoose={(choiceId) => setState((current) => resolveExpeditionDecision(current, choiceId))} />}
      {state.pendingDebrief && <ExpeditionDebriefModal debrief={state.pendingDebrief} state={state} onResolve={resolveDebrief} />}
      {state.pendingDungeon && <DungeonExplorationModal state={state} onExplore={(zoneId) => setState((current) => exploreDungeonZone(current, zoneId))} onCamp={() => setState((current) => establishDungeonCamp(current))} onLeave={() => setState((current) => leaveDungeon(current))} />}
      {state.pendingCombat && <CombatModal state={state} onStep={() => setState((current) => stepCombat(current))} onAuto={() => setState((current) => autoResolveCombat(current))} onCommand={combatCommand} onFinalize={() => setState((current) => finalizeCombat(current))} />}
    </div>
  )
}
