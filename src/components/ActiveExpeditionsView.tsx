import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Compass,
  Crosshair,
  HeartPulse,
  MapPinned,
  Package,
  Radio,
  Shield,
  Skull,
  Users,
} from 'lucide-react'
import type { Expedition, ExpeditionLogEntry, GameState } from '../types/game'

interface Props {
  state: GameState
  onOpenContracts: () => void
}

const statusLabels: Record<Expedition['status'], string> = {
  planned: 'Подготовка',
  active: 'В пути',
  returning: 'Возвращается',
  completed: 'Завершена',
  missing: 'Пропала',
  failed: 'Провалена',
}

const importantLogTypes = new Set<ExpeditionLogEntry['type']>(['combat', 'discovery', 'injury', 'death'])

function expeditionProgress(expedition: Expedition): number {
  if (expedition.status === 'completed' || expedition.status === 'failed') return 100
  if (expedition.route.length <= 1) return Math.round(expedition.progress)
  return Math.max(0, Math.min(100, Math.round((expedition.routeIndex / (expedition.route.length - 1)) * 100)))
}

function routePoints(expedition: Expedition): Array<{ id: string; routeIndex: number }> {
  if (expedition.route.length <= 28) return expedition.route.map((id, routeIndex) => ({ id, routeIndex }))
  const step = Math.ceil(expedition.route.length / 27)
  const points = expedition.route
    .map((id, routeIndex) => ({ id, routeIndex }))
    .filter((_, index) => index % step === 0)
  const last = { id: expedition.route.at(-1)!, routeIndex: expedition.route.length - 1 }
  if (points.at(-1)?.id !== last.id) points.push(last)
  return points
}

