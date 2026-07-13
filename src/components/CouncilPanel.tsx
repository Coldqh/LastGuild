import { Gavel, Scale, ShieldCheck, UsersRound } from 'lucide-react'
import type { CouncilVoteChoice, GameState, GuildCharter } from '../types/game'

interface Props {
  state: GameState
  onSeat: (seatId: string, holderId?: string) => void
  onProposal: (proposalId: string, choice: CouncilVoteChoice) => void
  onCharter: <K extends keyof GuildCharter>(key: K, value: GuildCharter[K]) => void
}

const charterLabels = {
  leadershipSelection: ['appointed', 'council', 'veterans'], artifactRights: ['guild', 'finder_share', 'sponsor'], missingExpeditions: ['mandatory', 'case_by_case', 'optional'], archiveAccess: ['open', 'ranked', 'restricted'], familyCompensation: ['none', 'standard', 'generous'], branchAuthority: ['centralized', 'limited', 'autonomous'],
} as const
const values: Record<string, string> = { appointed: 'Преемника назначает глава', council: 'Главу выбирает совет', veterans: 'Решают ветераны', guild: 'Находки принадлежат гильдии', finder_share: 'Первооткрыватель получает долю', sponsor: 'Права получает спонсор', mandatory: 'Пропавших ищут обязательно', case_by_case: 'Решение по обстоятельствам', optional: 'Спасение не гарантировано', open: 'Открытый архив', ranked: 'Доступ по рангу', restricted: 'Закрытый архив', none: 'Без компенсаций', standard: 'Стандартные выплаты', generous: 'Щедрые выплаты', centralized: 'Все решения у центра', limited: 'Ограниченная автономия', autonomous: 'Широкая автономия' }
const charterNames: Record<keyof GuildCharter, string> = { leadershipSelection: 'Выбор главы', artifactRights: 'Права на находки', missingExpeditions: 'Пропавшие отряды', archiveAccess: 'Доступ к архиву', familyCompensation: 'Семьи погибших', branchAuthority: 'Полномочия филиалов' }

export default function CouncilPanel({ state, onSeat, onProposal, onCharter }: Props) {
  const candidates = state.characters.filter((entry) => entry.employed && !entry.assignedBranchId && !['dead', 'missing', 'retired', 'expedition'].includes(entry.status))
  const pending = state.councilProposals.find((entry) => entry.status === 'pending')
  return <section className="view focused-view council-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Внутренняя власть</p><h1>Совет и управление</h1><p>Текущие назначения и решения открыты сразу. Фракции и устав свёрнуты, чтобы не забивать экран.</p></div><div className="capacity-badge"><Gavel size={18} /><b>{state.council.filter((entry) => entry.holderId).length}/{state.council.length}</b><span>мест занято</span></div></header>

    <div className="council-primary-grid">
      <section className="paper-card proposal-card priority-card">
        <div className="section-title"><Scale size={20} /><div><p className="eyebrow">Главное решение</p><h2>{pending ? 'Текущий вопрос' : 'Совет свободен'}</h2></div></div>
        {pending ? <><h3>{pending.title}</h3><p>{pending.description}</p><div className="proposal-score"><span>Поддержка</span><strong className={pending.supportScore >= 0 ? 'positive' : 'negative'}>{pending.supportScore > 0 ? '+' : ''}{pending.supportScore}</strong></div><div className="button-row"><button className="primary-button" onClick={() => onProposal(pending.id, 'support')}>Поддержать</button><button className="secondary-button" onClick={() => onProposal(pending.id, 'abstain')}>Воздержаться</button><button className="danger-button" onClick={() => onProposal(pending.id, 'oppose')}>Отклонить</button></div></> : <p className="muted">Новых вопросов нет. Следующее голосование появится при внутреннем конфликте или росте гильдии.</p>}
      </section>

      <section className="paper-card council-seats compact-council-seats">
        <div className="section-title"><Gavel size={20} /><div><p className="eyebrow">Руководство</p><h2>Места совета</h2></div></div>
        {state.council.map((seat) => <article key={seat.id}><div><strong>{seat.name}</strong><span>влияние {seat.influence}</span></div><select value={seat.holderId ?? ''} onChange={(event) => onSeat(seat.id, event.target.value || undefined)}><option value="">Вакансия</option>{candidates.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></article>)}
      </section>
    </div>


    <details className="paper-card management-disclosure">
      <summary><UsersRound size={19} /><span><b>Группы влияния</b><small>{state.guildFactions.length} внутренних лагерей</small></span></summary>
      <div className="faction-grid compact-faction-grid">{state.guildFactions.map((faction) => { const leader = state.characters.find((entry) => entry.id === faction.leaderId); return <article key={faction.id}><div className="faction-top"><h3>{faction.name}</h3><span>{faction.memberIds.length}</span></div><p>{faction.demand}</p><div className="faction-compact-stats"><span>Влияние <b>{faction.influence}</b></span><span>Лояльность <b>{faction.loyalty}</b></span></div><small>{leader?.name ?? 'без лидера'}</small></article> })}</div>
    </details>

    <details className="paper-card management-disclosure">
      <summary><ShieldCheck size={19} /><span><b>Устав</b><small>{state.guild.charterInfluence} единиц влияния</small></span></summary>
      <div className="charter-grid compact-charter-grid">{Object.entries(charterLabels).map(([key, options]) => <label key={key}><span>{charterNames[key as keyof GuildCharter]}</span><select value={state.charter[key as keyof GuildCharter] as string} onChange={(event) => onCharter(key as keyof GuildCharter, event.target.value as never)}>{options.map((option) => <option key={option} value={option}>{values[option]}</option>)}</select></label>)}</div>
    </details>
  </section>
}
