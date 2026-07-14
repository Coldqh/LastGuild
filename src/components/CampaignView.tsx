import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Coins,
  Compass,
  Flag,
  LibraryBig,
  Map,
  Shield,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { CAMPAIGN_PHASES, GUILD_IDENTITY_PATHS } from '../game/campaign'
import type { CampaignGoal, CampaignGoalType, GameState, ViewId } from '../types/game'

interface Props {
  state: GameState
  onSelectGoal: (goalId: string) => void
  onNavigate: (view: ViewId) => void
}

const goalIcons = {
  map_region: Map,
  find_empire: LibraryBig,
  slay_legend: Shield,
  expose_lie: Compass,
  world_institute: Trophy,
  great_artifact: Sparkles,
}

const goalActions: Record<CampaignGoalType, { text: string; button: string; view: ViewId }> = {
  map_region: { text: 'Открывай неизвестные гексы и заверши картографические контракты.', button: 'Открыть карту', view: 'world' },
  find_empire: { text: 'Ищи древние руины, документы и связанные сюжетные зацепки.', button: 'Искать контракт', view: 'expeditions' },
  slay_legend: { text: 'Собери сведения о легендарном чудовище и подготовь охотничий отряд.', button: 'К контрактам', view: 'expeditions' },
  expose_lie: { text: 'Проходи исторические цепочки и публикуй подтверждённые документы.', button: 'Открыть знания', view: 'lore' },
  world_institute: { text: 'Развивай помещения, академию, архив и авторитет гильдии.', button: 'Развивать штаб', view: 'rooms' },
  great_artifact: { text: 'Ищи части артефакта в руинах и сюжетных экспедициях.', button: 'К контрактам', view: 'expeditions' },
}

function GoalOption({ goal, selected, onSelect }: { goal: CampaignGoal; selected: boolean; onSelect: () => void }) {
  const Icon = goalIcons[goal.type]
  const progress = Math.min(100, Math.round((goal.progress / Math.max(1, goal.target)) * 100))

  return (
    <button className={`campaign-goal-option ${selected ? 'selected' : ''}`} onClick={onSelect} disabled={goal.status === 'completed'}>
      <Icon size={17} />
      <span>
        <strong>{goal.title}</strong>
        <small>{goal.status === 'completed' ? 'Выполнено' : `${progress}% · ${goal.progress}/${goal.target}`}</small>
      </span>
      {goal.status === 'completed' ? <CheckCircle2 size={16} /> : <ArrowRight size={15} />}
    </button>
  )
}

