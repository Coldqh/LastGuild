import { BriefcaseBusiness } from 'lucide-react'
import type { GameState, GuildPositionId } from '../types/game'

interface Props { state: GameState; onAssign: (positionId: GuildPositionId, holderId?: string) => void }

export default function PositionsView({ state, onAssign }: Props) {
  const candidates = state.characters.filter((entry) => entry.employed && !entry.assignedBranchId && !['dead', 'missing', 'retired', 'expedition'].includes(entry.status))
  return <section className="view focused-view positions-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Администрация</p><h1>Должности гильдии</h1><p>Назначения и постоянные организационные эффекты без смешивания с помещениями и советом.</p></div><div className="capacity-badge"><BriefcaseBusiness size={18} /><b>{state.guild.positions.filter((entry) => entry.holderId).length}/{state.guild.positions.length}</b><span>занято</span></div></header>
    <div className="position-grid compact-position-grid">{state.guild.positions.map((position) => { const holder = state.characters.find((entry) => entry.id === position.holderId); return <article className={holder ? 'position-card filled' : 'position-card'} key={position.id}><div><h3>{position.name}</h3><span>{holder?.name ?? 'вакансия'}</span></div><p>{position.description}</p><strong>{position.effect}</strong><select value={position.holderId ?? ''} onChange={(event) => onAssign(position.id, event.target.value || undefined)}><option value="">Оставить вакантной</option>{candidates.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.profession} · ур. {character.level}</option>)}</select></article> })}</div>
  </section>
}
