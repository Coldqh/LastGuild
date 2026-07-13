import { Gavel, Landmark, Scale, ShieldCheck, UsersRound } from 'lucide-react'
import { useState } from 'react'
import type { CouncilVoteChoice, GameState, GuildCharter, GuildMemorial } from '../types/game'

interface Props {
  state: GameState
  onSeat: (seatId: string, holderId?: string) => void
  onProposal: (proposalId: string, choice: CouncilVoteChoice) => void
  onCharter: <K extends keyof GuildCharter>(key: K, value: GuildCharter[K]) => void
  onMemorial: (characterId: string, type: GuildMemorial['type']) => void
}

const charterLabels = {
  leadershipSelection: ['appointed', 'council', 'veterans'], artifactRights: ['guild', 'finder_share', 'sponsor'], missingExpeditions: ['mandatory', 'case_by_case', 'optional'], archiveAccess: ['open', 'ranked', 'restricted'], familyCompensation: ['none', 'standard', 'generous'], branchAuthority: ['centralized', 'limited', 'autonomous'],
} as const
const values: Record<string, string> = { appointed: 'Преемника назначает глава', council: 'Главу выбирает совет', veterans: 'Решают ветераны', guild: 'Все находки принадлежат гильдии', finder_share: 'Первооткрыватель получает долю', sponsor: 'Права получает спонсор', mandatory: 'Пропавших ищут обязательно', case_by_case: 'Решение по каждому случаю', optional: 'Спасение не гарантировано', open: 'Открытый архив', ranked: 'Доступ по рангу', restricted: 'Закрытый архив', none: 'Без компенсаций', standard: 'Стандартные выплаты', generous: 'Щедрые выплаты', centralized: 'Все решения у центра', limited: 'Ограниченная автономия', autonomous: 'Широкая автономия' }

export default function CouncilPanel({ state, onSeat, onProposal, onCharter, onMemorial }: Props) {
  const [memorialCharacter, setMemorialCharacter] = useState('')
  const [memorialType, setMemorialType] = useState<GuildMemorial['type']>('portrait')
  const candidates = state.characters.filter((entry) => entry.employed && !entry.assignedBranchId && !['dead', 'missing'].includes(entry.status))
  const legacyCandidates = state.characters.filter((entry) => ['dead', 'retired'].includes(entry.status) && (entry.expeditions >= 3 || entry.fame >= 20))
  const pending = state.councilProposals.find((entry) => entry.status === 'pending')
  return <div className="headquarters-tab-content council-layout">
    <div className="council-grid">
      <section className="paper-card council-seats">
        <div className="section-title"><Gavel size={20} /><div><p className="eyebrow">Руководство</p><h2>Совет гильдии</h2></div></div>
        {state.council.map((seat) => <article key={seat.id}><div><strong>{seat.name}</strong><span>влияние {seat.influence}</span></div><select value={seat.holderId ?? ''} onChange={(event) => onSeat(seat.id, event.target.value || undefined)}><option value="">Вакансия</option>{candidates.map((character) => <option key={character.id} value={character.id}>{character.name} · лидерство {character.skills.leadership}</option>)}</select></article>)}
      </section>

      <section className="paper-card proposal-card">
        <div className="section-title"><Scale size={20} /><div><p className="eyebrow">Голосование</p><h2>Текущий вопрос</h2></div></div>
        {pending ? <><h3>{pending.title}</h3><p>{pending.description}</p><div className="proposal-score"><span>Внутренняя поддержка</span><strong className={pending.supportScore >= 0 ? 'positive' : 'negative'}>{pending.supportScore > 0 ? '+' : ''}{pending.supportScore}</strong></div><div className="vote-list">{pending.votes.map((vote) => { const person = state.characters.find((entry) => entry.id === vote.voterId); return <span key={vote.voterId}>{person?.name}: <b>{vote.choice === 'support' ? 'за' : vote.choice === 'oppose' ? 'против' : 'воздержался'}</b></span> })}</div><div className="button-row"><button className="primary-button" onClick={() => onProposal(pending.id, 'support')}>Поддержать</button><button className="secondary-button" onClick={() => onProposal(pending.id, 'abstain')}>Не вмешиваться</button><button className="danger-button" onClick={() => onProposal(pending.id, 'oppose')}>Выступить против</button></div></> : <div className="empty-state"><Gavel size={28} /><h3>Нет вопроса на голосовании</h3><p>Совет соберётся при росте гильдии или очередном внутреннем конфликте.</p></div>}
      </section>
    </div>

    <section className="paper-card factions-panel">
      <div className="section-title"><UsersRound size={20} /><div><p className="eyebrow">Внутренняя политика</p><h2>Группы влияния</h2></div></div>
      <div className="faction-grid">{state.guildFactions.map((faction) => { const leader = state.characters.find((entry) => entry.id === faction.leaderId); return <article key={faction.id}><div className="faction-top"><h3>{faction.name}</h3><span>{faction.memberIds.length} чел.</span></div><p>{faction.agenda}</p><strong>{faction.demand}</strong><div className="faction-bars"><span>Влияние <b>{faction.influence}</b></span><div className="progress-line"><i style={{ width: `${faction.influence}%` }} /></div><span>Лояльность <b>{faction.loyalty}</b></span><div className="progress-line loyalty"><i style={{ width: `${faction.loyalty}%` }} /></div></div><small>Лидер: {leader?.name ?? 'нет'}</small></article> })}</div>
    </section>

    <section className="paper-card charter-panel">
      <div className="section-title"><ShieldCheck size={20} /><div><p className="eyebrow">Правила института</p><h2>Устав</h2></div></div>
      <p className="section-note">Изменение одного пункта требует 1 единицу уставного влияния. Доступно: {state.guild.charterInfluence}.</p>
      <div className="charter-grid">{Object.entries(charterLabels).map(([key, options]) => <label key={key}><span>{key}</span><select value={state.charter[key as keyof GuildCharter] as string} onChange={(event) => onCharter(key as keyof GuildCharter, event.target.value as never)}>{options.map((option) => <option key={option} value={option}>{values[option]}</option>)}</select></label>)}</div>
    </section>

    <div className="council-grid">
      <section className="paper-card generations-panel">
        <div className="section-title"><Landmark size={20} /><div><p className="eyebrow">Эпохи гильдии</p><h2>Поколения</h2></div></div>
        {state.generations.map((generation) => <article key={generation.id}><div><strong>{generation.name}</strong><span>{generation.startedYear}–{generation.endedYear ?? 'сейчас'}</span></div><p>{generation.memberIds.length} участников · {generation.doctrineIds.length} школ</p><small>{generation.definingEvents.join(' · ')}</small></article>)}
      </section>
      <section className="paper-card memorial-panel">
        <div className="section-title"><Landmark size={20} /><div><p className="eyebrow">Наследие</p><h2>Памятные объекты</h2></div></div>
        <div className="memorial-form"><select value={memorialCharacter} onChange={(event) => setMemorialCharacter(event.target.value)}><option value="">Выбрать ветерана</option>{legacyCandidates.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><select value={memorialType} onChange={(event) => setMemorialType(event.target.value as GuildMemorial['type'])}><option value="portrait">Портрет</option><option value="memorial">Мемориал</option><option value="award">Именная награда</option><option value="school">Школа</option><option value="hall">Зал</option></select><button className="secondary-button" disabled={!memorialCharacter} onClick={() => onMemorial(memorialCharacter, memorialType)}>Учредить</button></div>
        {state.memorials.map((memorial) => <article key={memorial.id}><strong>{memorial.name}</strong><span>{memorial.effect}</span></article>)}
      </section>
    </div>
  </div>
}
