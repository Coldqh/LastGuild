import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Clock3,
  Compass,
  Crosshair,
  Filter,
  MapPinned,
  Package,
  Plus,
  Route,
  Save,
  ScrollText,
  Search,
  Shield,
  Skull,
  Sparkles,
  Swords,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { findRoute, type ExpeditionDraft } from '../game/simulation'
import type { Character, ExpeditionRiskProfile, GameState, Opportunity } from '../types/game'

interface Props {
  state: GameState
  onLaunch: (draft: ExpeditionDraft) => void
}

type PlannerStep = 1 | 2 | 3 | 4 | 5 | 6
type RiskPolicy = ExpeditionDraft['riskPolicy']

interface ExpeditionTemplate {
  id: string
  name: string
  note: string
  riskPolicy: RiskPolicy
  foodFactor: number
  medicine: number
  retreatThreshold: number
  custom?: boolean
}

const TEMPLATE_KEY = 'last-guild-expedition-templates-v1'

const builtInTemplates: ExpeditionTemplate[] = [
  { id: 'balanced', name: 'Стандартный поход', note: 'Ровный запас, стандартный темп.', riskPolicy: 'standard', foodFactor: 1, medicine: 8, retreatThreshold: 30 },
  { id: 'scouting', name: 'Быстрая разведка', note: 'Меньше груза, выше скорость.', riskPolicy: 'bold', foodFactor: .78, medicine: 5, retreatThreshold: 22 },
  { id: 'ruins', name: 'Исследование руин', note: 'Запас медицины и осторожный режим.', riskPolicy: 'cautious', foodFactor: 1.18, medicine: 14, retreatThreshold: 42 },
  { id: 'rescue', name: 'Спасательная группа', note: 'Усиленная медицина, быстрый выход.', riskPolicy: 'bold', foodFactor: .92, medicine: 20, retreatThreshold: 35 },
  { id: 'long', name: 'Дальний поход', note: 'Большой резерв провизии.', riskPolicy: 'cautious', foodFactor: 1.42, medicine: 16, retreatThreshold: 45 },
]

const riskLabels: Record<keyof ExpeditionRiskProfile, string> = {
  route: 'Маршрут', combat: 'Бой', climate: 'Климат', disease: 'Болезни', politics: 'Политика', magic: 'Магия',
}

const riskAdvice: Record<keyof ExpeditionRiskProfile, string> = {
  route: 'Добавь следопыта, выбери осторожный темп или возьми больше провизии.',
  combat: 'Добавь воина, охотника или мага и подними порог отступления.',
  climate: 'Усиль снабжение и возьми специалиста по выживанию.',
  disease: 'Нужен лекарь и дополнительная медицина.',
  politics: 'Дипломат или высокая репутация снизят риск конфликта.',
  magic: 'Нужен магический специалист и осторожный режим.',
}

function memberScore(character: Character, opportunity?: Opportunity): number {
  const roleBonus = opportunity?.requiredRoles.includes(character.profession) ? 28 : 0
  return character.skills.combat + character.skills.survival + character.skills.scouting + character.skills.medicine + character.skills.arcana
    + roleBonus + character.health * .12 + character.loyalty * .06
}

function riskClass(value: number): string {
  if (value >= 8) return 'critical'
  if (value >= 6) return 'high'
  if (value >= 4) return 'medium'
  return 'low'
}

