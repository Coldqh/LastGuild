import { useState } from 'react'
import { Banknote, BookOpen, Boxes, BriefcaseBusiness, Building2, GraduationCap, Gavel, Home, Landmark, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react'
import AcademyPanel from './AcademyPanel'
import CouncilPanel from './CouncilPanel'
import HiringPanel from './HiringPanel'
import type { AcademyProgramId, CouncilVoteChoice, GameState, GuildCharter, GuildMemorial, GuildPositionId } from '../types/game'

type HeadquartersTab = 'overview' | 'hiring' | 'rooms' | 'positions' | 'academy' | 'council'

interface Props {
  state: GameState
  onUpgrade: (roomId: string) => void
  onPayDebt: (amount: number) => void
  onAssignPosition: (positionId: GuildPositionId, holderId?: string) => void
  onHire: (characterId: string) => void
  onEnrollStudent: (characterId: string, programId: AcademyProgramId, mentorId?: string) => void
  onAssignAcademyMentor: (enrollmentId: string, mentorId?: string) => void
  onAcademyExam: (enrollmentId: string) => void
  onGraduate: (enrollmentId: string) => void
  onUpgradeAcademy: () => void
  onCouncilSeat: (seatId: string, holderId?: string) => void
  onProposal: (proposalId: string, choice: CouncilVoteChoice) => void
  onCharter: <K extends keyof GuildCharter>(key: K, value: GuildCharter[K]) => void
  onFoundDoctrine: (founderId: string) => void
  onMemorial: (characterId: string, type: GuildMemorial['type']) => void
}

const metricIcons = [Banknote, Landmark, BookOpen, Users, ShieldCheck, Sparkles]
const tabs: Array<{ id: HeadquartersTab; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Обзор', icon: Home },
  { id: 'hiring', label: 'Наём', icon: UserPlus },
  { id: 'rooms', label: 'Помещения', icon: Building2 },
  { id: 'positions', label: 'Должности', icon: BriefcaseBusiness },
  { id: 'academy', label: 'Академия', icon: GraduationCap },
  { id: 'council', label: 'Совет', icon: Gavel },
]

export default function GuildView(props: Props) {
  const { state, onUpgrade, onPayDebt, onAssignPosition } = props
  const [tab, setTab] = useState<HeadquartersTab>('overview')
  const active = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning').length
  const payroll = state.characters.filter((character) => character.employed && character.status !== 'dead' && character.status !== 'retired').reduce((sum, character) => sum + character.salary, 0)
  const maintenance = state.guild.rooms.reduce((sum, room) => sum + room.maintenance, 0)
  const quartermasterDiscount = state.guild.positions.find((position) => position.id === 'quartermaster')?.holderId ? 0.92 : 1
  const monthlyTotal = Math.ceil((payroll + maintenance + Math.ceil(state.guild.debt * state.guild.debtInterest) + state.academy.monthlyCost) * quartermasterDiscount)
  const candidates = state.characters.filter((character) => character.employed && !['dead', 'missing'].includes(character.status))
  const externalCandidates = state.characters.filter((character) => !character.employed && !character.rivalGuildId && !character.academyEnrollmentId && !['dead', 'missing', 'retired'].includes(character.status)).length
  const metrics = [
    ['Казна', `${state.guild.treasury} кр.`, 'Доступные средства'],
    ['Долг', `${state.guild.debt} кр.`, `${Math.round(state.guild.debtInterest * 100)}% в месяц`],
    ['Авторитет', state.guild.scientificAuthority, 'Научное признание'],
    ['Состав', state.characters.filter((character) => character.employed && character.status !== 'dead').length, `${active}/${state.guild.maxActiveExpeditions} экспедиций`],
    ['Устойчивость', `${state.guild.stability}%`, 'Способность пережить кризис'],
    ['Память', state.guild.institutionalMemory, `${state.generations.length} поколений`],
  ]

  const renderOverview = () => <div className="headquarters-tab-content">
    <div className="metric-grid">{metrics.map(([label, value, note], index) => { const Icon = metricIcons[index]; return <article className="metric-card" key={label}><Icon size={19} /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article> })}</div>
    <div className="headquarters-quick-actions">
      <button className="headquarters-action primary" onClick={() => setTab('hiring')}><UserPlus size={24} /><div><strong>Открыть наём</strong><span>{externalCandidates} свободных кандидатов</span></div></button>
      <button className="headquarters-action" onClick={() => setTab('academy')}><GraduationCap size={24} /><div><strong>Академия</strong><span>{state.academy.enrollments.filter((entry) => ['training', 'ready'].includes(entry.status)).length}/{state.academy.seats} учеников</span></div></button>
      <button className="headquarters-action" onClick={() => setTab('council')}><Gavel size={24} /><div><strong>Совет</strong><span>{state.councilProposals.filter((entry) => entry.status === 'pending').length} вопросов</span></div></button>
    </div>
    <div className="dashboard-grid">
      <div className="guild-main-stack">
        <article className="paper-card guild-status-card"><div className="section-title"><Building2 size={19} /><div><p className="eyebrow">Организация</p><h2>Состояние штаба</h2></div></div><div className="guild-status-list"><span>Глава <b>{state.characters.find((entry) => entry.id === state.guild.leaderId)?.name ?? 'не назначен'}</b></span><span>Академия <b>ур. {state.academy.level}</b></span><span>Совет <b>{state.council.filter((entry) => entry.holderId).length}/{state.council.length}</b></span><span>Фракции <b>{state.guildFactions.length}</b></span><span>Уставное влияние <b>{state.guild.charterInfluence}</b></span></div></article>
        <article className="paper-card generations-summary"><div className="section-title"><Landmark size={19} /><div><p className="eyebrow">Текущая эпоха</p><h2>{state.generations.find((entry) => !entry.endedYear)?.name ?? 'Поколение не определено'}</h2></div></div><p>{state.generations.find((entry) => !entry.endedYear)?.definingEvents.join(' · ')}</p><div className="tag-list">{state.doctrines.slice(-4).map((entry) => <span key={entry.id}>{entry.name}</span>)}</div></article>
      </div>
      <div className="side-stack">
        <article className="paper-card finance-panel"><div className="section-title"><Banknote size={19} /><div><p className="eyebrow">Финансы</p><h2>Месячный прогноз</h2></div></div><div className="finance-line"><span>Жалование</span><strong>−{payroll}</strong></div><div className="finance-line"><span>Содержание</span><strong>−{maintenance}</strong></div><div className="finance-line"><span>Академия</span><strong>−{state.academy.monthlyCost}</strong></div><div className="finance-line"><span>Проценты</span><strong>−{Math.ceil(state.guild.debt * state.guild.debtInterest)}</strong></div>{quartermasterDiscount < 1 && <div className="finance-line positive"><span>Экономия квартмейстера</span><strong>−8%</strong></div>}<div className="finance-total"><span>Обязательные расходы</span><strong>{monthlyTotal} кр.</strong></div><div className="button-row"><button className="secondary-button" disabled={state.guild.treasury < 100 || state.guild.debt === 0} onClick={() => onPayDebt(100)}>Внести 100</button><button className="secondary-button" disabled={state.guild.treasury < 500 || state.guild.debt === 0} onClick={() => onPayDebt(500)}>Внести 500</button></div></article>
        <article className="paper-card stores-panel"><div className="section-title"><Boxes size={19} /><div><p className="eyebrow">Резервы</p><h2>Склад</h2></div></div><div className="store-stat"><span>Провизия</span><strong>{state.guild.supplies}</strong></div><div className="store-stat"><span>Медицина</span><strong>{state.guild.medicine}</strong></div><div className="store-stat"><span>Артефакты</span><strong>{state.guild.artifacts}</strong></div></article>
        <article className="paper-card knowledge-panel"><div className="section-title"><BookOpen size={19} /><div><p className="eyebrow">Архив</p><h2>Области знания</h2></div></div>{Object.entries(state.guild.knowledge).map(([name, value]) => <div className="knowledge-row" key={name}><span>{name}</span><div><i style={{ width: `${Math.min(100, value)}%` }} /></div><strong>{value}</strong></div>)}</article>
      </div>
    </div>
  </div>

  const renderRooms = () => <div className="headquarters-tab-content paper-card rooms-panel"><div className="section-title"><Building2 size={19} /><div><p className="eyebrow">Здание</p><h2>Помещения штаба</h2></div></div><div className="room-grid">{state.guild.rooms.map((room) => <article className="room-card" key={room.id}><div className="room-top"><h3>{room.name}</h3><span>ур. {room.level}</span></div><p>{room.description}</p><div className="progress-line"><span style={{ width: `${room.condition}%` }} /></div><div className="room-meta"><span>Состояние {room.condition}%</span><span>Вместимость {room.capacity}</span></div><div className="room-effect">{room.effect}</div><button className="primary-button small" disabled={state.guild.treasury < room.upgradeCost} onClick={() => onUpgrade(room.id)}>Улучшить · {room.upgradeCost} кр.</button></article>)}</div></div>

  const renderPositions = () => <div className="headquarters-tab-content paper-card positions-panel"><div className="section-title"><BriefcaseBusiness size={19} /><div><p className="eyebrow">Администрация</p><h2>Должности гильдии</h2></div></div><p className="section-note">Должности дают постоянные эффекты и определяют часть мест в совете.</p><div className="position-grid">{state.guild.positions.map((position) => { const holder = state.characters.find((character) => character.id === position.holderId); return <article className={holder ? 'position-card filled' : 'position-card'} key={position.id}><div><h3>{position.name}</h3><span>{holder?.name ?? 'вакансия'}</span></div><p>{position.description}</p><strong>{position.effect}</strong><select value={position.holderId ?? ''} onChange={(event) => onAssignPosition(position.id, event.target.value || undefined)}><option value="">Оставить вакантной</option>{candidates.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.profession} · ур. {character.level}</option>)}</select></article> })}</div></div>

  return <section className="view guild-view">
    <header className="view-heading"><div><p className="eyebrow">Штаб · ранг {state.guild.rank}</p><h1>{state.guild.name}</h1><p>Здание, рынок людей, академия и внутренняя власть теперь собраны в одном центре управления.</p></div><div className="date-seal">{state.year}<small>год</small></div></header>
    <nav className="headquarters-tabs">{tabs.map((item) => { const Icon = item.icon; const badge = item.id === 'hiring' ? externalCandidates : item.id === 'council' ? state.councilProposals.filter((entry) => entry.status === 'pending').length : 0; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17} />{item.label}{badge > 0 && <b>{badge}</b>}</button> })}</nav>
    {tab === 'overview' && renderOverview()}
    {tab === 'hiring' && <HiringPanel state={state} onHire={props.onHire} />}
    {tab === 'rooms' && renderRooms()}
    {tab === 'positions' && renderPositions()}
    {tab === 'academy' && <AcademyPanel state={state} onEnroll={props.onEnrollStudent} onAssignMentor={props.onAssignAcademyMentor} onExam={props.onAcademyExam} onGraduate={props.onGraduate} onUpgrade={props.onUpgradeAcademy} onFoundDoctrine={props.onFoundDoctrine} />}
    {tab === 'council' && <CouncilPanel state={state} onSeat={props.onCouncilSeat} onProposal={props.onProposal} onCharter={props.onCharter} onMemorial={props.onMemorial} />}
  </section>
}
