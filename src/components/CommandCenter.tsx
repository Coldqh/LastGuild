import { AlertTriangle, CheckCircle2, ChevronRight, Crosshair, ShieldAlert } from 'lucide-react'
import { getAttentionItems, getEarlyGoals } from '../game/onboarding'
import type { GameState, ViewId } from '../types/game'

interface Props { state: GameState; onNavigate: (view: ViewId) => void }

export default function CommandCenter({ state, onNavigate }: Props) {
  const attention = getAttentionItems(state)
  const goals = getEarlyGoals(state)
  const done = goals.filter((goal) => goal.done).length
  return <section className="command-center compact-command-center">
    <article className="paper-card command-decisions compact-command-card">
      <div className="command-heading"><div><p className="eyebrow">Центр решений</p><h2>{attention.length ? `${attention.length} задач требуют внимания` : 'Критичных задач нет'}</h2></div><ShieldAlert size={21} /></div>
      <div className="attention-list compact-attention-list">{attention.slice(0, 4).map((item) => <button key={item.id} className={`attention-item severity-${item.severity}`} onClick={() => onNavigate(item.targetView)}>{item.severity === 'critical' ? <AlertTriangle /> : item.severity === 'warning' ? <Crosshair /> : <CheckCircle2 />}<span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={16} /></button>)}</div>
      {state.year === 912 && state.day <= 30 && <div className="compact-goal-progress"><span>Первые 30 дней <b>{done}/{goals.length}</b></span><div className="goal-progress"><i style={{ width: `${done / Math.max(1, goals.length) * 100}%` }} /></div></div>}
    </article>
  </section>
}
