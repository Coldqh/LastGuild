import { Crosshair, FastForward, Flag, HeartPulse, Play, Shield, ShieldAlert, Skull, Swords, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CombatCommandType, GameState } from '../types/game'

interface Props {
  state: GameState
  onStep: () => void
  onAuto: () => void
  onCommand: (command: CombatCommandType, targetId?: string) => void
  onFinalize: () => void
}

const obstacleLabels = { rock: '◆', tree: '♣', ruin: '▥', pit: '●' }

export default function CombatModal({ state, onStep, onAuto, onCommand, onFinalize }: Props) {
  const combat = state.pendingCombat!
  const [enemyTarget, setEnemyTarget] = useState('')
  const [allyTarget, setAllyTarget] = useState('')
  const guild = combat.units.filter((unit) => unit.side === 'guild')
  const enemies = combat.units.filter((unit) => unit.side === 'enemy')
  const aliveGuild = guild.filter((unit) => unit.hp > 0)
  const aliveEnemies = enemies.filter((unit) => unit.hp > 0)
  const unitMap = useMemo(() => new Map(combat.units.filter((unit) => unit.hp > 0).map((unit) => [`${unit.x}:${unit.y}`, unit])), [combat.units])
  const cellMap = useMemo(() => new Map(combat.cells.map((cell) => [`${cell.x}:${cell.y}`, cell])), [combat.cells])
  const statusLabel = combat.status === 'active' ? `Раунд ${combat.round}` : combat.status === 'victory' ? 'Победа' : combat.status === 'retreated' ? 'Отступление' : 'Разгром'

  return (
    <div className="modal-backdrop combat-backdrop">
      <article className="combat-modal">
        <header className="combat-header">
          <div><p className="eyebrow">Клеточный автобой · {statusLabel}</p><h2>{combat.title}</h2><p>Отряд {aliveGuild.length}/{guild.length} · противники {aliveEnemies.length}/{enemies.length} · командные очки {combat.commandPoints}</p></div>
          <div className={`combat-status status-${combat.status}`}><Swords size={20} />{statusLabel}</div>
        </header>

        <div className="combat-layout">
          <div>
            <div className="combat-grid" style={{ gridTemplateColumns: `repeat(${combat.width}, minmax(34px, 1fr))` }}>
              {Array.from({ length: combat.width * combat.height }, (_, index) => {
                const x = index % combat.width
                const y = Math.floor(index / combat.width)
                const unit = unitMap.get(`${x}:${y}`)
                const cell = cellMap.get(`${x}:${y}`)
                return <div key={`${x}:${y}`} className={`combat-cell ${cell?.obstacle ? `obstacle obstacle-${cell.obstacle}` : ''}`}>
                  {cell?.obstacle && <span className="obstacle-mark">{obstacleLabels[cell.obstacle]}</span>}
                  {unit && <div className={`combat-token ${unit.side} role-${unit.role} ${unit.legendary ? 'legendary' : ''}`} title={`${unit.name}: ${unit.hp}/${unit.maxHp}`}>
                    {unit.side === 'guild' ? <Shield size={14} /> : unit.legendary ? <Skull size={16} /> : <ShieldAlert size={14} />}
                    <span>{unit.name.split(' ')[0]}</span>
                    <i style={{ width: `${Math.max(0, unit.hp / unit.maxHp * 100)}%` }} />
                  </div>}
                </div>
              })}
            </div>
            <div className="combat-legend"><span><i className="guild-dot" />гильдия</span><span><i className="enemy-dot" />противники</span><span>◆ укрытие</span><span>● провал</span></div>
          </div>

          <aside className="combat-sidebar">
            <section className="combat-roster-block">
              <h3><Users size={17} /> Отряд</h3>
              {guild.map((unit) => <div className={`combat-unit-row ${unit.hp <= 0 ? 'down' : ''}`} key={unit.id}><span><strong>{unit.name}</strong><small>{unit.role} · {unit.ability}</small></span><b>{Math.max(0, unit.hp)}/{unit.maxHp}</b></div>)}
            </section>
            <section className="combat-roster-block enemies">
              <h3><Skull size={17} /> Противники</h3>
              {enemies.map((unit) => <div className={`combat-unit-row ${unit.hp <= 0 ? 'down' : ''}`} key={unit.id}><span><strong>{unit.legendary ? '★ ' : ''}{unit.name}</strong><small>{unit.ability}</small></span><b>{Math.max(0, unit.hp)}/{unit.maxHp}</b></div>)}
            </section>
          </aside>
        </div>

        {combat.status === 'active' ? <div className="combat-controls paper-card">
          <button className="primary-button" onClick={onStep}><Play size={16} />Следующий раунд</button>
          <button className="secondary-button" onClick={onAuto}><FastForward size={16} />Автобой до конца</button>
          <label><Crosshair size={15} /><select value={enemyTarget} onChange={(event) => setEnemyTarget(event.target.value)}><option value="">Цель огня</option>{aliveEnemies.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><button disabled={!enemyTarget || combat.commandPoints <= 0} onClick={() => onCommand('focus', enemyTarget)}>Приказ</button></label>
          <label><Shield size={15} /><select value={allyTarget} onChange={(event) => setAllyTarget(event.target.value)}><option value="">Кого прикрыть</option>{aliveGuild.map((unit) => <option key={unit.id} value={unit.sourceId}>{unit.name}</option>)}</select><button disabled={!allyTarget || combat.commandPoints <= 0} onClick={() => onCommand('protect', allyTarget)}>Приказ</button></label>
          <button disabled={combat.commandPoints <= 0} onClick={() => onCommand('rally')}><HeartPulse size={16} />Собрать строй</button>
          <button className="danger-button" disabled={combat.commandPoints <= 0} onClick={() => onCommand('retreat')}><Flag size={16} />Отступать</button>
        </div> : <div className="combat-result paper-card"><div><h3>{statusLabel}</h3><p>Бой завершён за {combat.round - 1} раундов. Результаты, ранения, трофеи и данные бестиария будут применены к экспедиции.</p></div><button className="primary-button" onClick={onFinalize}><X size={16} />Принять исход</button></div>}

        <div className="combat-log paper-card">
          <h3>Журнал боя</h3>
          {[...combat.logs].reverse().slice(0, 10).map((entry, index) => <div key={`${entry.round}-${index}`} className={`combat-log-entry log-${entry.type}`}><span>R{entry.round}</span><p>{entry.text}</p></div>)}
        </div>
      </article>
    </div>
  )
}
