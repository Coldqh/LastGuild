import { CheckCircle2, Compass, Crown, Flag, LibraryBig, Route, Shield, Sparkles, Target, Trophy } from 'lucide-react'
import { CAMPAIGN_PHASES, GUILD_IDENTITY_PATHS, contentRepeatRate } from '../game/campaign'
import type { CampaignGoal, GameState, GuildIdentityPathId } from '../types/game'

interface Props {
  state: GameState
  onSelectGoal: (goalId: string) => void
}

const goalIcons = {
  map_region: Route,
  find_empire: LibraryBig,
  slay_legend: Shield,
  expose_lie: Crown,
  world_institute: Trophy,
  great_artifact: Sparkles,
}

function GoalCard({ goal, selected, onSelect, compact = false }: { goal: CampaignGoal; selected: boolean; onSelect: () => void; compact?: boolean }) {
  const Icon = goalIcons[goal.type]
  const progress = Math.min(100, Math.round((goal.progress / Math.max(1, goal.target)) * 100))

  return (
    <article className={`campaign-goal-card ${compact ? 'compact' : ''} ${selected ? 'selected' : ''} ${goal.status === 'completed' ? 'completed' : ''}`}>
      <div className="campaign-goal-head">
        <Icon size={compact ? 17 : 20} />
        <div>
          <p className="eyebrow">{goal.status === 'completed' ? 'Завершено' : selected ? 'Главная цель' : 'Доступная цель'}</p>
          <h3>{goal.title}</h3>
        </div>
      </div>
      <p className="campaign-goal-description">{goal.description}</p>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="campaign-goal-progress"><strong>{goal.progress}/{goal.target}</strong><span>{progress}%</span></div>
      {!compact && <small>{goal.rewardText}</small>}
      {!selected && goal.status !== 'completed' && <button className="secondary-button" onClick={onSelect}><Target size={15} />Выбрать</button>}
      {goal.status === 'completed' && <span className="completed-label"><CheckCircle2 size={15} />Выполнено</span>}
    </article>
  )
}

export default function CampaignView({ state, onSelectGoal }: Props) {
  const phaseIndex = CAMPAIGN_PHASES.findIndex((entry) => entry.id === state.campaign.phase.id)
  const currentPhase = CAMPAIGN_PHASES[Math.max(0, phaseIndex)]
  const nextPhase = CAMPAIGN_PHASES[phaseIndex + 1]
  const identityEntries = Object.entries(state.campaign.identity.scores) as Array<[GuildIdentityPathId, number]>
  const activeChains = state.storyChains.filter((chain) => chain.status === 'active')
  const dormantChains = state.storyChains.filter((chain) => chain.status === 'dormant')
  const selectedGoal = state.campaign.goals.find((goal) => goal.id === state.campaign.selectedGoalId)
  const otherGoals = state.campaign.goals.filter((goal) => goal.id !== state.campaign.selectedGoalId)
  const repeatRate = contentRepeatRate(state)
  const totalEvents = state.campaign.telemetry.totalEvents
  const uniqueEvents = Object.keys(state.campaign.telemetry.eventCounts).length
  const primaryPath = state.campaign.identity.primaryPath ? GUILD_IDENTITY_PATHS[state.campaign.identity.primaryPath] : undefined

  return (
    <div className="campaign-view view-stack">
      <header className="view-header compact-header campaign-header">
        <div>
          <p className="eyebrow">Кампания</p>
          <h1>Путь гильдии</h1>
          <p className="campaign-header-description">Главная цель, этап развития и репутация организации.</p>
        </div>
        <div className="campaign-phase-chip"><Flag size={16} /><span><small>Этап {phaseIndex + 1}/{CAMPAIGN_PHASES.length}</small><strong>{currentPhase.label}</strong></span></div>
      </header>

      <section className="campaign-phase-card paper-card">
        <div className="campaign-phase-main">
          <Compass size={22} />
          <div>
            <p className="eyebrow">Текущий этап</p>
            <h2>{currentPhase.label}</h2>
            <p>{currentPhase.description}</p>
          </div>
        </div>
        <div className="progress-track large"><span style={{ width: `${state.campaign.phase.progress}%` }} /></div>
        <div className="campaign-phase-footer"><strong>{state.campaign.phase.progress}%</strong><span>{nextPhase ? `Далее: ${nextPhase.label}` : 'Высший этап достигнут'}</span></div>
        <details className="campaign-phase-details">
          <summary>Все этапы кампании</summary>
          <div className="campaign-phase-list">{CAMPAIGN_PHASES.map((phase, index) => <span key={phase.id} className={index <= phaseIndex ? 'reached' : ''}>{index < phaseIndex ? <CheckCircle2 size={14} /> : index === phaseIndex ? <Flag size={14} /> : <span className="phase-dot" />}{phase.label}</span>)}</div>
        </details>
      </section>

      <section className="campaign-goal-section">
        <div className="section-title"><Target size={18} /><div><p className="eyebrow">Главная цель</p><h2>{selectedGoal ? selectedGoal.title : 'Выбери направление'}</h2></div></div>
        {selectedGoal ? <GoalCard goal={selectedGoal} selected onSelect={() => undefined} /> : <div className="campaign-goal-grid">{state.campaign.goals.map((goal) => <GoalCard key={goal.id} goal={goal} selected={false} onSelect={() => onSelectGoal(goal.id)} />)}</div>}
        {selectedGoal && otherGoals.length > 0 && <details className="campaign-other-goals"><summary>Сменить долгую цель</summary><div className="campaign-goal-grid">{otherGoals.map((goal) => <GoalCard key={goal.id} goal={goal} selected={false} compact onSelect={() => onSelectGoal(goal.id)} />)}</div></details>}
      </section>

      <details className="paper-card campaign-disclosure">
        <summary><Crown size={18} /><span><small>Репутационный путь</small><strong>{primaryPath?.label ?? 'Ещё не определён'}</strong></span></summary>
        <div className="campaign-disclosure-content">
          <p className="muted">Путь меняется от публикаций, охоты, политики, торговли и работы с опасными знаниями.</p>
          <div className="identity-grid">{identityEntries.sort((a, b) => b[1] - a[1]).map(([id, score]) => <article key={id} className={state.campaign.identity.primaryPath === id ? 'primary' : ''}><div><strong>{GUILD_IDENTITY_PATHS[id].label}</strong><b>{score}</b></div><div className="progress-track"><span style={{ width: `${score}%` }} /></div><small>{GUILD_IDENTITY_PATHS[id].description}</small></article>)}</div>
        </div>
      </details>

      <details className="paper-card campaign-disclosure campaign-statistics">
        <summary><Sparkles size={18} /><span><small>Статистика кампании</small><strong>{activeChains.length} активных историй</strong></span></summary>
        <div className="campaign-pacing-grid campaign-disclosure-content">
          <article><span><Sparkles size={18} /><strong>Темп историй</strong></span><b>{activeChains.length}</b><small>{dormantChains.length} ждут этапа</small></article>
          <article><span><LibraryBig size={18} /><strong>События</strong></span><b>{totalEvents}</b><small>{uniqueEvents} уникальных сцен</small></article>
          <article className={repeatRate > 35 ? 'warning-card' : ''}><span><Sparkles size={18} /><strong>Повторы</strong></span><b>{repeatRate}%</b><small>{repeatRate <= 25 ? 'вариативность стабильна' : 'вес повторов снижается'}</small></article>
          <article><span><Trophy size={18} /><strong>Линии</strong></span><b>{state.campaign.telemetry.completedChainIds.length}</b><small>завершено</small></article>
        </div>
      </details>
    </div>
  )
}
