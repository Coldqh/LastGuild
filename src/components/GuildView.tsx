import { Banknote, BookOpen, Boxes, Building2, Landmark, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { GameState } from '../types/game'

interface Props {
  state: GameState
  onUpgrade: (roomId: string) => void
  onPayDebt: (amount: number) => void
}

const metricIcons = [Banknote, Landmark, BookOpen, Users, ShieldCheck, Sparkles]

export default function GuildView({ state, onUpgrade, onPayDebt }: Props) {
  const active = state.expeditions.filter((expedition) => expedition.status === 'active' || expedition.status === 'returning').length
  const payroll = state.characters.filter((character) => character.employed && character.status !== 'dead' && character.status !== 'retired').reduce((sum, character) => sum + character.salary, 0)
  const maintenance = state.guild.rooms.reduce((sum, room) => sum + room.maintenance, 0)
  const metrics = [
    ['Казна', `${state.guild.treasury} кр.`, 'Доступные средства'],
    ['Долг', `${state.guild.debt} кр.`, `${Math.round(state.guild.debtInterest * 100)}% в месяц`],
    ['Авторитет', state.guild.scientificAuthority, 'Научное признание'],
    ['Состав', state.characters.filter((character) => character.employed && character.status !== 'dead').length, `${active}/${state.guild.maxActiveExpeditions} экспедиций`],
    ['Устойчивость', `${state.guild.stability}%`, 'Способность пережить кризис'],
    ['Репутация', state.guild.reputation, 'Известность гильдии'],
  ]

  return (
    <section className="view guild-view">
      <header className="view-heading">
        <div>
          <p className="eyebrow">Штаб · ранг {state.guild.rank}</p>
          <h1>{state.guild.name}</h1>
          <p>Старый дом в провинциальном городе. Крыша течёт, кредиторы ждут, архив ещё держится.</p>
        </div>
        <div className="date-seal">{state.year}<small>год</small></div>
      </header>

      <div className="metric-grid">
        {metrics.map(([label, value, note], index) => {
          const Icon = metricIcons[index]
          return (
            <article className="metric-card" key={label}>
              <Icon size={19} />
              <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
            </article>
          )
        })}
      </div>

      <div className="dashboard-grid">
        <div className="paper-card rooms-panel">
          <div className="section-title"><Building2 size={19} /><div><p className="eyebrow">Здание</p><h2>Помещения штаба</h2></div></div>
          <div className="room-grid">
            {state.guild.rooms.map((room) => (
              <article className="room-card" key={room.id}>
                <div className="room-top"><h3>{room.name}</h3><span>ур. {room.level}</span></div>
                <p>{room.description}</p>
                <div className="progress-line"><span style={{ width: `${room.condition}%` }} /></div>
                <div className="room-meta"><span>Состояние {room.condition}%</span><span>Вместимость {room.capacity}</span></div>
                <div className="room-effect">{room.effect}</div>
                <button className="primary-button small" disabled={state.guild.treasury < room.upgradeCost} onClick={() => onUpgrade(room.id)}>
                  Улучшить · {room.upgradeCost} кр.
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="side-stack">
          <article className="paper-card finance-panel">
            <div className="section-title"><Banknote size={19} /><div><p className="eyebrow">Финансы</p><h2>Месячный прогноз</h2></div></div>
            <div className="finance-line"><span>Жалование</span><strong>−{payroll}</strong></div>
            <div className="finance-line"><span>Содержание</span><strong>−{maintenance}</strong></div>
            <div className="finance-line"><span>Проценты</span><strong>−{Math.ceil(state.guild.debt * state.guild.debtInterest)}</strong></div>
            <div className="finance-total"><span>Обязательные расходы</span><strong>{payroll + maintenance + Math.ceil(state.guild.debt * state.guild.debtInterest)} кр.</strong></div>
            <div className="button-row">
              <button className="secondary-button" disabled={state.guild.treasury < 100 || state.guild.debt === 0} onClick={() => onPayDebt(100)}>Внести 100</button>
              <button className="secondary-button" disabled={state.guild.treasury < 500 || state.guild.debt === 0} onClick={() => onPayDebt(500)}>Внести 500</button>
            </div>
          </article>

          <article className="paper-card stores-panel">
            <div className="section-title"><Boxes size={19} /><div><p className="eyebrow">Резервы</p><h2>Склад</h2></div></div>
            <div className="store-stat"><span>Провизия</span><strong>{state.guild.supplies}</strong></div>
            <div className="store-stat"><span>Медицина</span><strong>{state.guild.medicine}</strong></div>
            <div className="store-stat"><span>Артефакты</span><strong>{state.guild.artifacts}</strong></div>
          </article>

          <article className="paper-card knowledge-panel">
            <div className="section-title"><BookOpen size={19} /><div><p className="eyebrow">Архив</p><h2>Области знания</h2></div></div>
            {Object.entries(state.guild.knowledge).map(([name, value]) => (
              <div className="knowledge-row" key={name}><span>{name}</span><div><i style={{ width: `${Math.min(100, value)}%` }} /></div><strong>{value}</strong></div>
            ))}
          </article>
        </div>
      </div>
    </section>
  )
}
