import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock3, Compass, Package, Plus, ScrollText, Shield, Skull, Users, X } from 'lucide-react'
import type { ExpeditionDraft } from '../game/simulation'
import type { Character, GameState, Opportunity } from '../types/game'

interface Props {
  state: GameState
  onLaunch: (draft: ExpeditionDraft) => void
}

function memberScore(character: Character): number {
  return character.skills.combat + character.skills.survival + character.skills.scouting + character.skills.medicine + character.skills.arcana
}

export default function ExpeditionPlanner({ state, onLaunch }: Props) {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [leaderId, setLeaderId] = useState('')
  const [riskPolicy, setRiskPolicy] = useState<'cautious' | 'standard' | 'bold'>('standard')
  const [food, setFood] = useState(38)
  const [medicine, setMedicine] = useState(8)
  const [showPlanner, setShowPlanner] = useState(false)

  const opportunities = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day)
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId)
  const availableCharacters = state.characters.filter((character) => character.employed && character.status === 'available')
  const selectedMembers = availableCharacters.filter((character) => memberIds.includes(character.id))
  const budget = 45 + selectedMembers.length * 18 + Math.ceil(food * 0.7) + medicine * 4
  const activeCount = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning').length
  const canLaunch = Boolean(selectedOpportunity && memberIds.length >= 2 && leaderId && state.guild.treasury >= budget && state.guild.supplies >= food && state.guild.medicine >= medicine && activeCount < state.guild.maxActiveExpeditions)

  const readiness = useMemo(() => {
    if (selectedMembers.length === 0) return 0
    const skills = selectedMembers.reduce((sum, member) => sum + memberScore(member), 0) / selectedMembers.length
    const leader = selectedMembers.find((member) => member.id === leaderId)
    const morale = selectedMembers.reduce((sum, member) => sum + member.loyalty, 0) / selectedMembers.length
    return Math.max(0, Math.min(100, Math.round(skills * 3.1 + (leader?.skills.leadership ?? 0) * 4 + morale * 0.25 - (selectedOpportunity?.dangerEstimate ?? 0) * 5)))
  }, [selectedMembers, leaderId, selectedOpportunity])

  const openPlanner = (opportunity: Opportunity) => {
    setSelectedOpportunityId(opportunity.id)
    setMemberIds([])
    setLeaderId('')
    setFood(38)
    setMedicine(8)
    setShowPlanner(true)
  }

  const toggleMember = (characterId: string) => {
    setMemberIds((current) => current.includes(characterId) ? current.filter((id) => id !== characterId) : [...current, characterId].slice(0, 7))
    if (leaderId === characterId) setLeaderId('')
  }

  const launch = () => {
    if (!selectedOpportunity || !canLaunch) return
    onLaunch({ opportunity: selectedOpportunity, memberIds, leaderId, riskPolicy, food, medicine, budget })
    setShowPlanner(false)
  }

  return (
    <section className="view expeditions-view">
      <header className="view-heading">
        <div><p className="eyebrow">Экспедиционный отдел</p><h1>Контракты и походы</h1><p>Формируй отряды, распределяй припасы и наблюдай, как решения превращаются в историю.</p></div>
        <div className="capacity-badge"><Users size={18} /><span>Активно {activeCount}/{state.guild.maxActiveExpeditions}</span></div>
      </header>

      <div className="expedition-columns">
        <div className="opportunities-column">
          <div className="section-title"><ScrollText size={19} /><div><p className="eyebrow">Доска</p><h2>Доступные возможности</h2></div></div>
          {opportunities.length === 0 ? <div className="empty-state paper-card"><Clock3 /><h3>Новых контрактов нет</h3><p>Продвинь время. Слухи и заказы поступают каждые несколько недель.</p></div> : opportunities.map((opportunity) => (
            <article className="opportunity-card paper-card" key={opportunity.id}>
              <div className="opportunity-top"><span className="type-chip">{opportunity.type}</span><span className="deadline">до дня {opportunity.deadlineDay}</span></div>
              <h3>{opportunity.title}</h3>
              <p>{opportunity.description}</p>
              <div className="opportunity-source">Источник: {opportunity.source}</div>
              <div className="opportunity-stats">
                <span><Skull size={15} /> риск {opportunity.dangerEstimate}/10</span>
                <span><Package size={15} /> {opportunity.reward} кр.</span>
              </div>
              <button className="primary-button" onClick={() => openPlanner(opportunity)}><Plus size={16} />Подготовить экспедицию</button>
            </article>
          ))}
        </div>

        <div className="active-column">
          <div className="section-title"><Compass size={19} /><div><p className="eyebrow">В пути</p><h2>Активные и завершённые</h2></div></div>
          {state.expeditions.length === 0 ? <div className="empty-state paper-card"><Compass /><h3>Гильдия ещё никуда не ходила</h3><p>Выбери первый контракт. Даже провал станет частью хроники.</p></div> : [...state.expeditions].reverse().map((expedition) => {
            const leader = state.characters.find((character) => character.id === expedition.leaderId)
            const progress = expedition.route.length <= 1 ? 100 : Math.round((expedition.routeIndex / (expedition.route.length - 1)) * 100)
            return (
              <article className={`active-expedition paper-card status-${expedition.status}`} key={expedition.id}>
                <div className="active-expedition-header">
                  <div><span className="type-chip">{expedition.status}</span><h3>{expedition.name}</h3><p>Лидер: {leader?.name}</p></div>
                  <strong>{progress}%</strong>
                </div>
                <div className="progress-line expedition-progress"><span style={{ width: `${progress}%` }} /></div>
                <div className="expedition-stat-row">
                  <span><Users size={14} />{expedition.memberIds.length}</span>
                  <span><Package size={14} />{expedition.food}</span>
                  <span><Shield size={14} />{Math.round(expedition.morale)}%</span>
                  <span><Clock3 size={14} />{expedition.daysElapsed} дн.</span>
                </div>
                <div className="latest-log">
                  <b>{expedition.logs.at(-1)?.title}</b>
                  <p>{expedition.logs.at(-1)?.text}</p>
                </div>
                {expedition.discoveries.length > 0 && <div className="discoveries-line"><Check size={15} />Открытий: {expedition.discoveries.length}</div>}
              </article>
            )
          })}
        </div>
      </div>

      {showPlanner && selectedOpportunity && (
        <div className="modal-backdrop">
          <article className="planner-modal paper-card">
            <button className="icon-button close-detail" onClick={() => setShowPlanner(false)}><X size={18} /></button>
            <div className="planner-title"><p className="eyebrow">Экспедиционный мандат</p><h2>{selectedOpportunity.title}</h2><p>{selectedOpportunity.description}</p></div>
            <div className="planner-grid">
              <div className="planner-members">
                <h3>1. Состав отряда <span>{memberIds.length}/7</span></h3>
                <div className="member-picker">
                  {availableCharacters.map((character) => {
                    const selected = memberIds.includes(character.id)
                    return (
                      <button className={selected ? 'selected' : ''} key={character.id} onClick={() => toggleMember(character.id)}>
                        <span className="member-check">{selected ? <Check size={13} /> : null}</span>
                        <div><strong>{character.name}</strong><small>{character.profession} · сила {memberScore(character)}</small></div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="planner-settings">
                <h3>2. Командование</h3>
                <select value={leaderId} onChange={(event) => setLeaderId(event.target.value)}>
                  <option value="">Назначить лидера</option>
                  {selectedMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · лидерство {member.skills.leadership}</option>)}
                </select>
                <h3>3. Политика риска</h3>
                <div className="risk-options">
                  {(['cautious', 'standard', 'bold'] as const).map((risk) => <button className={riskPolicy === risk ? 'active' : ''} key={risk} onClick={() => setRiskPolicy(risk)}>{risk === 'cautious' ? 'Осторожно' : risk === 'standard' ? 'Стандартно' : 'Смело'}</button>)}
                </div>
                <h3>4. Снабжение</h3>
                <label className="range-field"><span>Провизия <b>{food}</b></span><input type="range" min="12" max="100" value={food} onChange={(event) => setFood(Number(event.target.value))} /></label>
                <label className="range-field"><span>Медицина <b>{medicine}</b></span><input type="range" min="2" max="30" value={medicine} onChange={(event) => setMedicine(Number(event.target.value))} /></label>
                <div className="readiness-box">
                  <div><span>Готовность</span><strong>{readiness}%</strong></div>
                  <div className="progress-line"><span style={{ width: `${readiness}%` }} /></div>
                  <small>Оценка основана на известных угрозах и может быть ошибочной.</small>
                </div>
                <div className="cost-summary"><span>Бюджет</span><strong>{budget} кр.</strong></div>
                {!canLaunch && <div className="warning-line"><AlertTriangle size={15} />Нужны 2+ участника, лидер, припасы и свободный лимит.</div>}
                <button className="primary-button launch-button" disabled={!canLaunch} onClick={launch}>Утвердить и отправить</button>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