function loadCustomTemplates(): ExpeditionTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function ExpeditionPlanner({ state, onLaunch }: Props) {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [leaderId, setLeaderId] = useState('')
  const [riskPolicy, setRiskPolicy] = useState<RiskPolicy>('standard')
  const [food, setFood] = useState(38)
  const [medicine, setMedicine] = useState(8)
  const [retreatThreshold, setRetreatThreshold] = useState(30)
  const [step, setStep] = useState<PlannerStep>(1)
  const [templateId, setTemplateId] = useState('balanced')
  const [customTemplates, setCustomTemplates] = useState<ExpeditionTemplate[]>(loadCustomTemplates)
  const [templateName, setTemplateName] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [memberQuery, setMemberQuery] = useState('')

  const allTemplates = [...builtInTemplates, ...customTemplates]
  const selectedTemplate = allTemplates.find((entry) => entry.id === templateId) ?? builtInTemplates[0]
  const opportunities = state.opportunities.filter((opportunity) => !opportunity.accepted && opportunity.deadlineDay >= state.day)
  const types = [...new Set(opportunities.map((entry) => entry.type))]
  const filteredOpportunities = opportunities.filter((entry) => {
    const matchesType = typeFilter === 'all' || entry.type === typeFilter
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || `${entry.title} ${entry.description} ${entry.source}`.toLowerCase().includes(needle)
    return matchesType && matchesQuery
  })
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId)
  const availableCharacters = state.characters.filter((character) => character.employed && character.status === 'available' && !character.assignedBranchId)
  const selectedMembers = availableCharacters.filter((character) => memberIds.includes(character.id))
  const home = state.world.settlements.find((settlement) => settlement.id === state.world.startSettlementId)
  const route = useMemo(() => selectedOpportunity && home ? findRoute(state, home.tileId, selectedOpportunity.targetTileId) : [], [selectedOpportunity, home, state])
  const policyMultiplier = riskPolicy === 'cautious' ? 1.25 : riskPolicy === 'bold' ? .82 : 1
  const expectedDays = Math.max(4, Math.ceil(route.length * 1.5 * policyMultiplier + 3))
  const recommendedFood = Math.ceil(expectedDays * Math.max(2, memberIds.length) * .78)
  const budget = 45 + selectedMembers.length * 18 + Math.ceil(food * .7) + medicine * 4
  const activeCount = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning').length
  const canLaunch = Boolean(selectedOpportunity && memberIds.length >= 2 && leaderId && route.length > 0 && state.guild.treasury >= budget && state.guild.supplies >= food && state.guild.medicine >= medicine && activeCount < state.guild.maxActiveExpeditions)

  const roleCoverage = useMemo(() => {
    if (!selectedOpportunity) return []
    return selectedOpportunity.requiredRoles.map((role) => ({ role, covered: selectedMembers.some((member) => member.profession === role) }))
  }, [selectedOpportunity, selectedMembers])

  const teamConflicts = useMemo(() => {
    let conflicts = 0
    for (const member of selectedMembers) {
      for (const other of selectedMembers) {
        if (member.id < other.id && (member.relationships[other.id] ?? 0) <= -20) conflicts += 1
      }
    }
    return conflicts
  }, [selectedMembers])

  const readiness = useMemo(() => {
    if (selectedMembers.length === 0) return 0
    const skills = selectedMembers.reduce((sum, member) => sum + memberScore(member, selectedOpportunity), 0) / selectedMembers.length
    const leader = selectedMembers.find((member) => member.id === leaderId)
    const morale = selectedMembers.reduce((sum, member) => sum + member.loyalty, 0) / selectedMembers.length
    const roleBonus = roleCoverage.filter((role) => role.covered).length * 6
    const supplyPenalty = Math.max(0, recommendedFood - food) * .35
    const conflictPenalty = teamConflicts * 7
    return Math.max(0, Math.min(100, Math.round(skills * 2.25 + (leader?.skills.leadership ?? 0) * 4 + morale * .18 + roleBonus - (selectedOpportunity?.dangerEstimate ?? 0) * 5 - supplyPenalty - conflictPenalty)))
  }, [selectedMembers, leaderId, selectedOpportunity, roleCoverage, recommendedFood, food, teamConflicts])

  const unknownTiles = route.filter((id) => (state.world.tiles.find((tile) => tile.id === id)?.knowledge ?? 0) < 2).length
  const routeBiomes = [...new Set(route.map((id) => state.world.tiles.find((tile) => tile.id === id)?.biome).filter(Boolean))]
  const sortedRisks = selectedOpportunity ? (Object.entries(selectedOpportunity.riskProfile) as Array<[keyof ExpeditionRiskProfile, number]>).sort((a, b) => b[1] - a[1]) : []
  const mainThreat = sortedRisks[0]
  const missingRoles = roleCoverage.filter((entry) => !entry.covered).map((entry) => entry.role)
  const weakPoint = missingRoles.length
    ? `Не закрыты роли: ${missingRoles.join(', ')}`
    : selectedMembers.some((entry) => entry.health < 60)
      ? 'В составе есть люди с низким здоровьем.'
      : teamConflicts > 0
        ? `В отряде ${teamConflicts} острых конфликтов.`
        : food < recommendedFood
          ? 'Провизии меньше расчётной нормы.'
          : 'Явных слабых мест не найдено.'

  useEffect(() => {
    if (!selectedOpportunity) return
    const base = Math.max(16, Math.round(expectedDays * Math.max(2, memberIds.length) * .78 * selectedTemplate.foodFactor))
    setFood(Math.min(160, base))
    setMedicine(selectedTemplate.medicine)
    setRiskPolicy(selectedTemplate.riskPolicy)
    setRetreatThreshold(selectedTemplate.retreatThreshold)
  }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyTemplate = (template: ExpeditionTemplate) => {
    setTemplateId(template.id)
    setRiskPolicy(template.riskPolicy)
    setRetreatThreshold(template.retreatThreshold)
    setMedicine(template.medicine)
    const baseDays = selectedOpportunity ? expectedDays : 12
    setFood(Math.max(16, Math.min(160, Math.round(baseDays * Math.max(2, memberIds.length || 4) * .78 * template.foodFactor))))
  }

  const openPlanner = (opportunity: Opportunity) => {
    setSelectedOpportunityId(opportunity.id)
    setMemberIds([])
    setLeaderId('')
    setStep(1)
    setMemberQuery('')
    applyTemplate(selectedTemplate)
  }

  const closePlanner = () => {
    setSelectedOpportunityId(null)
    setStep(1)
  }

  const toggleMember = (characterId: string) => {
    setMemberIds((current) => current.includes(characterId) ? current.filter((id) => id !== characterId) : [...current, characterId].slice(0, 7))
    if (leaderId === characterId) setLeaderId('')
  }

  const recommendTeam = () => {
    if (!selectedOpportunity) return
    const picked: Character[] = []
    for (const role of selectedOpportunity.requiredRoles) {
      const candidate = availableCharacters.filter((entry) => entry.profession === role && !picked.some((member) => member.id === entry.id)).sort((a, b) => memberScore(b, selectedOpportunity) - memberScore(a, selectedOpportunity))[0]
      if (candidate) picked.push(candidate)
    }
    const fillers = availableCharacters.filter((entry) => !picked.some((member) => member.id === entry.id)).sort((a, b) => memberScore(b, selectedOpportunity) - memberScore(a, selectedOpportunity))
    for (const candidate of fillers) {
      if (picked.length >= Math.min(5, Math.max(4, selectedOpportunity.requiredRoles.length + 1))) break
      picked.push(candidate)
    }
    setMemberIds(picked.map((entry) => entry.id))
    const leader = [...picked].sort((a, b) => b.skills.leadership - a.skills.leadership)[0]
    setLeaderId(leader?.id ?? '')
  }

  const saveTemplate = () => {
    const name = templateName.trim()
    if (!name) return
    const template: ExpeditionTemplate = {
      id: `custom-${Date.now()}`,
      name,
      note: 'Пользовательский профиль подготовки.',
      riskPolicy,
      foodFactor: Math.max(.5, Math.min(2, food / Math.max(1, recommendedFood))),
      medicine,
      retreatThreshold,
      custom: true,
    }
    const next = [...customTemplates, template].slice(-8)
    setCustomTemplates(next)
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next))
    setTemplateId(template.id)
    setTemplateName('')
  }

  const deleteTemplate = (id: string) => {
    const next = customTemplates.filter((entry) => entry.id !== id)
    setCustomTemplates(next)
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next))
    if (templateId === id) setTemplateId('balanced')
  }

  const changePolicy = (risk: RiskPolicy) => {
    setRiskPolicy(risk)
    setRetreatThreshold(risk === 'cautious' ? 45 : risk === 'bold' ? 18 : 30)
  }

  const launch = () => {
    if (!selectedOpportunity || !canLaunch) return
    onLaunch({ opportunity: selectedOpportunity, memberIds, leaderId, riskPolicy, food, medicine, budget, retreatThreshold })
    closePlanner()
  }

  const stepReady = (current: PlannerStep): boolean => {
    if (current === 1) return Boolean(selectedOpportunity)
    if (current === 2) return memberIds.length >= 2
    if (current === 3) return route.length > 0
    if (current === 4) return food >= 12 && medicine >= 2
    if (current === 5) return Boolean(leaderId)
    return canLaunch
  }

  if (selectedOpportunity) {
    const stepLabels = ['Цель', 'Команда', 'Маршрут', 'Снабжение', 'Приказы', 'Проверка']
    return (
      <section className="view expedition-wizard-view">
        <header className="wizard-header">
          <button className="text-button" onClick={closePlanner}><ArrowLeft size={15} />К контрактам</button>
          <div><p className="eyebrow">Экспедиционный мандат</p><h1>{selectedOpportunity.title}</h1><p>{selectedOpportunity.description}</p></div>
          <span className="wizard-capacity">Активно {activeCount}/{state.guild.maxActiveExpeditions}</span>
        </header>

        <nav className="wizard-steps" aria-label="Этапы подготовки">
          {stepLabels.map((label, index) => {
            const value = (index + 1) as PlannerStep
            return <button key={label} className={`${step === value ? 'active' : ''} ${value < step ? 'done' : ''}`} onClick={() => value <= step || stepReady(step) ? setStep(value) : undefined}><b>{value < step ? <Check size={13} /> : value}</b><span>{label}</span></button>
          })}
        </nav>

        <div className="wizard-shell paper-card">
          {step === 1 && (
            <section className="wizard-step objective-step">
              <div className="wizard-section-heading"><Crosshair /><div><p className="eyebrow">Шаг 1</p><h2>Цель и условия</h2></div></div>
              <div className="objective-brief-grid">
                <article><span>Заказчик</span><strong>{selectedOpportunity.source}</strong></article>
                <article><span>Награда</span><strong>{selectedOpportunity.reward} кр.</strong></article>
                <article><span>Срок</span><strong>до дня {selectedOpportunity.deadlineDay}</strong></article>
                <article><span>Оценка угрозы</span><strong>{selectedOpportunity.dangerEstimate}/10</strong></article>
              </div>
              <div className="objective-text-block"><ScrollText size={18} /><p>{selectedOpportunity.description}</p></div>
              <div className="wizard-insight-grid">
                <div><span>Нужные специалисты</span><strong>{selectedOpportunity.requiredRoles.join(', ')}</strong></div>
                <div><span>Главная известная угроза</span><strong>{mainThreat ? `${riskLabels[mainThreat[0]]}: ${mainThreat[1]}/10` : 'нет данных'}</strong></div>
              </div>
              {(selectedOpportunity.contestedByIds?.length ?? 0) > 0 && <div className="contested-line"><Swords size={15} /><span>За эту цель уже борются другие организации.</span></div>}
            </section>
          )}

          {step === 2 && (
            <section className="wizard-step team-step">
              <div className="wizard-section-heading"><Users /><div><p className="eyebrow">Шаг 2</p><h2>Собрать команду</h2></div><button className="secondary-button" onClick={recommendTeam}><Sparkles size={15} />Рекомендовать состав</button></div>
              <div className="team-analysis-strip">
                <span className={missingRoles.length ? 'warning' : 'good'}>{missingRoles.length ? `Не хватает: ${missingRoles.join(', ')}` : 'Все обязательные роли закрыты'}</span>
                <span className={teamConflicts ? 'warning' : 'good'}>{teamConflicts ? `Конфликтов: ${teamConflicts}` : 'Острых конфликтов нет'}</span>
                <span>{memberIds.length}/7 участников</span>
              </div>
              <label className="wizard-search"><Search size={15} /><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Имя или профессия" /></label>
              <div className="wizard-member-grid">
                {[...availableCharacters]
                  .filter((character) => `${character.name} ${character.profession}`.toLowerCase().includes(memberQuery.toLowerCase()))
                  .sort((a, b) => memberScore(b, selectedOpportunity) - memberScore(a, selectedOpportunity))
                  .map((character) => {
                    const selected = memberIds.includes(character.id)
                    const flags = [character.health < 60 ? 'ослаблен' : '', character.loyalty < 40 ? 'низкая лояльность' : '', selectedOpportunity.requiredRoles.includes(character.profession) ? 'нужная роль' : ''].filter(Boolean)
                    return (
                      <button className={selected ? 'selected' : ''} key={character.id} onClick={() => toggleMember(character.id)}>
                        <span className="member-check">{selected ? <Check size={13} /> : character.name.slice(0, 1)}</span>
                        <div><strong>{character.name}</strong><small>{character.profession} · здоровье {Math.round(character.health)} · навык {Math.round(memberScore(character, selectedOpportunity))}</small><span>{flags.join(' · ') || `страх: ${character.fear}`}</span></div>
                      </button>
                    )
                  })}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="wizard-step route-step">
              <div className="wizard-section-heading"><Route /><div><p className="eyebrow">Шаг 3</p><h2>Маршрут и неизвестность</h2></div></div>
              <div className="route-hero">
                <div><MapPinned /><span><strong>{route.length} гексов</strong><small>около {expectedDays} дней</small></span></div>
                <div><Compass /><span><strong>{routeBiomes.length} типов местности</strong><small>{routeBiomes.slice(0, 4).join(', ')}</small></span></div>
                <div className={unknownTiles ? 'warning' : ''}><AlertTriangle /><span><strong>{unknownTiles} неизвестных гексов</strong><small>{unknownTiles ? 'оценка пути неточна' : 'маршрут изучен'}</small></span></div>
              </div>
              <div className="route-preview-line">{route.slice(0, 36).map((id, index) => <i key={`${id}-${index}`} className={(state.world.tiles.find((tile) => tile.id === id)?.knowledge ?? 0) < 2 ? 'unknown' : ''} />)}</div>
              <div className="risk-readable-card">
                <div><span>Главная угроза</span><strong>{mainThreat ? `${riskLabels[mainThreat[0]]} · ${mainThreat[1]}/10` : 'нет данных'}</strong></div>
                <p>{mainThreat ? riskAdvice[mainThreat[0]] : 'Маршрут выглядит безопасным.'}</p>
                <details><summary>Все категории риска</summary><div className="risk-grid compact">{sortedRisks.map(([key, value]) => <div className={`risk-cell ${riskClass(value)}`} key={key}><span>{riskLabels[key]}</span><strong>{value}/10</strong></div>)}</div></details>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="wizard-step supply-step">
              <div className="wizard-section-heading"><Package /><div><p className="eyebrow">Шаг 4</p><h2>Снабжение</h2></div></div>
              <div className="template-selector">
                {allTemplates.map((template) => <button key={template.id} className={templateId === template.id ? 'active' : ''} onClick={() => applyTemplate(template)}><strong>{template.name}</strong><span>{template.note}</span>{template.custom && <em onClick={(event) => { event.stopPropagation(); deleteTemplate(template.id) }}>удалить</em>}</button>)}
              </div>
              <div className="supply-controls-grid">
                <label><span>Провизия <b>{food}</b><small>рекомендация: {recommendedFood}</small></span><input type="range" min="12" max="160" value={food} onChange={(event) => setFood(Number(event.target.value))} /></label>
                <label><span>Медицина <b>{medicine}</b><small>на складе: {state.guild.medicine}</small></span><input type="range" min="2" max="35" value={medicine} onChange={(event) => setMedicine(Number(event.target.value))} /></label>
              </div>
              <div className="supply-summary-grid">
                <div><span>Стоимость</span><strong>{budget} кр.</strong><small>в казне {state.guild.treasury}</small></div>
                <div><span>Запас провизии</span><strong className={food < recommendedFood ? 'danger-text' : ''}>{food < recommendedFood ? 'Недостаточный' : 'Достаточный'}</strong><small>{food - recommendedFood >= 0 ? `резерв +${food - recommendedFood}` : `дефицит ${recommendedFood - food}`}</small></div>
                <div><span>Груз</span><strong>{Math.round((food + medicine * 2) / Math.max(1, memberIds.length))}</strong><small>условных единиц на человека</small></div>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="wizard-step orders-step">
              <div className="wizard-section-heading"><Shield /><div><p className="eyebrow">Шаг 5</p><h2>Командование и приказы</h2></div></div>
              <div className="orders-grid">
                <label><span>Лидер отряда</span><select value={leaderId} onChange={(event) => setLeaderId(event.target.value)}><option value="">Назначить лидера</option>{selectedMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · лидерство {member.skills.leadership}</option>)}</select></label>
                <div><span>Политика риска</span><div className="risk-options">{(['cautious', 'standard', 'bold'] as const).map((risk) => <button className={riskPolicy === risk ? 'active' : ''} key={risk} onClick={() => changePolicy(risk)}>{risk === 'cautious' ? 'Осторожно' : risk === 'standard' ? 'Стандартно' : 'Смело'}</button>)}</div></div>
                <label className="range-field"><span>Отступать при морали <b>{retreatThreshold}%</b></span><input type="range" min="10" max="60" value={retreatThreshold} onChange={(event) => setRetreatThreshold(Number(event.target.value))} /></label>
              </div>
              <div className="orders-explanation"><UserRoundCheck size={18} /><p>Лидер самостоятельно решает мелкие ситуации. Штаб вмешивается только при критическом событии, открытии, бое или изменении цели.</p></div>
            </section>
          )}

          {step === 6 && (
            <section className="wizard-step review-step">
              <div className="wizard-section-heading"><ClipboardCheck /><div><p className="eyebrow">Шаг 6</p><h2>Итоговая проверка</h2></div></div>
              <div className="review-hero">
                <div><span>Готовность</span><strong>{readiness}%</strong><div className="progress-line"><i style={{ width: `${readiness}%` }} /></div></div>
                <div><span>Главная угроза</span><strong>{mainThreat ? riskLabels[mainThreat[0]] : 'нет данных'}</strong><small>{mainThreat?.[1] ?? 0}/10</small></div>
                <div><span>Слабое место</span><strong>{weakPoint}</strong></div>
              </div>
              <div className="review-summary-grid">
                <article><Users /><span><strong>{memberIds.length} человек</strong><small>{selectedMembers.find((entry) => entry.id === leaderId)?.name ?? 'лидер не назначен'}</small></span></article>
                <article><Route /><span><strong>{route.length} гексов</strong><small>около {expectedDays} дней</small></span></article>
                <article><Package /><span><strong>{food} еды · {medicine} медицины</strong><small>{budget} крон</small></span></article>
                <article><Shield /><span><strong>{riskPolicy === 'cautious' ? 'Осторожный' : riskPolicy === 'bold' ? 'Смелый' : 'Стандартный'} приказ</strong><small>отступление при {retreatThreshold}%</small></span></article>
              </div>
              <div className="template-save-row"><Save size={16} /><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Название собственного шаблона" /><button className="secondary-button" disabled={!templateName.trim()} onClick={saveTemplate}>Сохранить шаблон</button></div>
              {!canLaunch && <div className="warning-line"><AlertTriangle size={15} />Проверь состав, лидера, маршрут, казну и складские запасы.</div>}
              <button className="primary-button launch-expedition-final" disabled={!canLaunch} onClick={launch}><Compass size={17} />Утвердить мандат и отправить отряд</button>
            </section>
          )}
        </div>

        <footer className="wizard-footer">
          <button className="secondary-button" disabled={step === 1} onClick={() => setStep((step - 1) as PlannerStep)}><ArrowLeft size={15} />Назад</button>
          <span>Шаг {step} из 6</span>
          {step < 6 && <button className="primary-button" disabled={!stepReady(step)} onClick={() => setStep((step + 1) as PlannerStep)}>Дальше<ArrowRight size={15} /></button>}
        </footer>
      </section>
    )
  }

  return (
    <section className="view contracts-view">
      <header className="view-heading compact-heading">
        <div><p className="eyebrow">Экспедиционный отдел</p><h1>Контракты</h1></div>
        <div className="capacity-badge"><Users size={18} /><span>Свободно {Math.max(0, state.guild.maxActiveExpeditions - activeCount)} слотов</span></div>
      </header>

      <div className="contract-toolbar paper-card">
        <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск контрактов" /></label>
        <label><Filter size={15} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Все типы</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <span>{filteredOpportunities.length} доступно</span>
      </div>

      {filteredOpportunities.length === 0 ? (
        <div className="empty-state paper-card"><Clock3 /><h3>Подходящих контрактов нет</h3><p>Измени фильтр или продвинь время.</p></div>
      ) : (
        <div className="contract-list">
          {filteredOpportunities.map((opportunity) => {
            const mainRisk = (Object.entries(opportunity.riskProfile) as Array<[keyof ExpeditionRiskProfile, number]>).sort((a, b) => b[1] - a[1])[0]
            return (
              <article className="contract-row compact-contract-row paper-card" key={opportunity.id}>
                <div className="contract-row-main">
                  <div className="opportunity-top"><span className="type-chip">{opportunity.type}</span>{opportunity.storyChainId && <span className="story-contract-chip">цепочка</span>}<span className="deadline">до {opportunity.deadlineDay} дня</span></div>
                  <h2>{opportunity.title}</h2>
                  <details className="contract-description"><summary>Описание</summary><p>{opportunity.description}</p><small>Источник: {opportunity.source}</small></details>
                </div>
                <div className="contract-inline-meta">
                  <span><Skull size={13} />риск <b>{opportunity.dangerEstimate}/10</b></span>
                  <span><AlertTriangle size={13} />{riskLabels[mainRisk[0]]} <b>{mainRisk[1]}/10</b></span>
                  <span><Package size={13} /><b>{opportunity.reward}</b> кр.</span>
                  <span className="contract-role-line">нужны: {opportunity.requiredRoles.join(', ') || 'любые'}</span>
                  {(opportunity.contestedByIds?.length ?? 0) > 0 && <em><Swords size={12} />конкуренты</em>}
                </div>
                <button className="primary-button compact-contract-action" onClick={() => openPlanner(opportunity)}><Plus size={14} />Подготовить</button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
