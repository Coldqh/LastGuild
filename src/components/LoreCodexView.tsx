import { BookOpenText, Boxes, Compass, Crown, LibraryBig, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GameState } from '../types/game'

interface Props { state: GameState }
type CodexTab = 'regions' | 'civilizations' | 'artifacts' | 'stories'

const statusLabels = {
  dormant: 'скрыта', active: 'активна', completed: 'завершена', failed: 'провалена',
  rumored: 'слух', lost: 'утрачен', located: 'место известно', partial: 'собран частично', recovered: 'в гильдии', destroyed: 'уничтожен',
}

const tabs: Array<{ id: CodexTab; label: string; icon: typeof Compass }> = [
  { id: 'regions', label: 'Регионы', icon: Compass },
  { id: 'civilizations', label: 'Цивилизации', icon: Crown },
  { id: 'artifacts', label: 'Артефакты', icon: Sparkles },
  { id: 'stories', label: 'Истории', icon: LibraryBig },
]

function KnowledgeBar({ value }: { value: number }) {
  return <div className="codex-knowledge"><span style={{ width: `${Math.max(4, Math.min(100, value * 20))}%` }} /><small>{value}/5</small></div>
}

export default function LoreCodexView({ state }: Props) {
  const [tab, setTab] = useState<CodexTab>('regions')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const regions = useMemo(() => state.regionalIdentities.filter((entry) => `${entry.name} ${entry.cultures.join(' ')} ${entry.goods.join(' ')}`.toLowerCase().includes(normalizedQuery)), [state.regionalIdentities, normalizedQuery])
  const civilizations = useMemo(() => state.civilizations.filter((entry) => `${entry.name} ${entry.people} ${entry.era}`.toLowerCase().includes(normalizedQuery)), [state.civilizations, normalizedQuery])
  const artifacts = useMemo(() => state.artifactsCatalog.filter((entry) => `${entry.name} ${entry.creator} ${entry.publicLegend}`.toLowerCase().includes(normalizedQuery)), [state.artifactsCatalog, normalizedQuery])
  const stories = useMemo(() => state.storyChains.filter((entry) => `${entry.title} ${entry.summary} ${entry.kind}`.toLowerCase().includes(normalizedQuery)), [state.storyChains, normalizedQuery])
  const activeCount = tab === 'regions' ? regions.length : tab === 'civilizations' ? civilizations.length : tab === 'artifacts' ? artifacts.length : stories.length

  return (
    <section className="view lore-codex-view">
      <header className="view-heading compact-page-heading">
        <div><p className="eyebrow">Архив знаний</p><h1>Энциклопедия</h1></div>
        <span className="page-count">{activeCount}</span>
      </header>

      <div className="codex-toolbar paper-card compact-toolbar">
        <div className="codex-tabs">
          {tabs.map((entry) => {
            const Icon = entry.icon
            return <button key={entry.id} className={tab === entry.id ? 'active' : ''} onClick={() => setTab(entry.id)}><Icon size={15} /><span>{entry.label}</span></button>
          })}
        </div>
        <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" /></label>
      </div>

      {tab === 'regions' && <div className="codex-grid compact-codex-grid">{regions.map((region) => <article className="paper-card codex-card compact-codex-card" key={region.id}>
        <div className="codex-card-top"><span className="type-chip">регион</span><span>{region.dominantBiomes.join(' · ')}</span></div>
        <div className="codex-card-heading"><h2>{region.name}</h2><KnowledgeBar value={region.knownLevel} /></div>
        <p className="codex-primary-line">{region.cultures.join(', ')}</p>
        <div className="codex-tags">{region.goods.slice(0, 4).map((good) => <span key={good}>{good}</span>)}</div>
        <details className="compact-details"><summary>Подробнее</summary><p>{region.architecture}</p><p><b>Проблема:</b> {region.politicalProblem}</p><p><b>Угрозы:</b> {region.threats.join(', ')}</p><p><b>Легенды:</b> {region.legends.join('; ')}</p></details>
      </article>)}</div>}

      {tab === 'civilizations' && <div className="codex-grid compact-codex-grid">{civilizations.map((civilization) => <article className="paper-card codex-card compact-codex-card civilization-card" key={civilization.id}>
        <div className="codex-card-top"><span className="type-chip">{civilization.era}</span><span>{civilization.siteIds.length} мест</span></div>
        <div className="codex-card-heading"><h2>{civilization.name}</h2><KnowledgeBar value={civilization.knownLevel} /></div>
        <p className="codex-primary-line">{civilization.people}</p>
        <details className="compact-details"><summary>История и наследие</summary><p><b>Архитектура:</b> {civilization.architecture}</p><p><b>Магия:</b> {civilization.magicTradition}</p><p>{civilization.publicHistory}</p>{civilization.knownLevel >= 3 ? <div className="codex-secret"><strong>Противоречия</strong><p>{civilization.hiddenTruth}</p></div> : <div className="codex-locked"><Boxes size={15} />Истинная причина падения не подтверждена.</div>}<p><b>Наследие:</b> {civilization.legacy.join(', ')}</p></details>
      </article>)}</div>}

      {tab === 'artifacts' && <div className="codex-grid compact-codex-grid">{artifacts.map((artifact) => {
        const civilization = state.civilizations.find((entry) => entry.id === artifact.civilizationId)
        const site = state.world.sites.find((entry) => entry.id === artifact.currentSiteId)
        return <article className={`paper-card codex-card compact-codex-card artifact-card artifact-${artifact.status}`} key={artifact.id}>
          <div className="codex-card-top"><span className="type-chip">{statusLabels[artifact.status]}</span><span>{artifact.recoveredParts}/{artifact.parts}</span></div>
          <div className="codex-card-heading"><h2>{artifact.knownLevel ? artifact.name : 'Неизвестная реликвия'}</h2><KnowledgeBar value={artifact.knownLevel} /></div>
          <p className="codex-primary-line">{artifact.knownLevel ? artifact.publicLegend : 'Сохранился только косвенный слух.'}</p>
          <div className="artifact-location"><span>Место</span><b>{artifact.knownLevel >= 2 ? site?.name ?? 'вне карты' : 'неизвестно'}</b></div>
          <details className="compact-details"><summary>Сведения</summary>{artifact.knownLevel >= 1 && <p><b>Происхождение:</b> {civilization?.name ?? 'не установлено'} · {artifact.creator}</p>}{artifact.knownLevel >= 2 && <><p><b>Назначение:</b> {artifact.originalPurpose}</p><p><b>Сила:</b> {artifact.power}</p></>}{artifact.knownLevel >= 3 && <p><b>Цена:</b> {artifact.cost}</p>}{artifact.knownLevel >= 5 && <p>{artifact.hiddenTruth}</p>}</details>
        </article>
      })}</div>}

      {tab === 'stories' && <div className="story-chain-list compact-story-list">{stories.map((chain) => {
        const currentStage = chain.stages[chain.currentStageIndex]
        const completed = chain.stages.filter((stage) => stage.status === 'completed').length
        return <article className={`paper-card story-chain-card compact-story-card story-${chain.status}`} key={chain.id}>
          <div className="story-chain-header"><div><div className="codex-card-top"><span className="type-chip">{chain.rarity}</span><span>{statusLabels[chain.status]}</span></div><h2>{chain.title}</h2></div><div className="story-progress-ring"><strong>{completed}/{chain.stages.length}</strong></div></div>
          <p className="codex-primary-line">{chain.summary}</p>
          {chain.status === 'active' && currentStage && <div className="current-story-stage"><span>Текущая зацепка</span><strong>{currentStage.title}</strong></div>}
          <details className="compact-details"><summary>Этапы</summary>{chain.status === 'dormant' ? <div className="codex-locked"><BookOpenText size={15} />История ещё не проявилась.</div> : <div className="story-stage-track">{chain.stages.map((stage, index) => <div className={`story-stage ${stage.status}`} key={stage.id}><span>{index + 1}</span><div><strong>{stage.status === 'locked' ? 'Неизвестный этап' : stage.title}</strong>{stage.status !== 'locked' && <small>{stage.description}</small>}</div></div>)}</div>}</details>
        </article>
      })}</div>}
    </section>
  )
}
