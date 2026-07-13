import { AlertTriangle, Compass, X } from 'lucide-react'
import type { ExpeditionDecision, GameState } from '../types/game'

interface Props {
  decision: ExpeditionDecision
  state: GameState
  onChoose: (choiceId: string) => void
}

export default function ExpeditionDecisionModal({ decision, state, onChoose }: Props) {
  const expedition = state.expeditions.find((candidate) => candidate.id === decision.expeditionId)
  const tile = state.world.tiles.find((candidate) => candidate.id === decision.locationTileId)
  return (
    <div className="modal-backdrop decision-backdrop">
      <article className="decision-modal paper-card">
        <div className="decision-icon"><AlertTriangle size={25} /></div>
        <p className="eyebrow">Срочное решение · день {state.day}</p>
        <h2>{decision.title}</h2>
        <p>{decision.text}</p>
        <div className="decision-context"><Compass size={16} /><span>{expedition?.name} · клетка {tile?.x}:{tile?.y} · мораль {Math.round(expedition?.morale ?? 0)}%</span></div>
        <div className="decision-choices">
          {decision.choices.map((choice) => <button key={choice.id} onClick={() => onChoose(choice.id)}><strong>{choice.label}</strong><span>{choice.description}</span>{choice.skill && <small>Проверка: {choice.skill} · сложность {choice.difficulty}</small>}</button>)}
        </div>
        <div className="decision-note"><X size={15} />Время остановлено, пока решение не принято.</div>
      </article>
    </div>
  )
}
