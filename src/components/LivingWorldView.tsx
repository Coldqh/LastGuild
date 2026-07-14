import { useMemo, useState } from 'react'
import { BookOpenCheck, Castle, Coins, Landmark, Network, Route, ScrollText, ShieldAlert, Swords, TrendingDown, TrendingUp } from 'lucide-react'
import type { GameState, HistoricalMapSnapshot, WorldTile } from '../types/game'

interface Props { state: GameState }
type Tab = 'economy' | 'wars' | 'knowledge' | 'history' | 'map'

const HEX_W = 20
const HEX_H = 18
const X_STEP = 15
const Y_STEP = 18
const center = (tile: WorldTile): [number, number] => [18 + tile.x * X_STEP, 18 + tile.y * Y_STEP + (tile.x % 2 ? 9 : 0)]
const points = (cx: number, cy: number) => [[cx - 10, cy], [cx - 5, cy - 9], [cx + 5, cy - 9], [cx + 10, cy], [cx + 5, cy + 9], [cx - 5, cy + 9]].map(([x, y]) => `${x},${y}`).join(' ')

const stageLabels = {
  found: 'Найдено', verified: 'Проверено', published: 'Опубликовано', contested: 'Оспаривается', spreading: 'Распространяется', used: 'Используется',
}

const tabs: Array<{ id: Tab; label: string; icon: typeof Coins }> = [
  { id: 'economy', label: 'Экономика', icon: Coins },
  { id: 'wars', label: 'Войны', icon: Swords },
  { id: 'knowledge', label: 'Знания', icon: Network },
  { id: 'history', label: 'Хроника', icon: ScrollText },
  { id: 'map', label: 'Карта истории', icon: Landmark },
]

function MiniHistoryMap({ state, snapshot }: { state: GameState; snapshot: HistoricalMapSnapshot }) {
  const realmMap = useMemo(() => new Map(state.world.realms.map((realm) => [realm.id, realm])), [state.world.realms])
  const width = state.world.width * X_STEP + HEX_W + 40
  const height = state.world.height * Y_STEP + HEX_H + 36
  return (
    <div className="historical-map-scroll">
      <svg width={width} height={height} className="historical-map-svg" role="img" aria-label={`Карта мира на ${snapshot.year} год`}>
        {state.world.tiles.map((tile) => {
          const [cx, cy] = center(tile)
          const realmId = snapshot.realmByTile[tile.id]
          const fill = tile.biome === 'ocean' ? '#17232a' : realmId ? realmMap.get(realmId)?.color ?? '#3a3a36' : '#242521'
          return <polygon key={tile.id} points={points(cx, cy)} fill={fill} stroke="#111410" strokeWidth=".55" opacity={tile.biome === 'ocean' ? .72 : .9} />
        })}
        {state.world.settlements.map((settlement) => {
          const status = snapshot.settlementStates[settlement.id]
          if (!status || status.status === 'ruined') return null
          const tile = state.world.tiles.find((entry) => entry.id === settlement.tileId)
          if (!tile) return null
          const [cx, cy] = center(tile)
          return <circle key={settlement.id} cx={cx} cy={cy} r={settlement.kind === 'capital' ? 3.8 : 2.4} fill="#f1d495" stroke="#16100a" strokeWidth="1" />
        })}
      </svg>
    </div>
  )
}

