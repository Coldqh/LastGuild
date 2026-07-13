import { Banknote, BookOpen, Boxes, Building2, Landmark, ShieldCheck, Users } from 'lucide-react'
import type { GameState } from '../types/game'

interface Props {
  state: GameState
  onPayDebt: (amount: number) => void
}

export default function GuildView({ state, onPayDebt }: Props) {
  const active = state.expeditions.filter((entry) => entry.status === 'active' || entry.status === 'returning').length
  const employed = state.characters.filter((entry) => entry.employed && !['dead', 'retired'].includes(entry.status)).length
  const payroll = state.characters.filter((entry) => entry.employed && !['dead', 'retired'].includes(entry.status)).reduce((sum, entry) => sum + entry.salary, 0)
  const maintenance = state.guild.rooms.reduce((sum, room) => sum + room.maintenance, 0)
  const interest = Math.ceil(state.guild.debt * state.guild.debtInterest)
  const academyCost = state.academy.monthlyCost
  const quartermasterDiscount = state.guild.positions.some((entry) => entry.id === 'quartermaster' && entry.holderId) ? 0.92 : 1
  const monthlyTotal = Math.ceil((payroll + maintenance + interest + academyCost) * quartermasterDiscount)
  const roomCondition = Math.round(state.guild.rooms.reduce((sum, room) => sum + room.condition, 0) / Math.max(1, state.guild.rooms.length))
  const currentGeneration = state.generations.find((entry) => !entry.endedYear)

  return (
    <section className="view guild-view focused-view">
      <header className="view-heading compact-heading">
        <div>
          <p className="eyebrow">Штаб · ранг {state.guild.rank}</p>
          <h1>{state.guild.name}</h1>
          <p>Главный обзор организации. Наём, помещения, академия, должности, совет и наследие вынесены в отдельные разделы боковой панели.</p>
        </div>
        <div className="date-seal">{state.year}<small>год</small></div>
      </header>

      <div className="focus-metric-grid">
        <article><Banknote /><span>Казна</span><strong>{state.guild.treasury} кр.</strong><small>Долг {state.guild.debt}</small></article>
        <article><Users /><span>Состав</span><strong>{employed}</strong><small>{active}/{state.guild.maxActiveExpeditions} походов</small></article>
        <article><Building2 /><span>Штаб</span><strong>{roomCondition}%</strong><small>{state.guild.rooms.length} помещений</small></article>
        <article><ShieldCheck /><span>Устойчивость</span><strong>{state.guild.stability}%</strong><small>Авторитет {state.guild.scientificAuthority}</small></article>
      </div>

      <div className="headquarters-focus-grid">
        <article className="paper-card compact-finance-card">
          <div className="section-title"><Banknote size={19} /><div><p className="eyebrow">Финансы</p><h2>Месячный прогноз</h2></div></div>
          <div className="compact-ledger">
            <span>Жалование <b>−{payroll}</b></span>
            <span>Помещения <b>−{maintenance}</b></span>
            <span>Академия <b>−{academyCost}</b></span>
            <span>Проценты <b>−{interest}</b></span>
          </div>
          <div className="finance-total"><span>Обязательные расходы</span><strong>{monthlyTotal} кр.</strong></div>
          <div className="button-row compact-actions">
            <button className="secondary-button small" disabled={state.guild.treasury < 100 || state.guild.debt === 0} onClick={() => onPayDebt(100)}>Погасить 100</button>
            <button className="secondary-button small" disabled={state.guild.treasury < 500 || state.guild.debt === 0} onClick={() => onPayDebt(500)}>Погасить 500</button>
          </div>
        </article>

        <article className="paper-card headquarters-state-card">
          <div className="section-title"><Landmark size={19} /><div><p className="eyebrow">Организация</p><h2>Текущее состояние</h2></div></div>
          <div className="compact-status-list">
            <span>Глава <b>{state.characters.find((entry) => entry.id === state.guild.leaderId)?.name ?? 'не назначен'}</b></span>
            <span>Поколение <b>{currentGeneration?.name ?? 'не определено'}</b></span>
            <span>Совет <b>{state.council.filter((entry) => entry.holderId).length}/{state.council.length}</b></span>
            <span>Академия <b>ур. {state.academy.level}</b></span>
            <span>Филиалы <b>{state.branches.length}</b></span>
            <span>Память <b>{state.guild.institutionalMemory}</b></span>
          </div>
        </article>

        <article className="paper-card compact-reserves-card">
          <div className="section-title"><Boxes size={19} /><div><p className="eyebrow">Резервы</p><h2>Склад</h2></div></div>
          <div className="reserve-strip"><span>Провизия <b>{state.guild.supplies}</b></span><span>Медицина <b>{state.guild.medicine}</b></span><span>Артефакты <b>{state.guild.artifacts}</b></span></div>
        </article>

        <article className="paper-card compact-knowledge-card">
          <div className="section-title"><BookOpen size={19} /><div><p className="eyebrow">Знания</p><h2>Сильные области</h2></div></div>
          <div className="knowledge-chip-list">{Object.entries(state.guild.knowledge).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => <span key={name}>{name}<b>{value}</b></span>)}</div>
        </article>
      </div>
    </section>
  )
}
