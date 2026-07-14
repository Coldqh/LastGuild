import { useMemo, useState } from 'react'
import { Activity, Award, HeartPulse, Link2, Search, Shield, Star, UserRound, X } from 'lucide-react'
import type { CharacterCareerStage, GameState } from '../types/game'

interface Props {
  state: GameState
  onDismiss: (characterId: string) => void
}

const careerLabels: Record<CharacterCareerStage, string> = {
  recruit: 'новичок', field: 'исследователь', veteran: 'ветеран', leader: 'лидер', mentor: 'наставник', legend: 'легенда',
}

function characterGradient(seed: number): string {
  const hueA = seed % 360
  const hueB = (seed * 7) % 360
  return `linear-gradient(145deg, hsl(${hueA} 28% 34%), hsl(${hueB} 24% 17%))`
}

function relationshipLabel(value: number): string {
  if (value >= 55) return 'доверие'
  if (value >= 20) return 'уважение'
  if (value > -20) return 'нейтрально'
  if (value > -55) return 'обида'
  return 'вражда'
}

export default function RosterView({ state, onDismiss }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = state.characters.find((character) => character.id === selectedId) ?? null
  const filtered = useMemo(() => state.characters.filter((character) => character.employed || character.expeditions > 0 || ['dead', 'missing', 'retired'].includes(character.status)).filter((character) => {
    const matchesQuery = `${character.name} ${character.profession} ${character.ancestry} ${careerLabels[character.careerStage]}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === 'all' || character.status === status)
  }), [state.characters, query, status])

  const selectedRelationships = selected
    ? Object.entries(selected.relationships)
      .map(([characterId, value]) => ({ character: state.characters.find((candidate) => candidate.id === characterId), value }))
      .filter((entry) => entry.character)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 6)
    : []

  return (
    <section className="view roster-view">
      <header className="view-heading compact-heading"><div><p className="eyebrow">Личный состав</p><h1>Персонажи</h1></div></header>
      <div className="toolbar paper-card">
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, народ, профессия" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Все статусы</option><option value="available">Доступны</option><option value="expedition">В экспедиции</option><option value="recovering">Лечатся</option><option value="missing">Пропали</option><option value="dead">Погибли</option><option value="retired">На покое</option>
        </select>
        <span className="result-count">{filtered.length}</span>
      </div>

      <div className="character-grid">
        {filtered.map((character) => (
          <button className="character-card" key={character.id} onClick={() => setSelectedId(character.id)}>
            <div className="portrait" style={{ background: characterGradient(character.portraitSeed) }}><UserRound size={42} /><span className={`status-dot ${character.status}`} /></div>
            <div className="character-body">
              <div className="character-name"><h3>{character.name}</h3><span>ур. {character.level}</span></div>
              <p>{character.ancestry} · {character.age} лет</p><strong>{character.profession}</strong>
              <div className="character-chip-row"><span className={`employment-chip ${character.employed ? 'member' : character.rivalGuildId ? 'rival' : 'candidate'}`}>{character.employed ? 'штат' : character.status === 'retired' ? 'ветеран' : character.status === 'dead' ? 'погиб' : character.status === 'missing' ? 'пропал' : 'бывший'}</span><span className={`career-chip stage-${character.careerStage}`}>{careerLabels[character.careerStage]}</span></div>
              <div className="mini-stats"><span><HeartPulse size={13} />{Math.round(character.health)}</span><span><Shield size={13} />{character.skills.combat}</span><span><Star size={13} />{character.fame}</span></div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <article className="character-sheet compact-character-sheet paper-card" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button close-detail" onClick={() => setSelectedId(null)}><X size={18} /></button>
            <div className="sheet-header compact-sheet-header">
              <div className="portrait large" style={{ background: characterGradient(selected.portraitSeed) }}><UserRound size={56} /></div>
              <div className="character-sheet-title"><p className="eyebrow">{selected.profession} · {careerLabels[selected.careerStage]} · ур. {selected.level}</p><h2>{selected.name}</h2><p>{selected.ancestry} · {selected.culture} · {selected.age} лет</p><div className="tag-list">{selected.traits.slice(0, 4).map((trait) => <span key={trait}>{trait}</span>)}</div></div>
            </div>

            <div className="character-inline-stats">
              <span><HeartPulse />HP <b>{Math.round(selected.health)}</b></span><span><Activity />стресс <b>{Math.round(selected.stress)}</b></span><span><Award />слава <b>{selected.fame}</b></span><span><Shield />лояльность <b>{selected.loyalty}</b></span><span>XP <b>{selected.experience}</b></span>
            </div>

            <div className="character-compact-facts">
              <span><b>Амбиция:</b> {selected.ambition}</span><span><b>Страх:</b> {selected.fear}</span><span><b>Служба:</b> {selected.expeditions} походов · {selected.discoveries} открытий · {selected.employed ? `${selected.salary} кр./мес.` : 'не в штате'}</span>
            </div>

            <section className="compact-profile-section"><h3>Навыки</h3><div className="compact-skill-grid">{Object.entries(selected.skills).map(([name, value]) => <span key={name}><small>{name}</small><b>{value}</b></span>)}</div></section>

            <div className="compact-profile-details">
              <details><summary>Отношения · {selectedRelationships.length}</summary>{selectedRelationships.length === 0 ? <p className="muted">Значимых связей нет.</p> : <div className="compact-relationship-list">{selectedRelationships.map(({ character, value }) => <div className="relationship-row" key={character!.id}><Link2 size={13} /><span><strong>{character!.name}</strong><small>{relationshipLabel(value)}</small></span><b className={value < 0 ? 'negative' : 'positive'}>{value > 0 ? '+' : ''}{value}</b></div>)}</div>}</details>
              <details><summary>Травмы · {selected.injuryRecords.length}</summary>{selected.injuryRecords.length === 0 ? <p className="muted">Серьёзных травм нет.</p> : selected.injuryRecords.map((injury) => <div className={`injury-entry severity-${injury.severity}`} key={injury.id}><span><strong>{injury.name}</strong><small>{injury.effect}</small></span><b>{injury.permanent ? 'навсегда' : injury.treated ? 'вылечена' : `${injury.recoveryDays} дн.`}</b></div>)}</details>
              <details><summary>Память · {selected.memories.length}</summary>{selected.memories.length === 0 ? <p className="muted">Значимых событий нет.</p> : [...selected.memories].reverse().slice(0, 12).map((memory) => <div className={`memory-entry memory-${memory.valence}`} key={memory.id}><span><strong>{memory.title}</strong><small>{memory.description}</small></span><b>{memory.year}.{memory.day}</b></div>)}</details>
              <details><summary>Поведение в бою</summary><div className="combat-behavior-inline"><span>{selected.combatBehavior.role}</span><span>дист. {selected.combatBehavior.preferredRange}</span><span>агрессия {selected.combatBehavior.aggression}</span><span>отход {selected.combatBehavior.retreatAt}%</span><span>{selected.combatBehavior.protectWeak ? 'прикрывает слабых' : 'держит позицию'}</span></div></details>
            </div>

            {selected.employed ? <button className="secondary-button personnel-action" disabled={selected.status === 'expedition'} onClick={() => { onDismiss(selected.id); setSelectedId(null) }}>Расторгнуть контракт</button> : selected.rivalGuildId ? <div className="rival-employment-note">Служит у конкурента: <strong>{state.rivalGuilds.find((guild) => guild.id === selected.rivalGuildId)?.name ?? 'неизвестно'}</strong></div> : null}
          </article>
        </div>
      )}
    </section>
  )
}