export default function ActiveExpeditionsView({ state, onOpenContracts }: Props) {
  const live = useMemo(
    () => state.expeditions.filter((entry) => ['active', 'returning', 'missing'].includes(entry.status)).reverse(),
    [state.expeditions],
  )
  const recent = useMemo(
    () => state.expeditions.filter((entry) => ['completed', 'failed'].includes(entry.status)).slice(-12).reverse(),
    [state.expeditions],
  )
  const [selectedId, setSelectedId] = useState<string | undefined>(() => live[0]?.id ?? recent[0]?.id)

  useEffect(() => {
    if (!state.expeditions.some((entry) => entry.id === selectedId)) setSelectedId(live[0]?.id ?? recent[0]?.id)
  }, [live, recent, selectedId, state.expeditions])

  const selected = state.expeditions.find((entry) => entry.id === selectedId) ?? live[0] ?? recent[0]
  const leader = selected ? state.characters.find((entry) => entry.id === selected.leaderId) : undefined
  const members = selected ? selected.memberIds.map((id) => state.characters.find((entry) => entry.id === id)).filter(Boolean) : []
  const currentTileId = selected?.route[Math.min(selected.routeIndex, Math.max(0, selected.route.length - 1))]
  const currentTile = state.world.tiles.find((tile) => tile.id === currentTileId)
  const targetSite = selected ? state.world.sites.find((site) => site.tileId === selected.targetTileId) : undefined
  const targetSettlement = selected ? state.world.settlements.find((settlement) => settlement.tileId === selected.targetTileId) : undefined
  const targetName = targetSite?.name ?? targetSettlement?.name ?? 'неизвестная цель'
  const progress = selected ? expeditionProgress(selected) : 0

  const logGroups = useMemo(() => {
    if (!selected) return []
    const grouped = new Map<number, ExpeditionLogEntry[]>()
    for (const log of selected.logs) grouped.set(log.day, [...(grouped.get(log.day) ?? []), log])
    return [...grouped.entries()].sort((a, b) => b[0] - a[0]).map(([day, logs]) => ({
      day,
      logs,
      important: logs.some((log) => importantLogTypes.has(log.type)),
    }))
  }, [selected])

  return (
    <section className="view active-expeditions-view">
      <header className="view-heading active-expedition-page-heading">
        <div>
          <p className="eyebrow">Полевое командование</p>
          <h1>Активные походы</h1>
          <p>Последнее известное положение, состояние людей, связь со штабом и журнал операций.</p>
        </div>
        <button className="primary-button" onClick={onOpenContracts}><Compass size={16} />Новая экспедиция</button>
      </header>

      {!selected ? (
        <div className="empty-state paper-card active-empty-state">
          <Radio />
          <h3>Ни одного отряда в пути</h3>
          <p>Выбери контракт, собери команду и утверди мандат.</p>
          <button className="primary-button" onClick={onOpenContracts}>Открыть контракты</button>
        </div>
      ) : (
        <div className="field-command-layout">
          <aside className="field-expedition-list">
            <div className="field-list-heading"><Activity size={17} /><span>В поле</span><b>{live.length}</b></div>
            {live.length === 0 && <p className="field-list-empty">Активных походов нет.</p>}
            {live.map((expedition) => {
              const expeditionLeader = state.characters.find((entry) => entry.id === expedition.leaderId)
              return (
                <button key={expedition.id} className={selected.id === expedition.id ? 'selected' : ''} onClick={() => setSelectedId(expedition.id)}>
                  <span className={`field-status-dot status-${expedition.status}`} />
                  <div><strong>{expedition.name.replace('Экспедиция «', '').replace('»', '')}</strong><small>{expeditionLeader?.name ?? 'лидер неизвестен'} · {statusLabels[expedition.status]}</small></div>
                  <b>{expeditionProgress(expedition)}%</b>
                </button>
              )
            })}
            {recent.length > 0 && <div className="field-list-heading recent"><CheckCircle2 size={16} /><span>Недавние</span></div>}
            {recent.map((expedition) => (
              <button key={expedition.id} className={selected.id === expedition.id ? 'selected' : ''} onClick={() => setSelectedId(expedition.id)}>
                <span className={`field-status-dot status-${expedition.status}`} />
                <div><strong>{expedition.name.replace('Экспедиция «', '').replace('»', '')}</strong><small>{statusLabels[expedition.status]} · {expedition.daysElapsed} дн.</small></div>
                <ArrowRight size={14} />
              </button>
            ))}
          </aside>

          <div className="field-command-main">
            <article className={`field-hero paper-card status-${selected.status}`}>
              <div className="field-hero-title">
                <div><span className="type-chip">{statusLabels[selected.status]}</span><h2>{selected.name}</h2><p>{selected.objectiveText}</p></div>
                <div className="field-progress-number"><strong>{progress}%</strong><span>{selected.daysElapsed}/{selected.expectedDays} дней</span></div>
              </div>
              <div className="progress-line"><span style={{ width: `${progress}%` }} /></div>
              <div className="field-route-summary">
                <span><MapPinned size={15} /><b>{currentTile?.biome ?? 'неизвестная земля'}</b><small>последняя позиция</small></span>
                <ArrowRight size={15} />
                <span><Crosshair size={15} /><b>{targetName}</b><small>главная цель</small></span>
                <span className={`field-contact ${selected.status === 'missing' ? 'lost' : ''}`}><Radio size={15} /><b>{selected.status === 'missing' ? 'Связь потеряна' : 'Связь подтверждена'}</b><small>день {state.day}</small></span>
              </div>
              <div className="route-progress-strip" aria-label="Маршрут экспедиции">
                {routePoints(selected).map((point) => <i key={`${point.id}-${point.routeIndex}`} className={point.routeIndex < selected.routeIndex ? 'passed' : point.routeIndex === selected.routeIndex ? 'current' : ''} />)}
              </div>
            </article>

            <div className="field-stat-grid">
              <div><Users /><span>Отряд</span><strong>{members.length}</strong></div>
              <div><Package /><span>Провизия</span><strong>{selected.food}</strong></div>
              <div><HeartPulse /><span>Медицина</span><strong>{selected.medicine}</strong></div>
              <div><Shield /><span>Мораль</span><strong>{Math.round(selected.morale)}%</strong></div>
              <div><Skull /><span>Бои</span><strong>{selected.battles}</strong></div>
              <div><Compass /><span>Открытия</span><strong>{selected.discoveries.length}</strong></div>
            </div>

            <div className="field-command-columns">
              <section className="field-team paper-card">
                <div className="section-title"><Users size={18} /><div><p className="eyebrow">Состав</p><h3>Люди в походе</h3></div></div>
                <div className="field-team-list">
                  {members.map((member) => member && (
                    <div key={member.id} className={member.id === selected.leaderId ? 'leader' : ''}>
                      <span className="field-member-avatar">{member.name.slice(0, 1)}</span>
                      <div><strong>{member.name}{member.id === selected.leaderId && <em>лидер</em>}</strong><small>{member.profession} · {member.status}</small></div>
                      <div className="field-health"><span><i style={{ width: `${Math.max(0, member.health)}%` }} /></span><b>{Math.round(member.health)}</b></div>
                    </div>
                  ))}
                </div>
                {selected.casualties.length > 0 && <div className="field-casualty-warning"><AlertTriangle size={15} />Потери: {selected.casualties.length}</div>}
              </section>

              <section className="field-log paper-card">
                <div className="section-title"><Clock3 size={18} /><div><p className="eyebrow">Журнал</p><h3>Последние донесения</h3></div></div>
                <div className="field-log-groups">
                  {logGroups.length === 0 && <p className="muted">Донесений пока нет.</p>}
                  {logGroups.map((group, index) => (
                    <details key={group.day} open={index === 0 || group.important}>
                      <summary><span>День {group.day}</span><b>{group.logs.length} записей{group.important ? ' · важно' : ''}</b></summary>
                      <div>
                        {group.logs.map((log, logIndex) => <article key={`${group.day}-${logIndex}`} className={`log-${log.type}`}><i /><span><strong>{log.title}</strong><p>{log.text}</p></span></article>)}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
