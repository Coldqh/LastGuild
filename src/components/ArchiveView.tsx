import { BookMarked, Castle, Flame, Scroll, Search, Skull, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GameState } from '../types/game'

interface Props { state: GameState }

const categoryIcons = {
  guild: Castle,
  expedition: Scroll,
  world: Flame,
  character: Skull,
  discovery: Sparkles,
}

export default function ArchiveView({ state }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const entries = useMemo(() => [...state.chronicle]
    .filter((entry) => (category === 'all' || entry.category === category) && `${entry.title} ${entry.text}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.year - a.year || b.day - a.day), [state.chronicle, query, category])

  return (
    <section className="view archive-view">
      <header className="view-heading"><div><p className="eyebrow">Память организации</p><h1>Архив и хроника</h1><p>Здесь остаются открытия, провалы, погибшие и версии событий, которые гильдия решила считать официальными.</p></div></header>
      <div className="archive-summary">
        <article><BookMarked /><strong>{state.chronicle.length}</strong><span>записей хроники</span></article>
        <article><Sparkles /><strong>{state.world.sites.filter((site) => site.state !== 'unknown').length}</strong><span>известных мест</span></article>
        <article><Skull /><strong>{state.characters.filter((character) => character.status === 'dead' || character.status === 'missing').length}</strong><span>погибших и пропавших</span></article>
        <article><Scroll /><strong>{state.expeditions.length}</strong><span>экспедиций</span></article>
      </div>
      <div className="toolbar paper-card">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по хронике" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Все категории</option><option value="guild">Гильдия</option><option value="expedition">Экспедиции</option><option value="discovery">Открытия</option><option value="world">Мир</option><option value="character">Персонажи</option></select>
      </div>
      <div className="archive-layout">
        <div className="chronicle-list">
          {entries.map((entry) => {
            const Icon = categoryIcons[entry.category]
            return <article className={`chronicle-entry importance-${entry.importance}`} key={entry.id}><div className="chronicle-icon"><Icon size={18} /></div><div><div className="chronicle-date">{entry.year} год · день {entry.day}</div><h3>{entry.title}</h3><p>{entry.text}</p></div></article>
          })}
        </div>
        <aside className="paper-card ancient-history">
          <p className="eyebrow">До основания гильдии</p><h2>История региона</h2>
          {state.world.history.map((event) => <div className="history-entry" key={event.id}><span>{event.year}</span><div><h3>{event.title}</h3><p>{event.description}</p></div></div>)}
        </aside>
      </div>
    </section>
  )
}
