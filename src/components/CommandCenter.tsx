import { AlertTriangle, CheckCircle2, ChevronRight, Crosshair, Flag, ShieldAlert } from 'lucide-react'
import { getAttentionItems, getEarlyGoals } from '../game/onboarding'
import type { GameState, ViewId } from '../types/game'

interface Props {
  state: GameState
  onNavigate: (view: ViewId) => void
}

export default function CommandCenter({ state, onNavigate }: Props) {
  const attention = getAttentionItems(state)
  const goals = getEarlyGoals(state)
  return (
    <section className="command-center">
      <article className="paper-card command-decisions">
        <div className="command-heading"><div><p className="eyebrow">Центр решений</p><h2>Что требует внимания</h2></div><ShieldAlert size={22} /></div>
        <div className="attention-list">
          {attention.slice(0, 6).map((item) => <button key={item.id} className={`attention-item severity-${item.severity}`} onClick={() => onNavigate(item.targetView)}>
            {item.severity === 'critical' ? <AlertTriangle /> : item.severity === 'warning' ? <Crosshair /> : <CheckCircle2 />}
            <span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={16} />
          </button>)}
        </div>
      </article>
      <article className="paper-card first-month-card">
        <div className="command-heading"><div><p className="eyebrow">Первые 30 дней</p><h2>Удержать гильдию на ногах</h2></div><Flag size={22} /></div>
        <div className="goal-list">{goals.map((goal) => <div key={goal.label} className={goal.done ? 'done' : ''}><CheckCircle2 size={16} /><span>{goal.label}</span></div>)}</div>
        <div className="goal-progress"><i style={{ width: `${goals.filter((goal) => goal.done).length / goals.length * 100}%` }} /></div>
      </article>
    </section>
  )
}
