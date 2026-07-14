import { useMemo, useState } from 'react'
import {
  BadgeAlert,
  Crown,
  Handshake,
  Landmark,
  Network,
  Scale,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react'
import type { CharacterSkills, GameState } from '../types/game'

interface Props {
  state: GameState
  onRivalAction: (rivalId: string, action: 'cooperate' | 'exchange' | 'pressure') => void
  onRespondCrisis: (crisisId: string, mode: 'fund' | 'expedition' | 'neutral') => void
  onAssignMentorship: (mentorId: string, apprenticeId: string, skill: keyof CharacterSkills) => void
  onAppointLeader: (characterId: string) => void
}

type Tab = 'rivals' | 'politics' | 'generations'

const stanceLabels = {
  allied: 'союз', cooperative: 'сотрудничество', neutral: 'нейтралитет', competitive: 'соперничество', hostile: 'вражда',
}

const archetypeLabels = {
  royal: 'Королевская служба', academic: 'Учёное общество', hunters: 'Охотники', traders: 'Торговая компания', relic_raiders: 'Грабители реликвий', religious: 'Религиозный орден', free_company: 'Вольная компания', secret: 'Тайное общество',
}

const crisisLabels = {
  emerging: 'назревает', active: 'активный кризис', resolved: 'урегулирован', collapsed: 'катастрофа',
}

const skillLabels: Record<keyof CharacterSkills, string> = {
  combat: 'бой', survival: 'выживание', scouting: 'разведка', medicine: 'медицина', arcana: 'магия', history: 'история', cartography: 'картография', diplomacy: 'дипломатия', leadership: 'лидерство',
}

export default function InfluenceView({ state, onRivalAction, onRespondCrisis, onAssignMentorship, onAppointLeader }: Props) {
  const [tab, setTab] = useState<Tab>('rivals')
  const [mentorId, setMentorId] = useState('')
  const [apprenticeId, setApprenticeId] = useState('')
  const [mentorSkill, setMentorSkill] = useState<keyof CharacterSkills>('survival')

  const mentors = state.characters.filter((character) => character.employed && character.level >= 3 && !['dead', 'missing'].includes(character.status))
  const apprentices = state.characters.filter((character) => character.employed && character.level <= 3 && !character.mentorId && !['dead', 'missing'].includes(character.status))
  const currentLeader = state.characters.find((character) => character.id === state.guild.leaderId)
  const leaderCandidates = state.characters.filter((character) => character.employed && !['dead', 'missing', 'retired', 'expedition'].includes(character.status) && character.skills.leadership >= 3)
  const strongestRival = useMemo(() => [...state.rivalGuilds].sort((a, b) => b.reputation + b.fieldStrength - (a.reputation + a.fieldStrength))[0], [state.rivalGuilds])
  const crisisPressure = state.crises.filter((crisis) => ['emerging', 'active'].includes(crisis.status)).reduce((sum, crisis) => sum + crisis.severity, 0)

  return (
    <section className="view influence-view">
      <header className="view-heading compact-heading">
        <div><p className="eyebrow">Стратегический слой</p><h1>Влияние</h1></div>
        <div className="living-world-metrics"><span><Network size={15} />{state.rivalGuilds.length} организаций</span><span><ShieldAlert size={15} />{crisisPressure} давление</span></div>
      </header>

      <div className="segmented-control influence-tabs">
        <button className={tab === 'rivals' ? 'active' : ''} onClick={() => setTab('rivals')}><Network size={14} />Организации</button>
        <button className={tab === 'politics' ? 'active' : ''} onClick={() => setTab('politics')}><Landmark size={14} />Политика</button>
        <button className={tab === 'generations' ? 'active' : ''} onClick={() => setTab('generations')}><Users size={14} />Поколения</button>
      </div>

      {tab === 'rivals' && <div className="rival-grid">
        {state.rivalGuilds.map((rival) => {
          const active = state.rivalExpeditions.find((entry) => entry.rivalGuildId === rival.id && ['preparing', 'traveling'].includes(entry.status))
          return <article className="paper-card rival-card" key={rival.id}>
            <div className="rival-card-head"><div><p className="eyebrow">{archetypeLabels[rival.archetype]}</p><h2>{rival.name}</h2></div><span className={`stance-chip ${rival.stance}`}>{stanceLabels[rival.stance]}</span></div>
            <p>{rival.leaderName} · {rival.leaderTrait}</p>
            <div className="rival-stat-grid"><span>Репутация <b>{Math.round(rival.reputation)}</b></span><span>Сила <b>{Math.round(rival.fieldStrength)}</b></span><span>Знания <b>{Math.round(rival.scientificAuthority)}</b></span></div>
            {active && <div className="rival-race"><strong>{active.title}</strong><small>{Math.round(active.progress)}%</small></div>}
            <div className="button-row rival-actions"><button className="secondary-button" disabled={state.guild.treasury < 120} onClick={() => onRivalAction(rival.id, 'cooperate')}><Handshake size={14} />Работа · 120</button><button className="secondary-button" disabled={state.guild.treasury < 60} onClick={() => onRivalAction(rival.id, 'exchange')}><Sparkles size={14} />Обмен · 60</button><button className="secondary-button" disabled={state.guild.politicalInfluence < 3} onClick={() => onRivalAction(rival.id, 'pressure')}><Scale size={14} />Давление</button></div>
          </article>
        })}
        {!state.rivalGuilds.length && <div className="empty-state paper-card"><Network /><h3>Других организаций нет</h3></div>}
      </div>}

      {tab === 'politics' && <div className="politics-layout">
        <div className="realm-politics-list">
          {state.world.realms.map((realm) => {
            const factions = state.politicalFactions.filter((faction) => faction.realmId === realm.id).sort((a, b) => b.influence - a.influence)
            return <article className="paper-card realm-politics-card" key={realm.id}>
              <div className="realm-politics-head"><span style={{ background: realm.color }} /><div><p className="eyebrow">{realm.government}</p><h2>{realm.name}</h2></div></div>
              <div className="realm-state-line"><span>Правитель <b>{realm.ruler}</b></span><span>Стабильность <b>{Math.round(realm.stability)}</b></span><span>Богатство <b>{Math.round(realm.wealth)}</b></span><span>Армия <b>{Math.round(realm.military)}</b></span></div>
              <p>{realm.currentIssue}</p>
              <details><summary>Группы влияния · {factions.length}</summary><div className="faction-list">{factions.map((faction) => <div key={faction.id}><span><strong>{faction.name}</strong><small>{faction.agenda}</small></span><b>{Math.round(faction.influence)}%</b><em>{Math.round(faction.attitude)}</em></div>)}</div></details>
            </article>
          })}
        </div>
        <aside className="crisis-stack">
          {state.crises.map((crisis) => <article className={`paper-card crisis-card status-${crisis.status}`} key={crisis.id}><div className="crisis-top"><BadgeAlert /><span>{crisisLabels[crisis.status]}</span><b>{Math.round(crisis.severity)}</b></div><h3>{crisis.title}</h3><p>{crisis.description}</p><small>{Math.round(crisis.progress)}% · вклад {Math.round(crisis.playerContribution)}</small>{!['resolved', 'collapsed'].includes(crisis.status) && <div className="button-row"><button className="secondary-button" disabled={state.guild.treasury < 240} onClick={() => onRespondCrisis(crisis.id, 'fund')}>Деньги · 240</button><button className="secondary-button" disabled={state.guild.treasury < 100} onClick={() => onRespondCrisis(crisis.id, 'expedition')}>Помощь · 100</button><button className="text-button" onClick={() => onRespondCrisis(crisis.id, 'neutral')}>Не вмешиваться</button></div>}</article>)}
        </aside>
      </div>}

      {tab === 'generations' && <div className="generations-layout">
        <article className="paper-card succession-card"><div className="section-title"><Crown /><div><h2>Руководитель</h2></div></div>{currentLeader && <div className="current-leader"><strong>{currentLeader.name}</strong><span>{currentLeader.profession} · лидерство {currentLeader.skills.leadership}</span></div>}<div className="successor-list">{leaderCandidates.sort((a, b) => b.skills.leadership - a.skills.leadership).slice(0, 8).map((character) => <button className={character.id === state.guild.leaderId ? 'active' : ''} key={character.id} onClick={() => onAppointLeader(character.id)}><span><strong>{character.name}</strong><small>{character.profession} · {character.skills.leadership}</small></span></button>)}</div></article>
        <article className="paper-card mentorship-create"><div className="section-title"><Users /><div><h2>Наставничество</h2></div></div><div className="compact-form-row"><select value={mentorId} onChange={(event) => setMentorId(event.target.value)}><option value="">Наставник</option>{mentors.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><select value={apprenticeId} onChange={(event) => setApprenticeId(event.target.value)}><option value="">Ученик</option>{apprentices.filter((character) => character.id !== mentorId).map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><select value={mentorSkill} onChange={(event) => setMentorSkill(event.target.value as keyof CharacterSkills)}>{Object.entries(skillLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button className="primary-button" disabled={!mentorId || !apprenticeId} onClick={() => onAssignMentorship(mentorId, apprenticeId, mentorSkill)}>Назначить</button></div><div className="mentorship-list">{state.mentorships.map((mentorship) => { const mentor = state.characters.find((entry) => entry.id === mentorship.mentorId); const apprentice = state.characters.find((entry) => entry.id === mentorship.apprenticeId); return <div key={mentorship.id}><span><strong>{mentor?.name}</strong><small>{apprentice?.name}</small></span><b>{Math.round(mentorship.progress)}%</b></div> })}</div></article>
      </div>}
    </section>
  )
}
