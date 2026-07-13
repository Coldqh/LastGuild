import { useMemo, useState } from 'react'
import { Activity, Award, HeartPulse, Link2, Search, Shield, Star, UserRound, X } from 'lucide-react'
import type { Character, CharacterCareerStage, GameState } from '../types/game'

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
  if (value >= 55) return 'сильное доверие'
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
      <header className="view-heading">
        <div><p className="eyebrow">Личный состав</p><h1>Исследователи гильдии</h1><p>Здесь хранится действующий состав и история людей, уже связанных с гильдией. Свободные кандидаты находятся в отдельном разделе «Наём» боковой панели.</p></div>
      </header>
      <div className="toolbar paper-card">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, народ, профессия или карьера" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="available">Доступны</option>
          <option value="expedition">В экспедиции</option>
          <option value="recovering">Лечатся</option>
          <option value="missing">Пропали</option>
          <option value="dead">Погибли</option>
          <option value="retired">На покое</option>
        </select>
        <span className="result-count">{filtered.length} человек</span>
      </div>

      <div className="character-grid">
        {filtered.map((character) => (
          <button className="character-card" key={character.id} onClick={() => setSelectedId(character.id)}>
            <div className="portrait" style={{ background: characterGradient(character.portraitSeed) }}>
              <UserRound size={42} />
              <span className={`status-dot ${character.status}`} />
            </div>
            <div className="character-body">
              <div className="character-name"><h3>{character.name}</h3><span>ур. {character.level}</span></div>
              <p>{character.ancestry} · {character.age} лет</p>
              <strong>{character.profession}</strong>
              <div className="character-chip-row"><span className={`employment-chip ${character.employed ? 'member' : character.rivalGuildId ? 'rival' : 'candidate'}`}>{character.employed ? 'штат' : character.status === 'retired' ? 'ветеран' : character.status === 'dead' ? 'погиб' : character.status === 'missing' ? 'пропал' : 'бывший сотрудник'}</span><span className={`career-chip stage-${character.careerStage}`}>{careerLabels[character.careerStage]}</span></div>
              <div className="tag-list">{character.traits.slice(0, 2).map((trait) => <span key={trait}>{trait}</span>)}</div>
              <div className="mini-stats"><span><HeartPulse size={14} />{Math.round(character.health)}</span><span><Shield size={14} />{character.skills.combat}</span><span><Star size={14} />{character.fame}</span></div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <article className="character-sheet paper-card" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button close-detail" onClick={() => setSelectedId(null)}><X size={18} /></button>
            <div className="sheet-header">
              <div className="portrait large" style={{ background: characterGradient(selected.portraitSeed) }}><UserRound size={64} /></div>
              <div><p className="eyebrow">{selected.profession} · {careerLabels[selected.careerStage]} · уровень {selected.level}</p><h2>{selected.name}</h2><p>{selected.ancestry}, {selected.culture}, {selected.age} лет</p><p className="character-origin">{selected.origin}</p><div className="tag-list">{selected.traits.map((trait) => <span key={trait}>{trait}</span>)}</div></div>
            </div>
            <div className="sheet-status-grid">
              <div><HeartPulse /><span>Здоровье</span><strong>{Math.round(selected.health)}%</strong></div>
              <div><Activity /><span>Стресс</span><strong>{Math.round(selected.stress)}%</strong></div>
              <div><Award /><span>Слава</span><strong>{selected.fame}</strong></div>
              <div><Shield /><span>Лояльность</span><strong>{selected.loyalty}%</strong></div>
            </div>
            <div className="career-progress-card"><div><span>Опыт карьеры</span><strong>{selected.experience} XP</strong></div><div className="progress-line"><span style={{ width: `${selected.experience % 100}%` }} /></div><small>Следующий уровень через {100 - (selected.experience % 100)} XP</small></div>
            <div className="sheet-columns character-deep-columns">
              <div>
                <h3>Навыки</h3>
                {Object.entries(selected.skills).map(([name, value]) => <div className="skill-row" key={name}><span>{name}</span><b>{value}</b></div>)}
                <h3>Отношения</h3>
                {selectedRelationships.length === 0 ? <p className="muted">Значимых связей пока нет.</p> : selectedRelationships.map(({ character, value }) => <div className="relationship-row" key={character!.id}><Link2 size={14} /><div><strong>{character!.name}</strong><small>{relationshipLabel(value)}</small></div><b className={value < 0 ? 'negative' : 'positive'}>{value > 0 ? '+' : ''}{value}</b></div>)}
              </div>
              <div>
                <h3>Личность и служба</h3>
                <p><b>Амбиция:</b> {selected.ambition}</p>
                <p><b>Страх:</b> {selected.fear}</p>
                <p><b>Экспедиции:</b> {selected.expeditions}</p>
                <p><b>Открытия:</b> {selected.discoveries}</p>
                <p><b>Контракт:</b> {selected.employed ? `постоянный, ${selected.salary} кр./месяц` : 'не состоит в штате'}</p>{selected.assignedBranchId && <p><b>Назначение:</b> руководитель филиала «{state.branches.find((branch) => branch.id === selected.assignedBranchId)?.name ?? 'неизвестный филиал'}»</p>}
                <div className="combat-behavior-card"><strong>Поведение в бою</strong><span>Роль: {selected.combatBehavior.role}</span><span>Дистанция: {selected.combatBehavior.preferredRange}</span><span>Агрессивность: {selected.combatBehavior.aggression}%</span><span>Отступление при {selected.combatBehavior.retreatAt}% здоровья</span><span>{selected.combatBehavior.protectWeak ? 'прикрывает слабых' : 'держит личную позицию'}</span></div>
                {selected.employed ? (
                  <button className="secondary-button personnel-action" disabled={selected.status === 'expedition'} onClick={() => { onDismiss(selected.id); setSelectedId(null) }}>Расторгнуть контракт</button>
                ) : selected.rivalGuildId ? (
                  <div className="rival-employment-note">Сейчас служит в организации: <strong>{state.rivalGuilds.find((guild) => guild.id === selected.rivalGuildId)?.name ?? 'неизвестный конкурент'}</strong></div>
                ) : (
                  <div className="rival-employment-note">Персонаж больше не состоит в штате. Новый найм проводится через раздел «Наём».</div>
                )}
                <h3>Травмы и восстановление</h3>
                {selected.injuryRecords.length === 0 ? <p className="muted">Серьёзных травм нет.</p> : selected.injuryRecords.map((injury) => <div className={`injury-entry severity-${injury.severity}`} key={injury.id}><div><strong>{injury.name}</strong><span>{injury.effect}</span></div><small>{injury.permanent ? 'необратимая' : injury.treated ? 'вылечена' : `${injury.recoveryDays} дн. лечения`}</small></div>)}
              </div>
            </div>
            <div className="memory-section">
              <h3>Память</h3>
              {selected.memories.length === 0 ? <p className="muted">Пока нет событий, которые определили его жизнь.</p> : [...selected.memories].reverse().map((memory) => <div className={`memory-entry memory-${memory.valence}`} key={memory.id}><div><strong>{memory.title}</strong><p>{memory.description}</p></div><span>{memory.year} год · день {memory.day}<small>сила {memory.intensity}</small></span></div>)}
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
