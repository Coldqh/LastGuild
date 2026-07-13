import { Building2 } from 'lucide-react'
import type { GameState } from '../types/game'

interface Props { state: GameState; onUpgrade: (roomId: string) => void }

export default function RoomsView({ state, onUpgrade }: Props) {
  return <section className="view focused-view rooms-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Инфраструктура</p><h1>Помещения штаба</h1><p>Только состояние здания, эффекты и улучшения. Остальные системы вынесены в собственные разделы.</p></div><div className="capacity-badge"><Building2 size={18} /><b>{state.guild.rooms.length}</b><span>помещений</span></div></header>
    <div className="room-grid compact-room-grid">{state.guild.rooms.map((room) => <article className="room-card compact-room-card" key={room.id}><div className="room-top"><h3>{room.name}</h3><span>ур. {room.level}</span></div><p>{room.description}</p><div className="progress-line"><span style={{ width: `${room.condition}%` }} /></div><div className="room-meta"><span>Состояние {room.condition}%</span><span>Вместимость {room.capacity}</span></div><div className="room-effect">{room.effect}</div><button className="primary-button small" disabled={state.guild.treasury < room.upgradeCost} onClick={() => onUpgrade(room.id)}>Улучшить · {room.upgradeCost} кр.</button></article>)}</div>
  </section>
}