export default function CampaignView({ state, onSelectGoal, onNavigate }: Props) {
  const phaseIndex = Math.max(0, CAMPAIGN_PHASES.findIndex((entry) => entry.id === state.campaign.phase.id))
  const currentPhase = CAMPAIGN_PHASES[phaseIndex]
  const nextPhase = CAMPAIGN_PHASES[phaseIndex + 1]
  const selectedGoal = state.campaign.goals.find((goal) => goal.id === state.campaign.selectedGoalId)
  const primaryPath = state.campaign.identity.primaryPath ? GUILD_IDENTITY_PATHS[state.campaign.identity.primaryPath] : undefined
  const activeExpeditions = state.expeditions.filter((entry) => ['active', 'returning'].includes(entry.status))
  const fieldRoster = state.characters.filter((entry) => entry.employed && !['dead', 'missing', 'retired'].includes(entry.status))
  const openContracts = state.opportunities.filter((entry) => !entry.accepted && entry.deadlineDay >= state.day)
  const activeStories = state.storyChains.filter((entry) => entry.status === 'active')

  const tasks: Array<{ title: string; detail: string; view?: ViewId; icon: typeof Flag }> = []
  if (!selectedGoal) tasks.push({ title: 'Выбери долгую цель', detail: 'Она задаст направление кампании.', icon: Target })
  if (state.guild.debt > 0) tasks.push({ title: 'Сократи долг', detail: `${state.guild.debt} крон осталось`, view: 'headquarters', icon: Coins })
  if (fieldRoster.length < 6) tasks.push({ title: 'Усиль состав', detail: `${fieldRoster.length}/6 готовых сотрудников`, view: 'hiring', icon: UserPlus })
  if (activeExpeditions.length === 0) tasks.push({ title: 'Отправь экспедицию', detail: `${openContracts.length} контрактов доступно`, view: 'expeditions', icon: Compass })
  else tasks.push({ title: 'Следи за походами', detail: `${activeExpeditions.length} отрядов в пути`, view: 'active_expeditions', icon: Activity })
  if (selectedGoal) {
    const action = goalActions[selectedGoal.type]
    tasks.push({ title: action.button, detail: action.text, view: action.view, icon: goalIcons[selectedGoal.type] })
  }

  const goalProgress = selectedGoal ? Math.min(100, Math.round((selectedGoal.progress / Math.max(1, selectedGoal.target)) * 100)) : 0

  return (
    <section className="view campaign-view campaign-compact-view">
      <header className="campaign-compact-header">
        <div>
          <h1>Кампания</h1>
          <span>Этап {phaseIndex + 1}/{CAMPAIGN_PHASES.length} · {currentPhase.label}</span>
        </div>
        <b>{state.campaign.phase.progress}%</b>
      </header>

      <div className="campaign-stage-line">
        <span style={{ width: `${state.campaign.phase.progress}%` }} />
      </div>
      <p className="campaign-stage-hint">{nextPhase ? `До этапа «${nextPhase.label}»: ${100 - state.campaign.phase.progress}%` : 'Высший этап достигнут'}</p>

      <section className="campaign-action-card paper-card">
        <div className="campaign-action-title"><Flag size={17} /><h2>Что делать сейчас</h2></div>
        <div className="campaign-task-list">
          {tasks.slice(0, 3).map((task) => {
            const Icon = task.icon
            return (
              <button key={`${task.title}-${task.detail}`} onClick={() => task.view && onNavigate(task.view)} disabled={!task.view}>
                <Icon size={16} />
                <span><strong>{task.title}</strong><small>{task.detail}</small></span>
                {task.view && <ArrowRight size={14} />}
              </button>
            )
          })}
        </div>
      </section>

      <section className="campaign-goal-compact paper-card">
        <div className="campaign-section-head">
          <Target size={17} />
          <div><small>Долгая цель</small><h2>{selectedGoal?.title ?? 'Не выбрана'}</h2></div>
          {selectedGoal && <b>{goalProgress}%</b>}
        </div>

        {selectedGoal ? <>
          <div className="campaign-stage-line"><span style={{ width: `${goalProgress}%` }} /></div>
          <p>{goalActions[selectedGoal.type].text}</p>
          <div className="campaign-goal-actions">
            <button className="primary-button" onClick={() => onNavigate(goalActions[selectedGoal.type].view)}>{goalActions[selectedGoal.type].button}<ArrowRight size={14} /></button>
            <details>
              <summary>Сменить</summary>
              <div className="campaign-goal-options">{state.campaign.goals.filter((goal) => goal.id !== selectedGoal.id).map((goal) => <GoalOption key={goal.id} goal={goal} selected={false} onSelect={() => onSelectGoal(goal.id)} />)}</div>
            </details>
          </div>
        </> : <div className="campaign-goal-options">{state.campaign.goals.map((goal) => <GoalOption key={goal.id} goal={goal} selected={false} onSelect={() => onSelectGoal(goal.id)} />)}</div>}
      </section>

      <footer className="campaign-compact-footer">
        <button onClick={() => onNavigate('lore')}><LibraryBig size={15} /><span><strong>{activeStories.length}</strong> активных историй</span></button>
        <span><Sparkles size={15} />{primaryPath?.label ?? 'Репутация формируется'}</span>
      </footer>
    </section>
  )
}
