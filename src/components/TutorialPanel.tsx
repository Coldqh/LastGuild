import { Check, ChevronRight, GraduationCap, X } from 'lucide-react'
import { TUTORIAL_STEPS, type TutorialStepId } from '../game/onboarding'
import type { ViewId } from '../types/game'

interface Props {
  completed: TutorialStepId[]
  onNavigate: (view: ViewId) => void
  onDismiss: () => void
}

export default function TutorialPanel({ completed, onNavigate, onDismiss }: Props) {
  const current = TUTORIAL_STEPS.find((step) => !completed.includes(step.id))
  if (!current) return null
  return <aside className="tutorial-panel paper-card">
    <button className="tutorial-close" onClick={onDismiss}><X size={15} /></button>
    <div className="tutorial-icon"><GraduationCap /></div>
    <div><p className="eyebrow">Обучение {completed.length + 1}/{TUTORIAL_STEPS.length}</p><h3>{current.title}</h3><p>{current.description}</p></div>
    <button className="primary-button" onClick={() => onNavigate(current.targetView)}>Перейти <ChevronRight size={15} /></button>
    <div className="tutorial-dots">{TUTORIAL_STEPS.map((step) => <span key={step.id} className={completed.includes(step.id) ? 'done' : step.id === current.id ? 'current' : ''}>{completed.includes(step.id) && <Check size={10} />}</span>)}</div>
  </aside>
}
