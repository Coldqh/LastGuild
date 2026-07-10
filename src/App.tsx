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
  RotateCcw,
  Save,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react'
import ArchiveView from './components/ArchiveView'
import ExpeditionPlanner from './components/ExpeditionPlanner'
import GuildView from './components/GuildView'
import RosterView from './components/RosterView'
import WorldMap from './components/WorldMap'
import { createNewGame } from './game/gameFactory'
import { advanceDays, createExpeditionFromDraft, dismissCharacter, hireCharacter, payDebt, upgradeRoom, type ExpeditionDraft } from './game/simulation'
import { clearSave, loadGame, saveGame } from './game/storage'
import type { GameState, ViewId } from './types/game'

const views: Array<{ id: ViewId; label: string; icon: typeof Building2 }> = [
  { id: 'headquarters', label: 'Штаб', icon: Building2 },
  { id: 'world', label: 'Карта мира', icon: Map },
  { id: 'roster', label: 'Персонажи', icon: Users },
  { id: 'expeditions', label: 'Экспедиции', icon: Compass },
  { id: 'archive', label: 'Архив', icon: BookOpen },
]

const seasons = ['Зима', 'Весна', 'Лето', 'Осень']

function initialState(): GameState {
  return loadGame() ?? createNewGame('last-guild-demo')
}

export default function App() {
  const [state, setState] = useState<GameState>(initialState)
  const [view, setView] = useState<ViewId>('headquarters')
  const [menuOpen, setMenuOpen] = useState(false)
  const [seedModal, setSeedModal] = useState(false)
  const [seedInput, setSeedInput] = useState('')
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
    return expiring + injured
  }, [state])

  const changeView = (next: ViewId) => {
    setView(next)
    setMenuOpen(false)
  }

  const advance = (days: number) => setState((current) => advanceDays(current, days))
  const launch = (draft: ExpeditionDraft) => setState((current) => createExpeditionFromDraft(current, draft))

  const createWorld = () => {
    const next = createNewGame(seedInput || undefined)
    clearSave()
    setState(next)
    setView('headquarters')
    setSeedModal(false)
    setSeedInput('')
  }

  const renderView = () => {
    switch (view) {
      case 'world': return <WorldMap state={state} />
      case 'roster': return <RosterView state={state} onHire={(characterId) => setState((current) => hireCharacter(current, characterId))} onDismiss={(characterId) => setState((current) => dismissCharacter(current, characterId))} />
      case 'expeditions': return <ExpeditionPlanner state={state} onLaunch={launch} />
      case 'archive': return <ArchiveView state={state} />
      default: return <GuildView state={state} onUpgrade={(roomId) => setState((current) => upgradeRoom(current, roomId))} onPayDebt={(amount) => setState((current) => payDebt(current, amount))} />
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
            const badge = item.id === 'expeditions' ? activeExpeditions.length : item.id === 'headquarters' && urgentCount ? urgentCount : 0
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)}>
                <Icon size={19} /><span>{item.label}</span>{badge > 0 && <b>{badge}</b>}<ChevronRight className="nav-arrow" size={15} />
              </button>
            )
          })}
        </nav>

        <div className="sidebar-world">
          <p className="eyebrow">Текущий мир</p>
          <strong>{state.seed}</strong>
          <span>{state.world.realms.length} государства · {state.world.sites.length} мест</span>
          <button className="text-button" onClick={() => setSeedModal(true)}><RotateCcw size={15} />Новый мир</button>
        </div>
        <div className="sidebar-footer"><span className={`save-indicator ${savePulse ? 'pulse' : ''}`}><Save size={14} />{savePulse ? 'Сохранено' : 'Автосохранение'}</span><small>v0.1 · First Expedition</small></div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)}><Menu /></button>
          <div className="topbar-date"><CalendarDays size={18} /><div><strong>{state.year} год · день {state.day}</strong><span>{seasons[state.season]}</span></div></div>
          <div className="time-controls">
            <Clock3 size={17} />
            <button onClick={() => advance(1)}>+1 день</button>
            <button onClick={() => advance(7)}>+7 дней</button>
            <button onClick={() => advance(30)}>+30 дней</button>
          </div>
          <div className="topbar-resources">
            <span><b>{state.guild.treasury}</b> крон</span>
            <span><b>{state.guild.supplies}</b> припасов</span>
            <span className={state.guild.debt > state.guild.treasury * 2 ? 'danger-text' : ''}><b>{state.guild.debt}</b> долг</span>
          </div>
        </header>
        <main>{renderView()}</main>
      </div>

      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      {seedModal && (
        <div className="modal-backdrop" onClick={() => setSeedModal(false)}>
          <article className="seed-modal paper-card" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button close-detail" onClick={() => setSeedModal(false)}><X size={18} /></button>
            <p className="eyebrow">Новая кампания</p>
            <h2>Создать другой мир</h2>
            <p>Текущее сохранение будет заменено. Одинаковый seed создаёт одинаковую карту, государства, руины и стартовый состав.</p>
            <label><span>Seed мира</span><input value={seedInput} onChange={(event) => setSeedInput(event.target.value)} placeholder="Оставь пустым для случайного" /></label>
            <button className="primary-button" onClick={createWorld}>Создать мир</button>
          </article>
        </div>
      )}
    </div>
  )
}
