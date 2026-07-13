import { useMemo, useState } from 'react'
import {
  BadgeAlert,
  Building2,
  Crown,
  GitBranch,
  Handshake,
  Landmark,
  Network,
  Scale,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react'
import type {
  BranchAutonomy,
  BranchSpecialization,
  CharacterSkills,
  GameState,
} from '../types/game'
import { autonomyLabels, specializationLabels } from '../game/strategy'

interface Props {
  state: GameState
  onRivalAction: (rivalId: string, action: 'cooperate' | 'exchange' | 'pressure') => void
  onOpenBranch: (settlementId: string, leaderId: string, specialization: BranchSpecialization, autonomy: BranchAutonomy) => void
  onChangeBranchAutonomy: (branchId: string, autonomy: BranchAutonomy) => void
  onRespondCrisis: (crisisId: string, mode: 'fund' | 'expedition' | 'neutral') => void
  onAssignMentorship: (mentorId: string, apprenticeId: string, skill: keyof CharacterSkills) => void
  onAppointLeader: (characterId: string) => void
}

type Tab = 'rivals' | 'politics' | 'branches' | 'generations'

const stanceLabels = {
  allied: 'союз', cooperative: 'сотрудничество', neutral: 'нейтралитет', competitive: 'соперничество', hostile: 'вражда',
}

const archetypeLabels = {
  royal: 'Королевская служба', academic: 'Академическое общество', hunters: 'Охотники', traders: 'Торговая компания', relic_raiders: 'Грабители реликвий', religious: 'Религиозный орден', free_company: 'Вольная компания', secret: 'Тайное общество',
}

const crisisLabels = {
  emerging: 'назревает', active: 'активный кризис', resolved: 'урегулирован', collapsed: 'катастрофа',
}

const skillLabels: Record<keyof CharacterSkills, string> = {
  combat: 'бой', survival: 'выживание', scouting: 'разведка', medicine: 'медицина', arcana: 'магия', history: 'история', cartography: 'картография', diplomacy: 'дипломатия', leadership: 'лидерство',
}

export default function InfluenceView({ state, onRivalAction, onOpenBranch, onChangeBranchAutonomy, onRespondCrisis, onAssignMentorship, onAppointLeader }: Props) {
  const [tab, setTab] = useState<Tab>('rivals')
  const [branchSettlement, setBranchSettlement] = useState('')
  const [branchLeader, setBranchLeader] = useState('')
  const [branchSpecialization, setBranchSpecialization] = useState<BranchSpecialization>('cartography')
  const [branchAutonomy, setBranchAutonomy] = useState<BranchAutonomy>('limited')
  const [mentorId, setMentorId] = useState('')
  const [apprenticeId, setApprenticeId] = useState('')
  const [mentorSkill, setMentorSkill] = useState<keyof CharacterSkills>('survival')

  const branchCost = 900 + state.branches.length * 450
  const possibleSettlements = state.world.settlements.filter((settlement) => !settlement.isGuildHome && !state.branches.some((branch) => branch.settlementId === settlement.id))
  const possibleLeaders = state.characters.filter((character) => character.employed && !['dead', 'missing', 'retired', 'expedition'].includes(character.status) && character.skills.leadership >= 3 && !character.assignedBranchId)
  const mentors = state.characters.filter((character) => character.employed && character.level >= 3 && !['dead', 'missing'].includes(character.status))
  const apprentices = state.characters.filter((character) => character.employed && character.level <= 3 && !character.mentorId && !['dead', 'missing'].includes(character.status))
  const currentLeader = state.characters.find((character) => character.id === state.guild.leaderId)
  const pendingRaces = state.rivalExpeditions.filter((expedition) => ['preparing', 'traveling'].includes(expedition.status))

  const strongestRival = useMemo(() => [...state.rivalGuilds].sort((a, b) => b.reputation + b.fieldStrength - (a.reputation + a.fieldStrength))[0], [state.rivalGuilds])
  const crisisPressure = state.crises.filter((crisis) => ['emerging', 'active'].includes(crisis.status)).reduce((sum, crisis) => sum + crisis.severity, 0)

  return (
    <section className="view influence-view">
      <header className="view-heading">
        <div><p className="eyebrow">Стратегический слой</p><h1>Влияние, конкуренты и поколения</h1><p>Другие организации идут к тем же руинам, государства требуют лояльности, филиалы накапливают собственную власть, а ветераны передают опыт следующему поколению.</p></div>
        <div className="date-seal">{state.rivalGuilds.length}<small>гильдий</small></div>
      </header>

      <div className="metric-grid influence-metrics">
        <article className="metric-card"><Network /><div><span>Главный конкурент</span><strong>{strongestRival?.name ?? 'нет'}</strong><small>{strongestRival ? stanceLabels[strongestRival.stance] : 'регион свободен'}</small></div></article>
        <article className="metric-card"><GitBranch /><div><span>Филиалы</span><strong>{state.branches.length}</strong><small>{state.branches.reduce((sum, branch) => sum + branch.staff, 0)} сотрудников</small></div></article>
        <article className="metric-card"><ShieldAlert /><div><span>Кризисное давление</span><strong>{crisisPressure}</strong><small>{state.crises.filter((crisis) => crisis.status === 'active').length} активных</small></div></article>
        <article className="metric-card"><Crown /><div><span>Руководитель</span><strong>{currentLeader?.name ?? 'вакансия'}</strong><small>{currentLeader ? `лидерство ${currentLeader.skills.leadership}` : 'нужен преемник'}</small></div></article>
        <article className="metric-card"><Users /><div><span>Наставничество</span><strong>{state.mentorships.length}</strong><small>активных связей</small></div></article>
        <article className="metric-card"><Swords /><div><span>Гонки</span><strong>{pendingRaces.length}</strong><small>чужих экспедиций в пути</small></div></article>
      </div>

      <div className="strategic-tabs paper-card">
        <button className={tab === 'rivals' ? 'active' : ''} onClick={() => setTab('rivals')}><Swords size={17} />Конкуренты</button>
        <button className={tab === 'politics' ? 'active' : ''} onClick={() => setTab('politics')}><Landmark size={17} />Политика</button>
        <button className={tab === 'branches' ? 'active' : ''} onClick={() => setTab('branches')}><GitBranch size={17} />Филиалы</button>
        <button className={tab === 'generations' ? 'active' : ''} onClick={() => setTab('generations')}><Users size={17} />Поколения</button>
      </div>

      {tab === 'rivals' && <div className="rival-grid">
        {state.rivalGuilds.length === 0 && <article className="paper-card empty-rivals-card"><Swords /><div><h2>Конкуренты отключены</h2><p>Чужие гильдии, гонки за контрактами и переманивание людей выключены в настройках. Политика государств, кризисы, филиалы и поколения продолжают работать.</p></div></article>}
        {state.rivalGuilds.map((rival) => {
          const settlement = state.world.settlements.find((entry) => entry.id === rival.headquartersSettlementId)
          const active = state.rivalExpeditions.find((entry) => entry.rivalGuildId === rival.id && ['preparing', 'traveling'].includes(entry.status))
          return <article className={`paper-card rival-card stance-${rival.stance}`} key={rival.id}>
            <div className="rival-card-head"><div><span className="type-chip">{archetypeLabels[rival.archetype]}</span><h2>{rival.name}</h2></div><b>{stanceLabels[rival.stance]}</b></div>
            <p>{rival.leaderName} · {rival.leaderTrait}. Штаб: {settlement?.name ?? 'неизвестно'}.</p>
            <div className="rival-stat-grid"><span>Репутация <b>{rival.reputation}</b></span><span>Полевая сила <b>{rival.fieldStrength}</b></span><span>Наука <b>{rival.scientificAuthority}</b></span><span>Секретность <b>{rival.secrecy}</b></span></div>
            <div className="rival-methods">{rival.methods.map((method) => <span key={method}>{method}</span>)}</div>
            {active ? <div className="rival-race"><strong>{active.status === 'preparing' ? 'Готовит' : 'В пути'}: {active.title}</strong><div><i style={{ width: `${Math.min(100, active.progress)}%` }} /></div><small>{Math.round(active.progress)}% · сила {active.strength}</small></div> : <p className="muted">Активной экспедиции нет.</p>}
            <div className="button-row rival-actions"><button className="secondary-button" disabled={state.guild.treasury < 120} onClick={() => onRivalAction(rival.id, 'cooperate')}><Handshake size={15} />Совместная работа · 120</button><button className="secondary-button" disabled={state.guild.treasury < 60} onClick={() => onRivalAction(rival.id, 'exchange')}><Sparkles size={15} />Обмен · 60</button><button className="secondary-button danger-action" disabled={state.guild.politicalInfluence < 3} onClick={() => onRivalAction(rival.id, 'pressure')}><Scale size={15} />Давление · 3 влияния</button></div>
          </article>
        })}
      </div>}

      {tab === 'politics' && <div className="politics-layout">
        <div className="realm-politics-list">
          {state.world.realms.map((realm) => {
            const factions = state.politicalFactions.filter((faction) => faction.realmId === realm.id).sort((a, b) => b.influence - a.influence)
            return <article className="paper-card realm-politics-card" key={realm.id}><div className="realm-politics-head"><span style={{ background: realm.color }} /><div><p className="eyebrow">{realm.government}</p><h2>{realm.name}</h2></div><b>{realm.attitude >= 20 ? 'дружелюбно' : realm.attitude <= -20 ? 'враждебно' : 'настороженно'}</b></div><p>{realm.ruler}. {realm.currentIssue}</p><div className="realm-state-line"><span>Стабильность <b>{realm.stability}</b></span><span>Богатство <b>{realm.wealth}</b></span><span>Военная сила <b>{realm.military}</b></span></div><div className="faction-list">{factions.map((faction) => <div key={faction.id}><span><strong>{faction.name}</strong><small>{faction.agenda}</small></span><b>{faction.influence}%</b><em className={faction.attitude < 0 ? 'negative' : 'positive'}>{faction.attitude > 0 ? '+' : ''}{faction.attitude}</em></div>)}</div></article>
          })}
        </div>
        <aside className="crisis-stack">
          {state.crises.map((crisis) => <article className={`paper-card crisis-card status-${crisis.status}`} key={crisis.id}><div className="crisis-top"><BadgeAlert /><span>{crisisLabels[crisis.status]}</span><b>{crisis.severity}</b></div><h3>{crisis.title}</h3><p>{crisis.description}</p><div className="crisis-progress"><span style={{ width: `${Math.min(100, crisis.progress)}%` }} /></div><small>Развитие {Math.round(crisis.progress)}% · вклад гильдии {crisis.playerContribution}</small><div className="crisis-effects">{crisis.effects.map((effect) => <span key={effect}>{effect}</span>)}</div>{!['resolved', 'collapsed'].includes(crisis.status) && <div className="button-row"><button className="secondary-button" disabled={state.guild.treasury < 240} onClick={() => onRespondCrisis(crisis.id, 'fund')}>Финансировать · 240</button><button className="secondary-button" disabled={state.guild.treasury < 100} onClick={() => onRespondCrisis(crisis.id, 'expedition')}>Полевая помощь · 100</button><button className="text-button" onClick={() => onRespondCrisis(crisis.id, 'neutral')}>Не вмешиваться</button></div>}</article>)}
        </aside>
      </div>}

      {tab === 'branches' && <div className="branches-layout">
        <article className="paper-card branch-create-card"><div className="section-title"><Building2 /><div><p className="eyebrow">Региональная сеть</p><h2>Открыть филиал</h2></div></div><p>Филиал приносит местные контракты и влияние, но собственный руководитель, деньги и сотрудники постепенно создают отдельный центр силы.</p><label>Город<select value={branchSettlement} onChange={(event) => setBranchSettlement(event.target.value)}><option value="">Выбери поселение</option>{possibleSettlements.map((settlement) => <option value={settlement.id} key={settlement.id}>{settlement.name} · {settlement.kind} · процветание {settlement.prosperity}</option>)}</select></label><label>Руководитель<select value={branchLeader} onChange={(event) => setBranchLeader(event.target.value)}><option value="">Выбери человека</option>{possibleLeaders.map((character) => <option value={character.id} key={character.id}>{character.name} · лидерство {character.skills.leadership} · лояльность {character.loyalty}</option>)}</select></label><label>Специализация<select value={branchSpecialization} onChange={(event) => setBranchSpecialization(event.target.value as BranchSpecialization)}>{Object.entries(specializationLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>Автономия<select value={branchAutonomy} onChange={(event) => setBranchAutonomy(event.target.value as BranchAutonomy)}>{Object.entries(autonomyLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><button className="primary-button" disabled={!branchSettlement || !branchLeader || state.guild.treasury < branchCost || state.guild.rank < 2} onClick={() => onOpenBranch(branchSettlement, branchLeader, branchSpecialization, branchAutonomy)}>Открыть филиал · {branchCost} кр.</button>{state.guild.rank < 2 && <small className="danger-text">Требуется второй ранг гильдии.</small>}</article>
        <div className="branch-list">{state.branches.length === 0 ? <div className="empty-state paper-card"><GitBranch /><h3>Региональной сети ещё нет</h3><p>Первый филиал станет серьёзным шагом за пределы провинциального штаба.</p></div> : state.branches.map((branch) => { const settlement = state.world.settlements.find((entry) => entry.id === branch.settlementId); const leader = state.characters.find((entry) => entry.id === branch.leaderId); return <article className="paper-card branch-card" key={branch.id}><div className="branch-card-top"><div><p className="eyebrow">{specializationLabels[branch.specialization]}</p><h2>{branch.name}</h2></div><b>{branch.loyalty}%</b></div><p>{settlement?.name} · руководитель {leader?.name ?? 'неизвестен'}</p><div className="branch-stats"><span>Штат <b>{branch.staff}</b></span><span>Казна <b>{branch.treasury}</b></span><span>Доход <b>{branch.income}</b></span><span>Содержание <b>{branch.upkeep}</b></span></div><label>Автономия<select value={branch.autonomy} onChange={(event) => onChangeBranchAutonomy(branch.id, event.target.value as BranchAutonomy)}>{Object.entries(autonomyLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>{branch.hiddenFunds > 0 && <div className="branch-warning"><ShieldAlert />Непрозрачные средства: {branch.hiddenFunds} кр.</div>}</article> })}</div>
      </div>}

      {tab === 'generations' && <div className="generations-layout">
        <article className="paper-card succession-card"><div className="section-title"><Crown /><div><p className="eyebrow">Преемственность</p><h2>Руководство гильдии</h2></div></div>{currentLeader ? <div className="current-leader"><strong>{currentLeader.name}</strong><span>{currentLeader.profession} · {currentLeader.age} лет</span><small>Лидерство {currentLeader.skills.leadership} · слава {currentLeader.fame} · лояльность {currentLeader.loyalty}</small></div> : <p className="danger-text">Должность главы вакантна.</p>}<div className="successor-list">{possibleLeaders.sort((a, b) => b.skills.leadership - a.skills.leadership).slice(0, 8).map((character) => <button className={character.id === state.guild.leaderId ? 'active' : ''} disabled={character.skills.leadership < 4} key={character.id} onClick={() => onAppointLeader(character.id)}><span><strong>{character.name}</strong><small>{character.profession} · лидерство {character.skills.leadership}</small></span><b>{character.fame}</b></button>)}</div></article>
        <article className="paper-card mentorship-create"><div className="section-title"><Users /><div><p className="eyebrow">Передача опыта</p><h2>Наставник и ученик</h2></div></div><label>Наставник<select value={mentorId} onChange={(event) => setMentorId(event.target.value)}><option value="">Выбери ветерана</option>{mentors.map((character) => <option key={character.id} value={character.id}>{character.name} · ур. {character.level}</option>)}</select></label><label>Ученик<select value={apprenticeId} onChange={(event) => setApprenticeId(event.target.value)}><option value="">Выбери новичка</option>{apprentices.filter((character) => character.id !== mentorId).map((character) => <option key={character.id} value={character.id}>{character.name} · ур. {character.level}</option>)}</select></label><label>Передаваемый навык<select value={mentorSkill} onChange={(event) => setMentorSkill(event.target.value as keyof CharacterSkills)}>{Object.entries(skillLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className="primary-button" disabled={!mentorId || !apprenticeId} onClick={() => onAssignMentorship(mentorId, apprenticeId, mentorSkill)}>Назначить наставничество</button><div className="mentorship-list">{state.mentorships.map((mentorship) => { const mentor = state.characters.find((entry) => entry.id === mentorship.mentorId); const apprentice = state.characters.find((entry) => entry.id === mentorship.apprenticeId); return <div key={mentorship.id}><span><strong>{mentor?.name}</strong><small>учит: {apprentice?.name}</small></span><b>{Math.round(mentorship.progress)}%</b><i style={{ width: `${mentorship.progress}%` }} /></div> })}</div></article>
      </div>}
    </section>
  )
}
