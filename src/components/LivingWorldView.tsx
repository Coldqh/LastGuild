import { useMemo, useState } from 'react'
import { BookOpenCheck, Castle, Coins, Droplets, Home, Landmark, Mountain, Network, PawPrint, Route, ScrollText, ShieldAlert, Sprout, Swords, TrendingDown, TrendingUp, Users } from 'lucide-react'
import type { GameState, HistoricalMapSnapshot, WorldTile } from '../types/game'

interface Props { state: GameState }
type Tab = 'ecosystem' | 'society' | 'economy' | 'realms' | 'wars' | 'knowledge' | 'history' | 'map'

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
  { id: 'ecosystem', label: 'Экосистема', icon: Sprout },
  { id: 'society', label: 'Народы', icon: Users },
  { id: 'economy', label: 'Экономика', icon: Coins },
  { id: 'realms', label: 'Государства', icon: Castle },
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
  const [tab, setTab] = useState<Tab>('ecosystem')
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
  const ecologySpeciesMap = new Map(state.world.ecologySpecies.map((entry) => [entry.id, entry]))
  const speciesTotals = [...state.world.ecologyPopulations.reduce((map, population) => {
    map.set(population.speciesId, (map.get(population.speciesId) ?? 0) + population.amount)
    return map
  }, new Map<string, number>()).entries()]
    .map(([speciesId, amount]) => ({ species: ecologySpeciesMap.get(speciesId), amount }))
    .filter((entry) => entry.species)
    .sort((a, b) => b.amount - a.amount)
  const landTiles = state.world.tiles.filter((tile) => tile.biome !== 'ocean')
  const averageEcosystemHealth = landTiles.length ? landTiles.reduce((sum, tile) => sum + tile.ecosystemHealth, 0) / landTiles.length : 0
  const averageWater = landTiles.length ? landTiles.reduce((sum, tile) => sum + tile.waterAvailability, 0) / landTiles.length : 0
  const averageVegetation = landTiles.length ? landTiles.reduce((sum, tile) => sum + tile.vegetation, 0) / landTiles.length : 0
  const ecosystemEvents = [...state.world.ecosystem.recentEvents].sort((a, b) => b.year - a.year || b.day - a.day).slice(0, 12)
  const peopleTotals = [...state.world.peoples].sort((a, b) => b.population - a.population)
  const activeSettlements = state.world.settlements.filter((entry) => entry.status !== 'ruined')
  const societyEvents = [...state.world.society.recentEvents].sort((a, b) => b.year - a.year).slice(0, 12)
  const migrationHotspots = [...activeSettlements].sort((a, b) => b.migrationPressure - a.migrationPressure).slice(0, 8)
  const cultureMap = new Map(state.world.cultures.map((entry) => [entry.id, entry]))
  const livingRealms = state.world.realms.filter((realm) => !realm.collapsedYear)
  const contestedTiles = state.world.tiles.filter((tile) => tile.controlStatus === 'contested' || tile.controlStatus === 'occupied')
  const realmArmyMap = state.world.armies.reduce((map, army) => {
    const list = map.get(army.realmId) ?? []
    list.push(army)
    map.set(army.realmId, list)
    return map
  }, new Map<string, GameState['world']['armies']>())
  const politicalEvents = [...state.world.politics.recentEvents].sort((a, b) => b.year - a.year || b.day - a.day).slice(0, 10)
  const biomeHealth = [...landTiles.reduce((map, tile) => {
    const current = map.get(tile.biome) ?? { total: 0, count: 0 }
    current.total += tile.ecosystemHealth
    current.count += 1
    map.set(tile.biome, current)
    return map
  }, new Map<string, { total: number; count: number }>()).entries()]
    .map(([biome, value]) => ({ biome, health: value.total / value.count }))
    .sort((a, b) => b.health - a.health)

  return (
    <section className="view living-world-view compact-living-world">
      <header className="view-heading compact-page-heading">
        <div><p className="eyebrow">Регион</p><h1>Живой мир</h1></div>
        <span className="world-status-line">{livingRealms.length} государств · {state.world.armies.reduce((sum, army) => sum + army.soldiers, 0).toLocaleString('ru-RU')} солдат · {activeWars.length} войн</span>
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

      {tab === 'ecosystem' && <div className="ecosystem-view">
        <div className="ecosystem-metrics">
          <article><Sprout size={16} /><b>{Math.round(averageEcosystemHealth)}</b><span>здоровье</span></article>
          <article><PawPrint size={16} /><b>{Math.round(state.world.ecosystem.totalFauna).toLocaleString('ru-RU')}</b><span>фауна</span></article>
          <article><Droplets size={16} /><b>{Math.round(averageWater)}</b><span>вода</span></article>
          <article><Mountain size={16} /><b>{state.world.resourceDeposits.length}</b><span>ресурсы</span></article>
        </div>

        <div className="living-grid compact-living-grid ecosystem-grid">
          <article className="paper-card living-panel compact-world-panel">
            <div className="compact-panel-heading"><PawPrint size={18} /><h2>Популяции</h2><span>{speciesTotals.length}</span></div>
            <div className="ecosystem-species-list">
              {speciesTotals.slice(0, 12).map(({ species, amount }) => <div key={species!.id}>
                <span><strong>{species!.name}</strong><small>{species!.kind === 'herbivore' ? 'травоядные' : species!.kind === 'predator' ? 'хищники' : species!.kind === 'scavenger' ? 'падальщики' : 'монстры'}</small></span>
                <b>{Math.round(amount).toLocaleString('ru-RU')}</b>
              </div>)}
            </div>
          </article>

          <article className="paper-card living-panel compact-world-panel">
            <div className="compact-panel-heading"><Sprout size={18} /><h2>Среда</h2></div>
            <div className="ecosystem-biome-list">
              {biomeHealth.slice(0, 8).map((entry) => <div key={entry.biome}><span>{entry.biome}</span><b>{Math.round(entry.health)}</b></div>)}
            </div>
            <p className="ecosystem-line">Растительность {Math.round(averageVegetation)} · миграций {state.world.ecosystem.migrations} · спадов {state.world.ecosystem.collapses}</p>
          </article>

          <article className="paper-card living-panel wide-panel compact-world-panel">
            <div className="compact-panel-heading"><ScrollText size={18} /><h2>Изменения природы</h2></div>
            <div className="ecosystem-event-list">
              {ecosystemEvents.length === 0 && <p className="muted">Крупных изменений пока не зафиксировано.</p>}
              {ecosystemEvents.map((event) => <div key={event.id}><b>{event.year}</b><span><strong>{event.title}</strong><small>{event.description}</small></span><em>{Math.round(event.magnitude)}</em></div>)}
            </div>
          </article>
        </div>
      </div>}

      {tab === 'society' && <div className="society-view">
        <div className="ecosystem-metrics society-metrics">
          <article><Users size={16} /><b>{Math.round(state.world.society.totalPopulation).toLocaleString('ru-RU')}</b><span>жителей</span></article>
          <article><Home size={16} /><b>{activeSettlements.length}</b><span>поселений</span></article>
          <article><Landmark size={16} /><b>{state.world.peoples.length}</b><span>народов</span></article>
          <article><ScrollText size={16} /><b>{state.world.cultures.length}</b><span>культур</span></article>
        </div>
        <div className="living-grid compact-living-grid society-grid">
          <article className="paper-card living-panel compact-world-panel">
            <div className="compact-panel-heading"><Users size={18} /><h2>Народы</h2><span>{peopleTotals.length}</span></div>
            <div className="society-people-list">
              {peopleTotals.slice(0, 10).map((people) => { const culture = cultureMap.get(people.cultureId); return <div key={people.id}><span><strong>{people.name}</strong><small>{people.ancestry} · {culture?.name ?? 'культура неизвестна'}</small></span><b>{Math.round(people.population).toLocaleString('ru-RU')}</b><em>{people.status === 'stable' ? 'устойчив' : people.status === 'migrating' ? 'мигрирует' : people.status === 'declining' ? 'сокращается' : 'рассеян'}</em></div> })}
            </div>
          </article>
          <article className="paper-card living-panel compact-world-panel">
            <div className="compact-panel-heading"><Home size={18} /><h2>Давление миграции</h2></div>
            <div className="society-settlement-list">
              {migrationHotspots.map((settlement) => <div key={settlement.id}><span><strong>{settlement.name}</strong><small>{settlement.specialization} · {settlement.population.toLocaleString('ru-RU')}</small></span><b>{Math.round(settlement.migrationPressure)}</b></div>)}
            </div>
          </article>
          <article className="paper-card living-panel wide-panel compact-world-panel">
            <div className="compact-panel-heading"><ScrollText size={18} /><h2>Изменения общества</h2></div>
            <div className="society-event-list">
              {societyEvents.length === 0 && <p className="muted">Крупных переселений и оснований пока нет.</p>}
              {societyEvents.map((event) => <div key={event.id}><b>{event.year}</b><span><strong>{event.title}</strong><small>{event.description}</small></span><em>{Math.round(event.magnitude)}</em></div>)}
            </div>
          </article>
        </div>
      </div>}

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

      {tab === 'realms' && <div className="living-grid compact-living-grid politics-world-grid">
        <article className="paper-card living-panel wide-panel compact-world-panel">
          <div className="compact-panel-heading"><Castle size={18} /><h2>Государства</h2><span>{livingRealms.length}</span></div>
          <div className="realm-simulation-list">
            {livingRealms.sort((a, b) => (b.wealth + b.military) - (a.wealth + a.military)).map((realm) => {
              const armies = realmArmyMap.get(realm.id) ?? []
              const settlements = state.world.settlements.filter((entry) => entry.realmId === realm.id && entry.status !== 'ruined')
              const subjects = realm.subjectRealmIds?.length ?? 0
              return <div key={realm.id} className="realm-simulation-row">
                <span className="realm-color-dot" style={{ background: realm.color }} />
                <span className="realm-simulation-name"><strong>{realm.name}</strong><small>{realm.governmentType ?? realm.government} · {settlements.length} поселений</small></span>
                <span><b>{Math.round(realm.stability)}</b><small>устойчивость</small></span>
                <span><b>{Math.round(realm.legitimacy ?? 0)}</b><small>легитимность</small></span>
                <span><b>{armies.reduce((sum, army) => sum + army.soldiers, 0).toLocaleString('ru-RU')}</b><small>армия</small></span>
                <span className="realm-objective"><b>{realm.objective?.title ?? 'нет цели'}</b><small>{realm.objective?.reason ?? realm.currentIssue}{subjects ? ` · вассалы ${subjects}` : ''}</small></span>
              </div>
            })}
          </div>
        </article>
        <article className="paper-card living-panel compact-world-panel">
          <div className="compact-panel-heading"><Network size={18} /><h2>Территории</h2></div>
          <div className="politics-summary-lines">
            <span>Спорные и занятые <b>{contestedTiles.length}</b></span>
            <span>Активные претензии <b>{state.world.politics.activeClaims}</b></span>
            <span>Оккупации за историю <b>{state.world.politics.occupations}</b></span>
            <span>Распады государств <b>{state.world.politics.realmCollapses}</b></span>
          </div>
        </article>
        <article className="paper-card living-panel compact-world-panel">
          <div className="compact-panel-heading"><ScrollText size={18} /><h2>Политические изменения</h2></div>
          <div className="politics-event-list">
            {politicalEvents.length === 0 && <p className="muted">Крупных изменений границ пока нет.</p>}
            {politicalEvents.map((event) => <div key={event.id}><b>{event.year}</b><span><strong>{event.title}</strong><small>{event.description}</small></span></div>)}
          </div>
        </article>
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
            <div className="war-stats"><span>Счёт {Math.round(war.warScore ?? war.progress)}</span><span>Снабжение {Math.round(war.attackerSupply)}/{Math.round(war.defenderSupply)}</span><span>Занято {war.occupiedTileIds?.length ?? 0}</span><span>Потери {war.casualties.toLocaleString('ru-RU')}</span></div>
            <details className="compact-details"><summary>Причина, фронт и условия</summary><p>{war.cause}. Цель: {war.goal}.</p><p>Фронтовых территорий: {war.frontTileIds?.length ?? 0}. {war.peaceTerms ?? ''}</p>{war.lastEvent && <p>{war.lastEvent}</p>}</details>
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
