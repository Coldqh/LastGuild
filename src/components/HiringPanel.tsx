import { HeartPulse, Search, Shield, Star, UserPlus, UserRound, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Character, GameState } from '../types/game'

interface Props { state: GameState; onHire: (characterId: string) => void }

function characterGradient(seed: number): string {
  const hueA = seed % 360
  const hueB = (seed * 7) % 360
  return `linear-gradient(145deg, hsl(${hueA} 28% 34%), hsl(${hueB} 24% 17%))`
}

export default function HiringPanel({ state, onHire }: Props) {
  const [query, setQuery] = useState('')
  const [profession, setProfession] = useState('all')
  const marketCandidates = useMemo(() => state.characters.filter((entry) => (
    !entry.employed
    && !entry.rivalGuildId
    && !['dead', 'missing', 'retired'].includes(entry.status)
  )), [state.characters])
  const candidates = useMemo(() => marketCandidates.filter((entry) => {
    const match = `${entry.name} ${entry.profession} ${entry.ancestry} ${entry.traits.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return match && (profession === 'all' || entry.profession === profession)
  }), [marketCandidates, query, profession])
  const professions = [...new Set(marketCandidates.map((entry) => entry.profession))].sort()

  return <section className="view focused-view hiring-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Рынок людей</p><h1>Наём</h1></div><div className="capacity-badge"><Users size={16} /><b>{candidates.length}</b><span>кандидатов</span></div></header>
    <div className="toolbar hiring-toolbar">
      <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, профессия, народ" /></label>
      <select value={profession} onChange={(event) => setProfession(event.target.value)}><option value="all">Все профессии</option>{professions.map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <div className="character-grid hiring-character-grid">
      {candidates.map((character) => {
        const cost = 60 + character.level * 25
        return <article className="character-card hire-character-card" key={character.id}>
          <div className="portrait" style={{ background: characterGradient(character.portraitSeed) }}>
            <UserRound size={40} />
            <span className="status-dot available" />
          </div>
          <div className="character-body">
            <div className="character-name"><h3>{character.name}</h3><span>ур. {character.level}</span></div>
            <p>{character.ancestry} · {character.age} лет</p>
            <strong>{character.profession}</strong>
            <div className="tag-list">{character.traits.slice(0, 2).map((trait) => <span key={trait}>{trait}</span>)}</div>
            <div className="mini-stats hire-mini-stats"><span><HeartPulse size={13} />{Math.round(character.health)}</span><span><Shield size={13} />{character.skills.combat}</span><span><Star size={13} />{character.skills.survival}</span></div>
            <button className="primary-button hire-inline-button" disabled={state.guild.treasury < cost} onClick={() => onHire(character.id)}><UserPlus size={14} />{cost} кр.</button>
          </div>
        </article>
      })}
      {!candidates.length && <div className="empty-state"><UserPlus size={28} /><h3>Свободных кандидатов нет</h3><p>Рынок обновится со временем.</p></div>}
    </div>
  </section>
}