export default function LivingWorldView({ state }: Props) {
  const [tab, setTab] = useState<Tab>('economy')
  const [snapshotId, setSnapshotId] = useState(state.historySnapshots.at(-1)?.id ?? '')
  const [showAllRoutes, setShowAllRoutes] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const snapshot = state.historySnapshots.find((entry) => entry.id === snapshotId) ?? state.historySnapshots.at(-1)
  const activeWars = state.wars.filter((war) => war.status !== 'ended')
  const activeRoutes = state.world.routes.filter((route) => route.type !== 'river' && route.status === 'active')
  const disruptedRoutes = state.world.routes.filter((route) => route.type !== 'river' && route.status !== 'active')
  const growing = [...state.world.settlements].filter((settlement) => settlement.status !== 'ruined').sort((a, b) => b.growth - a.growth).slice(0, 4)
  const declining = [...state.world.settlements].filter((settlement) => settlement.status !== 'ruined').sort((a, b) => a.growth - b.growth).slice(0, 4)
  const routes = [...state.world.routes].filter((route) => route.type !== 'river').sort((a, b) => b.income - a.income)
  const history = [...state.world.history].sort((a, b) => b.year - a.year).slice(0, showAllHistory ? 80 : 16)
  const visibleRoutes = routes.slice(0, showAllRoutes ? 30 : 8)

  return (
    <section className="view living-world-view compact-living-world">
      <header className="view-heading compact-page-heading">
        <div><p className="eyebrow">Регион</p><h1>Живой мир</h1></div>
        <span className="world-status-line">{activeWars.length} войн · {activeRoutes.length} путей · {state.knowledgeSpreads.filter((entry) => entry.stage !== 'used').length} открытий</span>
      </header>

      <label className="mobile-tab-select">
        <span>Раздел</span>
        <select value={tab} onChange={(event) => setTab(event.target.value as Tab)}>
          {tabs.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
        </select>
      </label>

      <div className="segmented-control living-tabs desktop-living-tabs">
        {tabs.map((entry) => { const Icon = entry.icon; return <button key={entry.id} className={tab === entry.id ? 'active' : ''} onClick={() => setTab(entry.id)}><Icon size={15} />{entry.label}</button> })}
      </div>

      {tab === 'economy' && <div className="living-grid compact-living-grid">
        <article className="paper-card living-panel wide-panel compact-world-panel">
          <div className="compact-panel-heading"><Route size={18} /><h2>Маршруты</h2><span>{routes.length}</span></div>
          <div className="route-economy-list compact-route-list">
            {visibleRoutes.map((route) => <div key={route.id} className={`route-economy-row compact-route-row ${route.status}`}>
              <span className="route-name"><strong>{route.name}</strong><small>{route.goods.length ? route.goods.slice(0, 3).join(' · ') : 'обычные грузы'}</small></span>
              <span className="route-stat"><b>{route.income}</b><small>доход</small></span>
              <span className="route-stat"><b>{Math.round(route.safety)}</b><small>защита</small></span>
              <em>{route.status === 'active' ? 'работает' : route.status === 'disrupted' ? 'нарушен' : 'заброшен'}</em>
            </div>)}
          </div>
          {routes.length > 8 && <button className="compact-list-toggle" onClick={() => setShowAllRoutes((value) => !value)}>{showAllRoutes ? 'Скрыть лишние' : `Показать ещё ${routes.length - 8}`}</button>}
          {disruptedRoutes.length > 0 && <p className="living-warning compact-warning"><ShieldAlert size={15} />Нарушено маршрутов: {disruptedRoutes.length}</p>}
        </article>

        <article className="paper-card living-panel compact-world-panel"><div className="compact-panel-heading"><TrendingUp size={18} /><h2>Рост</h2></div><div className="settlement-economy-list compact-settlement-list">{growing.map((settlement) => <div key={settlement.id}><span><strong>{settlement.name}</strong><small>{settlement.production.slice(0, 2).join(' · ')}</small></span><b>+{settlement.growth.toFixed(1)}</b></div>)}</div></article>
        <article className="paper-card living-panel compact-world-panel"><div className="compact-panel-heading"><TrendingDown size={18} /><h2>Упадок</h2></div><div className="settlement-economy-list compact-settlement-list">{declining.map((settlement) => <div key={settlement.id}><span><strong>{settlement.name}</strong><small>волнения {Math.round(settlement.unrest)}</small></span><b>{settlement.growth.toFixed(1)}</b></div>)}</div></article>
      </div>}

      {tab === 'wars' && <div className="living-grid compact-living-grid">
        {state.wars.length === 0 && <article className="paper-card empty-state wide-panel"><Castle size={24} /><h2>Войн нет</h2></article>}
        {state.wars.map((war) => {
          const attacker = state.world.realms.find((realm) => realm.id === war.attackerRealmId)
          const defender = state.world.realms.find((realm) => realm.id === war.defenderRealmId)
          return <article key={war.id} className={`paper-card war-card compact-war-card ${war.status}`}>
            <div className="war-card-head"><span><p className="eyebrow">{war.status === 'ended' ? 'Завершена' : war.status === 'preparing' ? 'Мобилизация' : 'Идёт война'}</p><h2>{war.name}</h2></span><Swords size={20} /></div>
            <p className="war-sides"><b>{attacker?.name}</b> → <b>{defender?.name}</b></p>
            <div className="war-progress"><span style={{ width: `${clampForUi(war.progress)}%` }} /></div>
            <div className="war-stats"><span>Снабжение {Math.round(war.attackerSupply)}/{Math.round(war.defenderSupply)}</span><span>Потери {war.casualties.toLocaleString('ru-RU')}</span></div>
            <details className="compact-details"><summary>Причина и события</summary><p>{war.cause}. Цель: {war.goal}.</p>{war.lastEvent && <p>{war.lastEvent}</p>}</details>
          </article>
        })}
      </div>}

      {tab === 'knowledge' && <div className="knowledge-spread-list compact-knowledge-list">
        {state.knowledgeSpreads.length === 0 && <article className="paper-card empty-state"><BookOpenCheck size={24} /><h2>Открытий нет</h2></article>}
        {state.knowledgeSpreads.map((spread) => {
          const discovery = state.discoveries.find((entry) => entry.id === spread.discoveryId)
          return <article key={spread.id} className="paper-card knowledge-spread-card compact-knowledge-card"><div><p className="eyebrow">{stageLabels[spread.stage]}</p><h2>{spread.title}</h2></div><div className="knowledge-spread-meta"><span>Достоверность <b>{Math.round(spread.credibility)}</b></span><span>Спорность <b>{Math.round(spread.controversy)}</b></span><span>Государства <b>{spread.knownRealmIds.length}</b></span><span>Решение <b>{discovery?.disposition ?? 'нет'}</b></span></div><div className="knowledge-progress"><span style={{ width: `${spread.progress}%` }} /></div><details className="compact-details"><summary>Последнее изменение</summary><p>{spread.lastUpdate}</p></details></article>
        })}
      </div>}

      {tab === 'history' && <div className="world-history-list compact-history-list">{history.map((event) => <article key={event.id} className="paper-card history-event-card compact-history-card"><span className="history-year">{event.year}</span><div><p className="eyebrow">{event.kind ?? event.tags[0] ?? 'событие'}</p><h2>{event.title}</h2><p>{event.description}</p>{(event.cause || event.consequence) && <details className="compact-details"><summary>Причины и последствия</summary>{event.cause && <p><b>Причина:</b> {event.cause}</p>}{event.consequence && <p><b>Последствие:</b> {event.consequence}</p>}</details>}</div></article>)}{state.world.history.length > 16 && <button className="compact-list-toggle" onClick={() => setShowAllHistory((value) => !value)}>{showAllHistory ? 'Свернуть хронику' : 'Показать старые события'}</button>}</div>}

      {tab === 'map' && snapshot && <div className="historical-map-layout">
        <article className="paper-card historical-map-card"><div className="compact-panel-heading"><Landmark size={18} /><h2>{snapshot.title}</h2></div><MiniHistoryMap state={state} snapshot={snapshot} /></article>
        <aside className="paper-card snapshot-sidebar"><h2>Годы</h2><div className="snapshot-list">{state.historySnapshots.map((entry) => <button key={entry.id} className={entry.id === snapshot.id ? 'active' : ''} onClick={() => setSnapshotId(entry.id)}><strong>{entry.year}</strong><span>{entry.title}</span></button>)}</div></aside>
      </div>}
    </section>
  )
}

function clampForUi(progress: number): number {
  return Math.max(4, Math.min(96, 50 + progress / 2))
}
