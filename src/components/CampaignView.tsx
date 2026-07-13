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

function GoalCard({ goal, selected, onSelect }: { goal: CampaignGoal; selected: boolean; onSelect: () => void }) {
  const Icon = goalIcons[goal.type]
  const progress = Math.min(100, Math.round((goal.progress / Math.max(1, goal.target)) * 100))
  return <article className={`campaign-goal-card ${selected ? 'selected' : ''} ${goal.status === 'completed' ? 'completed' : ''}`}>
    <div className="campaign-goal-head"><Icon size={20} /><div><p className="eyebrow">{goal.status === 'completed' ? 'Завершено' : selected ? 'Главная цель' : 'Доступная цель'}</p><h3>{goal.title}</h3></div></div>
    <p>{goal.description}</p>
    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    <div className="campaign-goal-progress"><strong>{goal.progress}/{goal.target}</strong><span>{progress}%</span></div>
    <small>{goal.rewardText}</small>
    {!selected && goal.status !== 'completed' && <button className="secondary-button" onClick={onSelect}><Target size={15} />Выбрать целью</button>}
    {goal.status === 'completed' && <span className="completed-label"><CheckCircle2 size={15} />Цель выполнена</span>}
  </article>
}

export default function CampaignView({ state, onSelectGoal }: Props) {
  const phaseIndex = CAMPAIGN_PHASES.findIndex((entry) => entry.id === state.campaign.phase.id)
  const currentPhase = CAMPAIGN_PHASES[Math.max(0, phaseIndex)]
  const nextPhase = CAMPAIGN_PHASES[phaseIndex + 1]
  const identityEntries = Object.entries(state.campaign.identity.scores) as Array<[GuildIdentityPathId, number]>
  const activeChains = state.storyChains.filter((chain) => chain.status === 'active')
  const dormantChains = state.storyChains.filter((chain) => chain.status === 'dormant')
  const selectedGoal = state.campaign.goals.find((goal) => goal.id === state.campaign.selectedGoalId)
  const repeatRate = contentRepeatRate(state)
  const totalEvents = state.campaign.telemetry.totalEvents
  const uniqueEvents = Object.keys(state.campaign.telemetry.eventCounts).length

  return <div className="campaign-view view-stack">
    <header className="view-header compact-header">
      <div><p className="eyebrow">Долгая кампания</p><h1>Путь гильдии</h1><p>Этап развития, главная цель и репутация организации формируются из реальных действий.</p></div>
      <div className="campaign-phase-chip"><Flag size={17} /><span><small>Текущий этап</small><strong>{currentPhase.label}</strong></span></div>
    </header>

    <section className="campaign-phase-card paper-card">
      <div className="campaign-phase-main"><Compass size={28} /><div><p className="eyebrow">Этап {phaseIndex + 1} из {CAMPAIGN_PHASES.length}</p><h2>{currentPhase.label}</h2><p>{currentPhase.description}</p></div></div>
      <div className="progress-track large"><span style={{ width: `${state.campaign.phase.progress}%` }} /></div>
      <div className="campaign-phase-footer"><span>{state.campaign.phase.progress}% до следующего этапа</span><span>{nextPhase ? `Далее: ${nextPhase.label}` : 'Высший этап достигнут'}</span></div>
      <div className="campaign-phase-list">{CAMPAIGN_PHASES.map((phase, index) => <span key={phase.id} className={index <= phaseIndex ? 'reached' : ''}>{index < phaseIndex ? <CheckCircle2 size={14} /> : index === phaseIndex ? <Flag size={14} /> : <span className="phase-dot" />}{phase.label}</span>)}</div>
    </section>

    <section>
      <div className="section-title"><Target size={20} /><div><p className="eyebrow">Главная цель</p><h2>{selectedGoal ? selectedGoal.title : 'Выбери направление кампании'}</h2></div></div>
      <div className="campaign-goal-grid">{state.campaign.goals.map((goal) => <GoalCard key={goal.id} goal={goal} selected={goal.id === state.campaign.selectedGoalId} onSelect={() => onSelectGoal(goal.id)} />)}</div>
    </section>

    <section className="paper-card campaign-identity-section">
      <div className="section-title"><Crown size={20} /><div><p className="eyebrow">Репутационный путь</p><h2>{state.campaign.identity.primaryPath ? GUILD_IDENTITY_PATHS[state.campaign.identity.primaryPath].label : 'Путь ещё не определён'}</h2></div></div>
      <p className="muted">Путь не выбирается кнопкой. Он меняется от публикаций, охоты, политики, торговли и работы с опасными знаниями.</p>
      <div className="identity-grid">{identityEntries.sort((a, b) => b[1] - a[1]).map(([id, score]) => <article key={id} className={state.campaign.identity.primaryPath === id ? 'primary' : ''}><div><strong>{GUILD_IDENTITY_PATHS[id].label}</strong><b>{score}</b></div><div className="progress-track"><span style={{ width: `${score}%` }} /></div><small>{GUILD_IDENTITY_PATHS[id].description}</small></article>)}</div>
    </section>

    <section className="campaign-pacing-grid">
      <article className="paper-card"><span><Sparkles size={18} /><strong>Темп историй</strong></span><b>{activeChains.length}</b><small>активно · {dormantChains.length} ждут своего этапа</small></article>
      <article className="paper-card"><span><LibraryBig size={18} /><strong>События</strong></span><b>{totalEvents}</b><small>{uniqueEvents} уникальных сцен</small></article>
      <article className={`paper-card ${repeatRate > 35 ? 'warning-card' : ''}`}><span><ActivityIcon /><strong>Повторяемость</strong></span><b>{repeatRate}%</b><small>{repeatRate <= 25 ? 'вариативность стабильна' : 'движок снижает вес повторов'}</small></article>
      <article className="paper-card"><span><Trophy size={18} /><strong>Завершённые линии</strong></span><b>{state.campaign.telemetry.completedChainIds.length}</b><small>из {state.storyChains.length} созданных для seed</small></article>
    </section>
  </div>
}

function ActivityIcon() { return <Sparkles size={18} /> }
