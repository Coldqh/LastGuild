import { BookOpenText, Boxes, Compass, Crown, LibraryBig, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GameState } from '../types/game'

interface Props { state: GameState }
type CodexTab = 'regions' | 'civilizations' | 'artifacts' | 'stories'

const statusLabels = { dormant: 'скрыта', active: 'активна', completed: 'завершена', failed: 'провалена', rumored: 'слух', lost: 'утрачен', located: 'место известно', partial: 'частично', recovered: 'в гильдии', destroyed: 'уничтожен' }
const tabs: Array<{ id: CodexTab; label: string; icon: typeof Compass }> = [
  { id: 'regions', label: 'Регионы', icon: Compass }, { id: 'civilizations', label: 'Цивилизации', icon: Crown }, { id: 'artifacts', label: 'Артефакты', icon: Sparkles }, { id: 'stories', label: 'Истории', icon: LibraryBig },
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

  return <section className="view lore-codex-view compact-lore-view">
    <header className="view-heading compact-page-heading"><div><p className="eyebrow">Архив знаний</p><h1>Энциклопедия</h1></div><span className="page-count">{activeCount}</span></header>
    <div className="codex-toolbar paper-card compact-toolbar">
      <div className="codex-tabs desktop-codex-tabs">{tabs.map((entry) => { const Icon = entry.icon; return <button key={entry.id} className={tab === entry.id ? 'active' : ''} onClick={() => setTab(entry.id)}><Icon size={14} /><span>{entry.label}</span></button> })}</div>
      <label className="mobile-tab-select codex-mobile-tab"><select value={tab} onChange={(event) => setTab(event.target.value as CodexTab)}>{tabs.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
      <label className="search-box"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" /></label>
    </div>

    {tab === 'regions' && <div className="codex-grid compact-codex-grid">{regions.map((region) => <article className="paper-card codex-card compact-codex-card" key={region.id}><div className="codex-compact-title"><span className="type-chip">регион</span><h2>{region.name}</h2><KnowledgeBar value={region.knownLevel} /></div><div className="codex-inline-meta"><span>{region.dominantBiomes.slice(0, 2).join(' · ')}</span><span>{region.cultures.join(', ')}</span><span>{region.goods.slice(0, 3).join(', ')}</span></div><details className="compact-details"><summary>Подробности</summary><p>{region.architecture}</p><p><b>Проблема:</b> {region.politicalProblem}</p><p><b>Угрозы:</b> {region.threats.join(', ')}</p><p><b>Легенды:</b> {region.legends.join('; ')}</p></details></article>)}</div>}

    {tab === 'civilizations' && <div className="codex-grid compact-codex-grid">{civilizations.map((civilization) => <article className="paper-card codex-card compact-codex-card civilization-card" key={civilization.id}><div className="codex-compact-title"><span className="type-chip">{civilization.era}</span><h2>{civilization.name}</h2><KnowledgeBar value={civilization.knownLevel} /></div><div className="codex-inline-meta"><span>{civilization.people}</span><span>{civilization.siteIds.length} мест</span><span>{civilization.legacy.slice(0, 2).join(', ')}</span></div><details className="compact-details"><summary>История</summary><p><b>Архитектура:</b> {civilization.architecture}</p><p><b>Магия:</b> {civilization.magicTradition}</p><p>{civilization.publicHistory}</p>{civilization.knownLevel >= 3 ? <div className="codex-secret"><strong>Противоречия</strong><p>{civilization.hiddenTruth}</p></div> : <div className="codex-locked"><Boxes size={14} />Причина падения не подтверждена.</div>}</details></article>)}</div>}

    {tab === 'artifacts' && <div className="codex-grid compact-codex-grid">{artifacts.map((artifact) => { const civilization = state.civilizations.find((entry) => entry.id === artifact.civilizationId); const site = state.world.sites.find((entry) => entry.id === artifact.currentSiteId); return <article className={`paper-card codex-card compact-codex-card artifact-card artifact-${artifact.status}`} key={artifact.id}><div className="codex-compact-title"><span className="type-chip">{statusLabels[artifact.status]}</span><h2>{artifact.knownLevel ? artifact.name : 'Неизвестная реликвия'}</h2><KnowledgeBar value={artifact.knownLevel} /></div><div className="codex-inline-meta"><span>части {artifact.recoveredParts}/{artifact.parts}</span><span>{artifact.knownLevel >= 2 ? site?.name ?? 'вне карты' : 'место неизвестно'}</span><span>{civilization?.name ?? 'происхождение неизвестно'}</span></div><details className="compact-details"><summary>Сведения</summary><p>{artifact.knownLevel ? artifact.publicLegend : 'Сохранился только косвенный слух.'}</p>{artifact.knownLevel >= 1 && <p><b>Создатель:</b> {artifact.creator}</p>}{artifact.knownLevel >= 2 && <p><b>Назначение:</b> {artifact.originalPurpose} · <b>сила:</b> {artifact.power}</p>}{artifact.knownLevel >= 3 && <p><b>Цена:</b> {artifact.cost}</p>}{artifact.knownLevel >= 5 && <p>{artifact.hiddenTruth}</p>}</details></article> })}</div>}

    {tab === 'stories' && <div className="story-chain-list compact-story-list">{stories.map((chain) => { const currentStage = chain.stages[chain.currentStageIndex]; const completed = chain.stages.filter((stage) => stage.status === 'completed').length; return <article className={`paper-card story-chain-card compact-story-card story-${chain.status}`} key={chain.id}><div className="codex-compact-title"><span className="type-chip">{chain.rarity}</span><h2>{chain.title}</h2><em>{completed}/{chain.stages.length}</em></div><div className="codex-inline-meta"><span>{statusLabels[chain.status]}</span>{chain.status === 'active' && currentStage && <span>сейчас: {currentStage.title}</span>}<span>{chain.kind}</span></div><details className="compact-details"><summary>История и этапы</summary><p>{chain.summary}</p>{chain.status === 'dormant' ? <div className="codex-locked"><BookOpenText size={14} />История ещё не проявилась.</div> : <div className="story-stage-track">{chain.stages.map((stage, index) => <div className={`story-stage ${stage.status}`} key={stage.id}><span>{index + 1}</span><div><strong>{stage.status === 'locked' ? 'Неизвестный этап' : stage.title}</strong>{stage.status !== 'locked' && <small>{stage.description}</small>}</div></div>)}</div>}</details></article> })}</div>}
  </section>
}
