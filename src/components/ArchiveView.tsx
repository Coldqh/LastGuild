import { BookMarked, Castle, Flame, MapPinned, PawPrint, Scroll, Search, ShieldAlert, Skull, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DiscoveryDisposition, GameState } from '../types/game'

interface Props { state: GameState }

type ArchiveTab = 'chronicle' | 'discoveries' | 'places' | 'bestiary' | 'people' | 'consequences'

const categoryIcons = {
  guild: Castle,
  expedition: Scroll,
  world: Flame,
  character: Skull,
  discovery: Sparkles,
}

const dispositionLabels: Record<DiscoveryDisposition, string> = {
  unreviewed: 'ждёт решения', published: 'опубликовано', archived: 'в архиве', sold: 'продано', secret: 'засекречено',
}

export default function ArchiveView({ state }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [tab, setTab] = useState<ArchiveTab>('chronicle')
  const entries = useMemo(() => [...state.chronicle]
    .filter((entry) => (category === 'all' || entry.category === category) && `${entry.title} ${entry.text}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.year - a.year || b.day - a.day), [state.chronicle, query, category])
  const discoveries = useMemo(() => [...state.discoveries]
    .filter((discovery) => `${discovery.title} ${discovery.summary}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.createdYear - a.createdYear || b.createdDay - a.createdDay), [state.discoveries, query])
  const knownSites = state.world.sites.filter((site) => site.state !== 'unknown' && `${site.name} ${site.origin} ${site.layers.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const rememberedPeople = state.characters.filter((character) => (character.status === 'dead' || character.status === 'missing' || character.status === 'retired' || character.careerStage === 'legend') && `${character.name} ${character.profession} ${character.ancestry}`.toLowerCase().includes(query.toLowerCase()))
  const bestiary = state.bestiary.filter((entry) => { const species = state.world.monsterSpecies.find((candidate) => candidate.id === entry.speciesId); return `${species?.name ?? ''} ${entry.notes.join(' ')}`.toLowerCase().includes(query.toLowerCase()) }).sort((a, b) => b.knowledge - a.knowledge)
  const consequences = [...state.consequences].filter((consequence) => `${consequence.title} ${consequence.text}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.status === b.status ? b.dueTick - a.dueTick : a.status === 'pending' ? -1 : 1))

  return (
    <section className="view archive-view">
      <header className="view-heading"><div><p className="eyebrow">Память организации</p><h1>Архив, открытия и последствия</h1><p>Архив хранит не только официальную хронику, но и авторство, спорные свидетельства, судьбы людей и реакцию мира.</p></div></header>
      <div className="archive-summary">
        <article><BookMarked /><strong>{state.chronicle.length}</strong><span>записей хроники</span></article>
        <article><Sparkles /><strong>{state.discoveries.length}</strong><span>оформленных открытий</span></article>
        <article><Skull /><strong>{state.characters.filter((character) => character.status === 'dead' || character.status === 'missing').length}</strong><span>погибших и пропавших</span></article>
        <article><PawPrint /><strong>{state.bestiary.length}</strong><span>изученных видов</span></article>
        <article><ShieldAlert /><strong>{state.consequences.filter((consequence) => consequence.status === 'pending').length}</strong><span>грядущих последствий</span></article>
      </div>

      <div className="archive-tabs paper-card">
        {([
          ['chronicle', 'Хроника', BookMarked],
          ['discoveries', 'Открытия', Sparkles],
          ['places', 'Места', MapPinned],
          ['bestiary', 'Бестиарий', PawPrint],
          ['people', 'Люди', Users],
          ['consequences', 'Последствия', ShieldAlert],
        ] as Array<[ArchiveTab, string, typeof BookMarked]>).map(([id, label, Icon]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}
      </div>

      <div className="toolbar paper-card">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по архиву" /></label>
        {tab === 'chronicle' && <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Все категории</option><option value="guild">Гильдия</option><option value="expedition">Экспедиции</option><option value="discovery">Открытия</option><option value="world">Мир</option><option value="character">Персонажи</option></select>}
      </div>

      {tab === 'chronicle' && (
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
      )}

      {tab === 'discoveries' && (
        <div className="archive-card-grid">
          {discoveries.length === 0 ? <div className="empty-state paper-card"><Sparkles /><h3>Открытия ещё не оформлены</h3><p>После возвращения экспедиции проведи разбор и выбери судьбу найденных сведений.</p></div> : discoveries.map((discovery) => {
            const lead = state.characters.find((character) => character.id === discovery.leadDiscovererId)
            const expedition = state.expeditions.find((candidate) => candidate.id === discovery.expeditionId)
            const officialReport = expedition?.reports.find((report) => report.id === expedition.officialReportId)
            return <article className={`paper-card discovery-record disposition-${discovery.disposition}`} key={discovery.id}><div className="discovery-record-top"><span className="type-chip">{discovery.type}</span><span>{dispositionLabels[discovery.disposition]}</span></div><h3>{discovery.title}</h3><p>{discovery.summary}</p><div className="discovery-record-meta"><span>Доказательства <b>{discovery.evidenceQuality}%</b></span><span>Ценность <b>{discovery.value} кр.</b></span><span>Автор <b>{lead?.name ?? 'не назначен'}</b></span><span>Источник <b>{expedition?.name ?? 'неизвестен'}</b></span></div>{officialReport && <div className="official-report-line"><Scroll size={14} /><span><strong>{officialReport.title}</strong><small>{officialReport.claim}</small></span></div>}{discovery.consequenceIds.length > 0 && <div className="consequence-links"><ShieldAlert size={15} />Запущено последствий: {discovery.consequenceIds.length}</div>}</article>
          })}
        </div>
      )}

      {tab === 'places' && (
        <div className="archive-card-grid">
          {knownSites.map((site) => {
            const tile = state.world.tiles.find((candidate) => candidate.id === site.tileId)
            return <article className="paper-card site-record" key={site.id}><div className="discovery-record-top"><span className="type-chip">{site.type}</span><span>{site.state}</span></div><h3>{site.name}</h3><p>{site.origin}</p><div className="site-layer-list">{site.layers.map((layer) => <span key={layer}>{layer}</span>)}</div><div className="discovery-record-meta"><span>Опасность <b>{site.danger}/10</b></span><span>Глубина <b>{site.depth}</b></span><span>Клетка <b>{tile?.x}:{tile?.y}</b></span></div>{site.state === 'surveyed' || site.state === 'cleared' ? <div className="site-truth"><strong>Архивная версия</strong><p>{site.truth}</p></div> : <p className="muted">Истинная история места ещё не подтверждена.</p>}</article>
          })}
        </div>
      )}


      {tab === 'bestiary' && (
        <div className="archive-card-grid bestiary-grid">
          {bestiary.length === 0 ? <div className="empty-state paper-card"><PawPrint /><h3>Бестиарий пуст</h3><p>Наблюдай за существами или вступай с ними в бой. Слабости открываются только после накопления знаний.</p></div> : bestiary.map((entry) => {
            const species = state.world.monsterSpecies.find((candidate) => candidate.id === entry.speciesId)
            const legendary = state.world.monsterPopulations.filter((population) => population.speciesId === entry.speciesId && population.legendary)
            return <article className="paper-card bestiary-record" key={entry.speciesId}>
              <div className="discovery-record-top"><span className="type-chip">{species?.origin ?? 'unknown'}</span><span>знания {entry.knowledge}%</span></div>
              <h3>{species?.name ?? entry.speciesId}</h3>
              <p>{species?.behavior}</p>
              <div className="bestiary-meter"><span style={{ width: `${entry.knowledge}%` }} /></div>
              <div className="discovery-record-meta"><span>Встречи <b>{entry.encounters}</b></span><span>Победы <b>{entry.victories}</b></span><span>Уничтожено <b>{entry.kills}</b></span><span>Потери людей <b>{entry.deathsCaused}</b></span></div>
              <div className="bestiary-details"><p><strong>Способности:</strong> {species?.abilities.join(', ')}</p><p><strong>Трофей:</strong> {species?.trophy}</p><p><strong>Слабость:</strong> {entry.discoveredWeakness ? species?.weakness : 'недостаточно данных'}</p></div>
              {legendary.length > 0 && <div className="legendary-list"><strong>Легендарные особи</strong>{legendary.map((population) => <span key={population.id}>★ {population.legendaryName}: {population.history}</span>)}</div>}
              {entry.notes.length > 0 && <div className="bestiary-notes">{entry.notes.slice(-3).map((note, index) => <small key={index}>{note}</small>)}</div>}
            </article>
          })}
        </div>
      )}

      {tab === 'people' && (
        <div className="archive-card-grid people-archive-grid">
          {rememberedPeople.length === 0 ? <div className="empty-state paper-card"><Users /><h3>Исторических фигур пока нет</h3><p>Легенды, погибшие, пропавшие и ветераны на покое появятся здесь.</p></div> : rememberedPeople.map((character) => <article className={`paper-card remembered-person status-${character.status}`} key={character.id}><div className="discovery-record-top"><span className="type-chip">{character.careerStage}</span><span>{character.status}</span></div><h3>{character.name}</h3><p>{character.ancestry} · {character.profession} · {character.age} лет</p><div className="discovery-record-meta"><span>Экспедиции <b>{character.expeditions}</b></span><span>Открытия <b>{character.discoveries}</b></span><span>Слава <b>{character.fame}</b></span><span>Память <b>{character.memories.length}</b></span></div>{character.memories.at(-1) && <div className="person-last-memory"><strong>{character.memories.at(-1)!.title}</strong><p>{character.memories.at(-1)!.description}</p></div>}</article>)}
        </div>
      )}

      {tab === 'consequences' && (
        <div className="consequence-timeline">
          {consequences.length === 0 ? <div className="empty-state paper-card"><ShieldAlert /><h3>Мир ещё не отреагировал</h3><p>Публикация, продажа или сокрытие открытий создаст цепочки событий.</p></div> : consequences.map((consequence) => {
            const discovery = state.discoveries.find((entry) => entry.id === consequence.discoveryId)
            return <article className={`paper-card consequence-card ${consequence.status}`} key={consequence.id}><div className="consequence-status"><span>{consequence.status === 'pending' ? 'ожидается' : 'произошло'}</span><b>сила {consequence.magnitude}</b></div><h3>{consequence.title}</h3><p>{consequence.text}</p><small>Источник: {discovery?.title ?? 'неизвестное открытие'}</small></article>
          })}
        </div>
      )}
    </section>
  )
}
