import { useMemo, useState } from 'react'
import { Activity, Award, HeartPulse, Search, Shield, Star, UserRound, X } from 'lucide-react'
import type { Character, GameState } from '../types/game'

interface Props {
  state: GameState
  onHire: (characterId: string) => void
  onDismiss: (characterId: string) => void
}

function characterGradient(seed: number): string {
  const hueA = seed % 360
  const hueB = (seed * 7) % 360
  return `linear-gradient(145deg, hsl(${hueA} 28% 34%), hsl(${hueB} 24% 17%))`
}

export default function RosterView({ state, onHire, onDismiss }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Character | null>(null)
  const filtered = useMemo(() => state.characters.filter((character) => {
    const matchesQuery = `${character.name} ${character.profession} ${character.ancestry}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === 'all' || character.status === status)
  }), [state.characters, query, status])

  return (
    <section className="view roster-view">
      <header className="view-heading">
        <div><p className="eyebrow">Личный состав</p><h1>Исследователи гильдии</h1><p>Случайные новички получают историю только через реальные экспедиции, травмы и открытия.</p></div>
      </header>
      <div className="toolbar paper-card">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, народ или профессия" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="available">Доступны</option>
          <option value="expedition">В экспедиции</option>
          <option value="recovering">Лечатся</option>
          <option value="missing">Пропали</option>
          <option value="dead">Погибли</option>
        </select>
        <span className="result-count">{filtered.length} человек</span>
      </div>

      <div className="character-grid">
        {filtered.map((character) => (
          <button className="character-card" key={character.id} onClick={() => setSelected(character)}>
            <div className="portrait" style={{ background: characterGradient(character.portraitSeed) }}>
              <UserRound size={42} />
              <span className={`status-dot ${character.status}`} />
            </div>
            <div className="character-body">
              <div className="character-name"><h3>{character.name}</h3><span>ур. {character.level}</span></div>
              <p>{character.ancestry} · {character.age} лет</p>
              <strong>{character.profession}</strong>
              <span className={`employment-chip ${character.employed ? 'member' : 'candidate'}`}>{character.employed ? 'штат' : 'кандидат'}</span>
              <div className="tag-list">{character.traits.slice(0, 2).map((trait) => <span key={trait}>{trait}</span>)}</div>
              <div className="mini-stats"><span><HeartPulse size={14} />{Math.round(character.health)}</span><span><Shield size={14} />{character.skills.combat}</span><span><Star size={14} />{character.fame}</span></div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article className="character-sheet paper-card" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button close-detail" onClick={() => setSelected(null)}><X size={18} /></button>
            <div className="sheet-header">
              <div className="portrait large" style={{ background: characterGradient(selected.portraitSeed) }}><UserRound size={64} /></div>
              <div><p className="eyebrow">{selected.profession} · уровень {selected.level}</p><h2>{selected.name}</h2><p>{selected.ancestry}, {selected.culture}, {selected.age} лет</p><div className="tag-list">{selected.traits.map((trait) => <span key={trait}>{trait}</span>)}</div></div>
            </div>
            <div className="sheet-status-grid">
              <div><HeartPulse /><span>Здоровье</span><strong>{Math.round(selected.health)}%</strong></div>
              <div><Activity /><span>Стресс</span><strong>{Math.round(selected.stress)}%</strong></div>
              <div><Award /><span>Слава</span><strong>{selected.fame}</strong></div>
              <div><Shield /><span>Лояльность</span><strong>{selected.loyalty}%</strong></div>
            </div>
            <div className="sheet-columns">
              <div>
                <h3>Навыки</h3>
                {Object.entries(selected.skills).map(([name, value]) => <div className="skill-row" key={name}><span>{name}</span><b>{value}</b></div>)}
              </div>
              <div>
                <h3>Личность</h3>
                <p><b>Амбиция:</b> {selected.ambition}</p>
                <p><b>Страх:</b> {selected.fear}</p>
                <p><b>Экспедиции:</b> {selected.expeditions}</p>
                <p><b>Открытия:</b> {selected.discoveries}</p>
                <p><b>Травмы:</b> {selected.injuries.length ? selected.injuries.join(', ') : 'нет'}</p>
                <p><b>Контракт:</b> {selected.employed ? `постоянный, ${selected.salary} кр./месяц` : `кандидат, подписание ${60 + selected.level * 25} кр.`}</p>
                {selected.employed ? (
                  <button className="secondary-button personnel-action" disabled={selected.status === 'expedition'} onClick={() => { onDismiss(selected.id); setSelected(null) }}>Расторгнуть контракт</button>
                ) : (
                  <button className="primary-button personnel-action" disabled={state.guild.treasury < 60 + selected.level * 25} onClick={() => { onHire(selected.id); setSelected(null) }}>Нанять · {60 + selected.level * 25} кр.</button>
                )}
                <h3>Память</h3>
                {selected.memories.length === 0 ? <p className="muted">Пока нет событий, которые определили его жизнь.</p> : selected.memories.map((memory) => <div className="memory-entry" key={memory.id}><strong>{memory.title}</strong><span>{memory.year} год</span></div>)}
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
