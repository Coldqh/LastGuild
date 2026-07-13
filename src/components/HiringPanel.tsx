import { Search, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GameState } from '../types/game'

interface Props { state: GameState; onHire: (characterId: string) => void }

export default function HiringPanel({ state, onHire }: Props) {
  const [query, setQuery] = useState('')
  const [profession, setProfession] = useState('all')
  const candidates = useMemo(() => state.characters.filter((entry) => !entry.employed && !entry.rivalGuildId && !entry.academyEnrollmentId && !['dead', 'missing', 'retired'].includes(entry.status)).filter((entry) => {
    const match = `${entry.name} ${entry.profession} ${entry.ancestry} ${entry.traits.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return match && (profession === 'all' || entry.profession === profession)
  }), [state.characters, query, profession])
  const professions = [...new Set(state.characters.filter((entry) => !entry.employed && !entry.rivalGuildId).map((entry) => entry.profession))].sort()
  return <section className="view focused-view hiring-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Рынок людей</p><h1>Наём исследователей</h1><p>Только свободные кандидаты. Ученики академии и служащие конкурентов сюда не попадают.</p></div><div className="capacity-badge"><Users size={18} /><b>{candidates.length}</b><span>кандидатов</span></div></header>
    <div className="toolbar hiring-toolbar">
      <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, профессия, народ, черта" /></label>
      <select value={profession} onChange={(event) => setProfession(event.target.value)}><option value="all">Все профессии</option>{professions.map((item) => <option key={item}>{item}</option>)}</select>
      <span className="result-count"><Users size={14} /> {candidates.length}</span>
    </div>
    <div className="hiring-grid">
      {candidates.map((character) => {
        const cost = 60 + character.level * 25
        return <article className="hire-card" key={character.id}>
          <div className="hire-card-head"><div><h3>{character.name}</h3><p>{character.ancestry} · {character.age} лет</p></div><span>ур. {character.level}</span></div>
          <strong>{character.profession}</strong>
          <div className="tag-list">{character.traits.slice(0, 3).map((trait) => <span key={trait}>{trait}</span>)}</div>
          <div className="hire-stats"><span>Бой {character.skills.combat}</span><span>Выживание {character.skills.survival}</span><span>Лидерство {character.skills.leadership}</span></div>
          <p className="muted">{character.origin}</p>
          <button className="primary-button" disabled={state.guild.treasury < cost} onClick={() => onHire(character.id)}>Нанять · {cost} кр.</button>
        </article>
      })}
      {!candidates.length && <div className="empty-state"><UserPlus size={28} /><h3>Свободных кандидатов нет</h3><p>Рынок обновится со временем или после изменений в мире.</p></div>}
    </div>
  </section>
}
