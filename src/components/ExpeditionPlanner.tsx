import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock3, Compass, MapPinned, Package, Plus, ScrollText, Shield, Skull, Swords, Users, X } from 'lucide-react'
import { findRoute, type ExpeditionDraft } from '../game/simulation'
import type { Character, ExpeditionRiskProfile, GameState, Opportunity } from '../types/game'

interface Props {
  state: GameState
  onLaunch: (draft: ExpeditionDraft) => void
}

function memberScore(character: Character): number {
  return character.skills.combat + character.skills.survival + character.skills.scouting + character.skills.medicine + character.skills.arcana
}

const riskLabels: Record<keyof ExpeditionRiskProfile, string> = {
  route: 'Маршрут', combat: 'Бой', climate: 'Климат', disease: 'Болезни', politics: 'Политика', magic: 'Магия',
}

function riskClass(value: number): string {
  if (value >= 8) return 'critical'
  if (value >= 6) return 'high'
  if (value >= 4) return 'medium'
  return 'low'
}

export default function ExpeditionPlanner({ state, onLaunch }: Props) {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [leaderId, setLeaderId] = useState('')
  const [riskPolicy, setRiskPolicy] = useState<'cautious' | 'standard' | 'bold'>('standard')
  const [food, setFood] = useState(38)
  const [medicine, setMedicine] = useState(8)
  const [retreatThreshold, setRetreatThreshold] = useState(30)
  const [showPlanner, setShowPlanner] = useState(false)

  const opportunities = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day)
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId)
  const availableCharacters = state.characters.filter((character) => character.employed && character.status === 'available' && !character.assignedBranchId)
  const selectedMembers = availableCharacters.filter((character) => memberIds.includes(character.id))
  const home = state.world.settlements.find((settlement) => settlement.id === state.world.startSettlementId)
  const route = useMemo(() => selectedOpportunity && home ? findRoute(state, home.tileId, selectedOpportunity.targetTileId) : [], [selectedOpportunity, home, state])
  const policyMultiplier = riskPolicy === 'cautious' ? 1.25 : riskPolicy === 'bold' ? 0.82 : 1
  const expectedDays = Math.max(4, Math.ceil(route.length * 1.5 * policyMultiplier + 3))
  const recommendedFood = Math.ceil(expectedDays * Math.max(2, memberIds.length) * 0.78)
  const budget = 45 + selectedMembers.length * 18 + Math.ceil(food * 0.7) + medicine * 4
  const activeCount = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning').length
  const canLaunch = Boolean(selectedOpportunity && memberIds.length >= 2 && leaderId && route.length > 0 && state.guild.treasury >= budget && state.guild.supplies >= food && state.guild.medicine >= medicine && activeCount < state.guild.maxActiveExpeditions)

  const roleCoverage = useMemo(() => {
    if (!selectedOpportunity) return []
    return selectedOpportunity.requiredRoles.map((role) => ({ role, covered: selectedMembers.some((member) => member.profession === role) }))
  }, [selectedOpportunity, selectedMembers])

  const readiness = useMemo(() => {
    if (selectedMembers.length === 0) return 0
    const skills = selectedMembers.reduce((sum, member) => sum + memberScore(member), 0) / selectedMembers.length
    const leader = selectedMembers.find((member) => member.id === leaderId)
    const morale = selectedMembers.reduce((sum, member) => sum + member.loyalty, 0) / selectedMembers.length
    const roleBonus = roleCoverage.filter((role) => role.covered).length * 6
    const supplyPenalty = Math.max(0, recommendedFood - food) * 0.35
    return Math.max(0, Math.min(100, Math.round(skills * 3 + (leader?.skills.leadership ?? 0) * 4 + morale * 0.24 + roleBonus - (selectedOpportunity?.dangerEstimate ?? 0) * 5 - supplyPenalty)))
  }, [selectedMembers, leaderId, selectedOpportunity, roleCoverage, recommendedFood, food])

  const openPlanner = (opportunity: Opportunity) => {
    setSelectedOpportunityId(opportunity.id)
    setMemberIds([])
    setLeaderId('')
    setRiskPolicy('standard')
    setFood(38)
    setMedicine(8)
    setRetreatThreshold(30)
    setShowPlanner(true)
  }

  const toggleMember = (characterId: string) => {
    setMemberIds((current) => current.includes(characterId) ? current.filter((id) => id !== characterId) : [...current, characterId].slice(0, 7))
    if (leaderId === characterId) setLeaderId('')
  }

  const changePolicy = (risk: 'cautious' | 'standard' | 'bold') => {
    setRiskPolicy(risk)
    setRetreatThreshold(risk === 'cautious' ? 45 : risk === 'bold' ? 18 : 30)
  }

  const launch = () => {
    if (!selectedOpportunity || !canLaunch) return
    onLaunch({ opportunity: selectedOpportunity, memberIds, leaderId, riskPolicy, food, medicine, budget, retreatThreshold })
    setShowPlanner(false)
  }

  return (
    <section className="view expeditions-view">
      <header className="view-heading">
        <div><p className="eyebrow">Экспедиционный отдел</p><h1>Контракты и походы</h1><p>Формируй отряды, оценивай шесть типов риска и принимай решения во время пути.</p></div>
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
              <div className="required-role-line">Нужны: {opportunity.requiredRoles.join(', ')}</div>
              {(opportunity.contestedByIds?.length ?? 0) > 0 && <div className="contested-line"><Swords size={15} /><span>За цель уже борются: {opportunity.contestedByIds!.map((id) => state.rivalGuilds.find((guild) => guild.id === id)?.name).filter(Boolean).join(', ')}</span></div>}
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
                  <span><Skull size={14} />{expedition.battles} боёв</span>
                </div>
                <div className="latest-log"><b>{expedition.logs.at(-1)?.title}</b><p>{expedition.logs.at(-1)?.text}</p></div>
                {expedition.discoveries.length > 0 && <div className="discoveries-line"><Check size={15} />Открытий: {expedition.discoveries.length} · подземелий: {expedition.dungeonSiteIds.length}</div>}
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
                <div className="role-coverage">
                  {roleCoverage.map((entry) => <span className={entry.covered ? 'covered' : ''} key={entry.role}>{entry.covered ? <Check size={12} /> : <AlertTriangle size={12} />}{entry.role}</span>)}
                </div>
                <div className="member-picker">
                  {[...availableCharacters].sort((a, b) => memberScore(b) - memberScore(a)).map((character) => {
                    const selected = memberIds.includes(character.id)
                    return (
                      <button className={selected ? 'selected' : ''} key={character.id} onClick={() => toggleMember(character.id)}>
                        <span className="member-check">{selected ? <Check size={13} /> : null}</span>
                        <div><strong>{character.name}</strong><small>{character.profession} · сила {memberScore(character)} · здоровье {Math.round(character.health)}</small></div>
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
                  {(['cautious', 'standard', 'bold'] as const).map((risk) => <button className={riskPolicy === risk ? 'active' : ''} key={risk} onClick={() => changePolicy(risk)}>{risk === 'cautious' ? 'Осторожно' : risk === 'standard' ? 'Стандартно' : 'Смело'}</button>)}
                </div>
                <label className="range-field"><span>Отступать при морали <b>{retreatThreshold}%</b></span><input type="range" min="10" max="60" value={retreatThreshold} onChange={(event) => setRetreatThreshold(Number(event.target.value))} /></label>
                <h3>4. Маршрут и риски</h3>
                <div className="route-summary"><MapPinned size={17} /><span>{route.length} гексов · около {expectedDays} дней</span></div>
                <div className="risk-grid">
                  {Object.entries(selectedOpportunity.riskProfile).map(([key, value]) => <div className={`risk-cell ${riskClass(value)}`} key={key}><span>{riskLabels[key as keyof ExpeditionRiskProfile]}</span><strong>{value}/10</strong></div>)}
                </div>
                <h3>5. Снабжение</h3>
                <label className="range-field"><span>Провизия <b>{food}</b> <em>совет: {recommendedFood}</em></span><input type="range" min="12" max="140" value={food} onChange={(event) => setFood(Number(event.target.value))} /></label>
                <label className="range-field"><span>Медицина <b>{medicine}</b></span><input type="range" min="2" max="35" value={medicine} onChange={(event) => setMedicine(Number(event.target.value))} /></label>
                <div className="readiness-box"><div><span>Готовность</span><strong>{readiness}%</strong></div><div className="progress-line"><span style={{ width: `${readiness}%` }} /></div><small>Оценка основана на известных угрозах. Настоящий риск может отличаться.</small></div>
                <div className="cost-summary"><span>Стоимость подготовки</span><strong>{budget} кр.</strong></div>
                {food < recommendedFood && <div className="warning-line"><AlertTriangle size={15} />Провизии меньше расчётной нормы.</div>}
                {!canLaunch && <div className="warning-line"><AlertTriangle size={15} />Нужно минимум 2 участника, лидер, маршрут и достаточно ресурсов.</div>}
                <button className="primary-button launch-button" disabled={!canLaunch} onClick={launch}><Compass size={16} />Утвердить и отправить</button>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
