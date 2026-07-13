import { BookOpenText, Boxes, Compass, Crown, LibraryBig, Search, Sparkles, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GameState } from '../types/game'

interface Props { state: GameState }
type CodexTab = 'regions' | 'civilizations' | 'artifacts' | 'stories'

const statusLabels = {
  dormant: 'скрыта', active: 'активна', completed: 'завершена', failed: 'провалена',
  rumored: 'слух', lost: 'утрачен', located: 'место известно', partial: 'собран частично', recovered: 'в гильдии', destroyed: 'уничтожен',
}

function KnowledgeBar({ value }: { value: number }) {
  return <div className="codex-knowledge"><span style={{ width: `${Math.max(4, Math.min(100, value * 20))}%` }} /><small>изучено {value}/5</small></div>
}

export default function LoreCodexView({ state }: Props) {
  const [tab, setTab] = useState<CodexTab>('regions')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const regions = useMemo(() => state.regionalIdentities.filter((entry) => `${entry.name} ${entry.cultures.join(' ')} ${entry.goods.join(' ')}`.toLowerCase().includes(normalizedQuery)), [state.regionalIdentities, normalizedQuery])
  const civilizations = useMemo(() => state.civilizations.filter((entry) => `${entry.name} ${entry.people} ${entry.era}`.toLowerCase().includes(normalizedQuery)), [state.civilizations, normalizedQuery])
  const artifacts = useMemo(() => state.artifactsCatalog.filter((entry) => `${entry.name} ${entry.creator} ${entry.publicLegend}`.toLowerCase().includes(normalizedQuery)), [state.artifactsCatalog, normalizedQuery])
  const stories = useMemo(() => state.storyChains.filter((entry) => `${entry.title} ${entry.summary} ${entry.kind}`.toLowerCase().includes(normalizedQuery)), [state.storyChains, normalizedQuery])
  const validationErrors = state.contentValidation.filter((issue) => issue.severity === 'error').length

  return (
    <section className="view lore-codex-view">
      <header className="view-heading codex-heading">
        <div><p className="eyebrow">Знания о мире</p><h1>Энциклопедия гильдии</h1><p>Здесь собраны регионы, древние цивилизации, артефакты и многоэтапные истории. Скрытая правда открывается только экспедициями.</p></div>
        <div className={`content-health ${validationErrors ? 'danger' : ''}`}><TriangleAlert size={17} /><span>{validationErrors ? `${validationErrors} ошибок контента` : 'Связи контента проверены'}</span></div>
      </header>

      <div className="codex-summary">
        <article><Compass /><strong>{state.regionalIdentities.length}</strong><span>регионов</span></article>
        <article><Crown /><strong>{state.civilizations.length}</strong><span>цивилизаций</span></article>
        <article><Sparkles /><strong>{state.artifactsCatalog.length}</strong><span>артефактов</span></article>
        <article><BookOpenText /><strong>{state.storyChains.filter((chain) => chain.status === 'active').length}</strong><span>активных историй</span></article>
      </div>

      <div className="codex-toolbar paper-card">
        <div className="codex-tabs">
          <button className={tab === 'regions' ? 'active' : ''} onClick={() => setTab('regions')}><Compass size={16} />Регионы</button>
          <button className={tab === 'civilizations' ? 'active' : ''} onClick={() => setTab('civilizations')}><Crown size={16} />Цивилизации</button>
          <button className={tab === 'artifacts' ? 'active' : ''} onClick={() => setTab('artifacts')}><Sparkles size={16} />Артефакты</button>
          <button className={tab === 'stories' ? 'active' : ''} onClick={() => setTab('stories')}><LibraryBig size={16} />Истории</button>
        </div>
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по энциклопедии" /></label>
      </div>

      {tab === 'regions' && <div className="codex-grid">{regions.map((region) => <article className="paper-card codex-card" key={region.id}>
        <div className="codex-card-top"><span className="type-chip">регион</span><span>{region.dominantBiomes.join(' · ')}</span></div><h2>{region.name}</h2><p>{region.architecture}</p><KnowledgeBar value={region.knownLevel} />
        <div className="codex-section"><strong>Культуры</strong><p>{region.cultures.join(', ')}</p></div>
        <div className="codex-tags">{region.goods.map((good) => <span key={good}>{good}</span>)}</div>
        <details><summary>Угрозы и местные сведения</summary><p><b>Проблема:</b> {region.politicalProblem}</p><p><b>Угрозы:</b> {region.threats.join(', ')}</p><p><b>Легенды:</b> {region.legends.join('; ')}</p></details>
      </article>)}</div>}

      {tab === 'civilizations' && <div className="codex-grid">{civilizations.map((civilization) => <article className="paper-card codex-card civilization-card" key={civilization.id}>
        <div className="codex-card-top"><span className="type-chip">{civilization.era}</span><span>{civilization.siteIds.length} мест</span></div><h2>{civilization.name}</h2><p>{civilization.people}</p><KnowledgeBar value={civilization.knownLevel} />
        <div className="codex-two-column"><div><strong>Архитектура</strong><p>{civilization.architecture}</p></div><div><strong>Магия</strong><p>{civilization.magicTradition}</p></div></div>
        <div className="codex-section"><strong>Известная история</strong><p>{civilization.publicHistory}</p></div>
        {civilization.knownLevel >= 3 ? <div className="codex-secret"><strong>Подтверждённые противоречия</strong><p>{civilization.hiddenTruth}</p></div> : <div className="codex-locked"><Boxes size={16} />Истинная причина падения ещё не подтверждена.</div>}
        <details><summary>Расцвет, падение и наследие</summary><p><b>Расцвет:</b> {civilization.riseCause}</p><p><b>Падение:</b> {civilization.fallCause}</p><p><b>Наследие:</b> {civilization.legacy.join(', ')}</p></details>
      </article>)}</div>}

      {tab === 'artifacts' && <div className="codex-grid">{artifacts.map((artifact) => {
        const civilization = state.civilizations.find((entry) => entry.id === artifact.civilizationId)
        const site = state.world.sites.find((entry) => entry.id === artifact.currentSiteId)
        return <article className={`paper-card codex-card artifact-card artifact-${artifact.status}`} key={artifact.id}>
          <div className="codex-card-top"><span className="type-chip">{statusLabels[artifact.status]}</span><span>{artifact.recoveredParts}/{artifact.parts} частей</span></div><h2>{artifact.knownLevel ? artifact.name : 'Неизвестная реликвия'}</h2><p>{artifact.knownLevel ? artifact.publicLegend : 'В архиве есть только косвенный слух о предмете.'}</p><KnowledgeBar value={artifact.knownLevel} />
          {artifact.knownLevel >= 1 && <div className="codex-section"><strong>Происхождение</strong><p>{civilization?.name ?? 'не установлено'} · {artifact.creator}</p></div>}
          {artifact.knownLevel >= 2 && <div className="codex-two-column"><div><strong>Назначение</strong><p>{artifact.originalPurpose}</p></div><div><strong>Предполагаемая сила</strong><p>{artifact.power}</p></div></div>}
          {artifact.knownLevel >= 3 && <div className="codex-secret"><strong>Цена использования</strong><p>{artifact.cost}</p></div>}
          <div className="artifact-location"><span>Последнее место</span><b>{artifact.knownLevel >= 2 ? site?.name ?? 'вне известной карты' : 'неизвестно'}</b></div>
          {artifact.knownLevel >= 5 && <details open><summary>Истинная история</summary><p>{artifact.hiddenTruth}</p></details>}
        </article>
      })}</div>}

      {tab === 'stories' && <div className="story-chain-list">{stories.map((chain) => {
        const currentStage = chain.stages[chain.currentStageIndex]
        const completed = chain.stages.filter((stage) => stage.status === 'completed').length
        return <article className={`paper-card story-chain-card story-${chain.status}`} key={chain.id}>
          <div className="story-chain-header"><div><div className="codex-card-top"><span className="type-chip">{chain.rarity}</span><span>{statusLabels[chain.status]}</span></div><h2>{chain.title}</h2><p>{chain.summary}</p></div><div className="story-progress-ring"><strong>{completed}/{chain.stages.length}</strong><span>этапов</span></div></div>
          {chain.status === 'dormant' ? <div className="codex-locked"><LibraryBig size={17} />Эта история ещё не проявилась в текущей кампании.</div> : <div className="story-stage-track">{chain.stages.map((stage, index) => <div className={`story-stage ${stage.status}`} key={stage.id}><span>{index + 1}</span><div><strong>{stage.status === 'locked' ? 'Неизвестный этап' : stage.title}</strong>{stage.status !== 'locked' && <small>{stage.description}</small>}</div></div>)}</div>}
          {chain.status === 'active' && currentStage && <div className="current-story-stage"><span>Текущая зацепка</span><strong>{currentStage.title}</strong><p>{currentStage.description}</p></div>}
          {chain.status === 'completed' && <div className="codex-secret"><strong>История завершена</strong><p>Архивный итог: {chain.endingId ?? 'решение не зафиксировано'}.</p></div>}
        </article>
      })}</div>}
    </section>
  )
}
