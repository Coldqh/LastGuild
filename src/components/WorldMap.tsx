import { useEffect, useMemo, useRef, useState } from 'react'
import { Castle, ChevronDown, ChevronUp, Compass, Droplets, Flag, MapPin, Minus, Plus, Route, Skull, Sparkles, Sprout, TentTree, Waves, X } from 'lucide-react'
import { BIOME_COLORS, BIOME_LABELS } from '../data/content'
import type { GameState, WorldTile } from '../types/game'

interface Props { state: GameState }

const HEX_W = 28
const HEX_H = 24
const X_STEP = 21
const Y_STEP = 24

function colorFromId(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  return `hsl(${hash % 360} 42% 38%)`
}

function center(hex: WorldTile): [number, number] {
  return [20 + hex.x * X_STEP, 22 + hex.y * Y_STEP + (hex.x % 2 ? 12 : 0)]
}

function points(cx: number, cy: number): string {
  return [[cx - 14, cy], [cx - 7, cy - 12], [cx + 7, cy - 12], [cx + 14, cy], [cx + 7, cy + 12], [cx - 7, cy + 12]].map(([x, y]) => `${x},${y}`).join(' ')
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches
}

export default function WorldMap({ state }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [layer, setLayer] = useState<'geography' | 'ecosystem' | 'population' | 'culture' | 'politics' | 'danger' | 'knowledge' | 'history'>('geography')
  const [zoom, setZoom] = useState(() => isMobileViewport() ? 1.65 : 1)
  const [detailExpanded, setDetailExpanded] = useState(() => !isMobileViewport())
  const mapScrollRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef(false)
  const zoomRef = useRef(zoom)
  const pinchRef = useRef<{ distance: number; startZoom: number; contentX: number; contentY: number } | null>(null)
  const suppressClickRef = useRef(false)

  const tile = state.world.tiles.find((candidate) => candidate.id === selectedId)
  const tileMap = useMemo(() => new Map(state.world.tiles.map((entry) => [entry.id, entry])), [state.world.tiles])
  const realmMap = useMemo(() => new Map(state.world.realms.map((realm) => [realm.id, realm])), [state.world.realms])
  const peopleMap = useMemo(() => new Map(state.world.peoples.map((people) => [people.id, people])), [state.world.peoples])
  const cultureMap = useMemo(() => new Map(state.world.cultures.map((culture) => [culture.id, culture])), [state.world.cultures])
  const settlementMap = useMemo(() => new Map(state.world.settlements.map((settlement) => [settlement.id, settlement])), [state.world.settlements])
  const siteMap = useMemo(() => new Map(state.world.sites.map((site) => [site.id, site])), [state.world.sites])
  const populationMap = useMemo(() => new Map(state.world.monsterPopulations.map((population) => [population.id, population])), [state.world.monsterPopulations])
  const speciesMap = useMemo(() => new Map(state.world.monsterSpecies.map((species) => [species.id, species])), [state.world.monsterSpecies])
  const depositsByTile = useMemo(() => state.world.resourceDeposits.reduce((map, deposit) => { const list = map.get(deposit.tileId) ?? []; list.push(deposit); map.set(deposit.tileId, list); return map }, new Map<string, GameState['world']['resourceDeposits']>()), [state.world.resourceDeposits])
  const initialFocusTile = useMemo(() => state.world.tiles.find((entry) => entry.settlementId && entry.knowledge > 0) ?? state.world.tiles.find((entry) => entry.knowledge > 0), [state.world.tiles])

  useEffect(() => {
    if (centeredRef.current || !initialFocusTile || !mapScrollRef.current) return
    centeredRef.current = true
    const node = mapScrollRef.current
    const [cx, cy] = center(initialFocusTile)
    requestAnimationFrame(() => {
      node.scrollLeft = Math.max(0, cx * zoom - node.clientWidth * .46)
      node.scrollTop = Math.max(0, cy * zoom - node.clientHeight * .46)
    })
  }, [initialFocusTile, zoom])

  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    const node = mapScrollRef.current
    if (!node) return
    const touchDistance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
    const touchMidpoint = (touches: TouchList) => {
      const rect = node.getBoundingClientRect()
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
        y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
      }
    }
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return
      const midpoint = touchMidpoint(event.touches)
      pinchRef.current = {
        distance: Math.max(1, touchDistance(event.touches)),
        startZoom: zoomRef.current,
        contentX: (node.scrollLeft + midpoint.x) / zoomRef.current,
        contentY: (node.scrollTop + midpoint.y) / zoomRef.current,
      }
      suppressClickRef.current = true
      event.preventDefault()
    }
    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current
      if (!pinch || event.touches.length !== 2) return
      const midpoint = touchMidpoint(event.touches)
      const nextZoom = Math.min(3.2, Math.max(.72, pinch.startZoom * touchDistance(event.touches) / pinch.distance))
      zoomRef.current = nextZoom
      setZoom(Number(nextZoom.toFixed(3)))
      requestAnimationFrame(() => {
        node.scrollLeft = Math.max(0, pinch.contentX * nextZoom - midpoint.x)
        node.scrollTop = Math.max(0, pinch.contentY * nextZoom - midpoint.y)
      })
      event.preventDefault()
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) return
      pinchRef.current = null
      window.setTimeout(() => { suppressClickRef.current = false }, 120)
    }
    node.addEventListener('touchstart', onTouchStart, { passive: false })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('touchend', onTouchEnd, { passive: true })
    node.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchmove', onTouchMove)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  const fillFor = (hex: WorldTile): string => {
    if (hex.knowledge === 0) return '#100f0c'
    if (layer === 'ecosystem') return `hsl(${Math.round(18 + hex.ecosystemHealth * 1.05)} 42% ${Math.round(18 + hex.ecosystemHealth * 0.28)}%)`
    if (layer === 'population') {
      const density = Math.max(0, hex.populationDensity ?? 0)
      const light = Math.max(18, Math.min(62, 18 + Math.log10(density + 1) * 15))
      return `hsl(34 68% ${light}%)`
    }
    if (layer === 'culture') return hex.dominantCultureId ? colorFromId(hex.dominantCultureId) : '#242521'
    if (layer === 'politics') return realmMap.get(hex.stateId ?? '')?.color ?? '#2c2922'
    if (layer === 'danger') return `hsl(${Math.max(0, 115 - hex.danger * 13)} 42% ${Math.max(17, 52 - hex.danger * 3.2)}%)`
    if (layer === 'knowledge') return ['#100f0c', '#292820', '#46493a', '#687050', '#8d945e', '#b6ad75'][hex.knowledge]
    if (layer === 'history') {
      const site = hex.siteId ? siteMap.get(hex.siteId) : undefined
      if (!site) return '#363127'
      const light = Math.max(22, 62 - Math.min(2200, site.age) / 48)
      return `hsl(31 48% ${light}%)`
    }
    return BIOME_COLORS[hex.biome]
  }

  const mapWidth = state.world.width * X_STEP + HEX_W + 70
  const mapHeight = state.world.height * Y_STEP + HEX_H + 52
  const expeditionPositions = state.expeditions
    .filter((expedition) => expedition.status === 'active' || expedition.status === 'returning')
    .map((expedition) => ({ expedition, tileId: expedition.route[expedition.routeIndex] }))
  const rivalPositions = state.rivalExpeditions
    .filter((expedition) => expedition.status === 'preparing' || expedition.status === 'traveling')
    .map((expedition) => ({ expedition, tileId: expedition.targetTileId }))

  const selectedSettlement = tile?.settlementId ? settlementMap.get(tile.settlementId) : undefined
  const selectedSite = tile?.siteId ? siteMap.get(tile.siteId) : undefined
  const selectedPopulation = tile?.monsterPopulationId ? populationMap.get(tile.monsterPopulationId) : undefined
  const selectedSpecies = selectedPopulation ? speciesMap.get(selectedPopulation.speciesId) : undefined
  const selectedRealm = tile?.stateId ? realmMap.get(tile.stateId) : undefined
  const selectedPeople = tile?.dominantPeopleId ? peopleMap.get(tile.dominantPeopleId) : undefined
  const selectedCulture = tile?.dominantCultureId ? cultureMap.get(tile.dominantCultureId) : undefined
  const localRoutes = tile ? state.world.routes.filter((route) => route.tileIds.includes(tile.id)) : []
  const localDeposits = tile ? depositsByTile.get(tile.id) ?? [] : []
  const selectedTitle = tile?.knowledge === 0 ? 'Неизвестная земля' : selectedSettlement?.name ?? selectedSite?.name ?? (tile ? BIOME_LABELS[tile.biome] : '')

  const selectTile = (id: string) => {
    if (suppressClickRef.current) return
    setSelectedId(id)
    setDetailExpanded(!isMobileViewport())
  }

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.min(3.2, Math.max(.72, Number((current + delta).toFixed(2)))))
  }

  return (
    <section className="view world-view mobile-map-screen">
      <header className="view-heading map-heading">
        <div>
          <p className="eyebrow">Карта · {state.world.width}×{state.world.height}</p>
          <h1>Неизвестные земли</h1>
          <p>{state.world.realms.length} государств · {state.world.settlements.length} поселений · {state.world.sites.length} древних мест</p>
        </div>
        <div className="map-toolbar">
          <div className="segmented-control map-layers">
            <button className={layer === 'geography' ? 'active' : ''} onClick={() => setLayer('geography')}>Рельеф</button>
            <button className={layer === 'ecosystem' ? 'active' : ''} onClick={() => setLayer('ecosystem')}>Экология</button>
            <button className={layer === 'population' ? 'active' : ''} onClick={() => setLayer('population')}>Население</button>
            <button className={layer === 'culture' ? 'active' : ''} onClick={() => setLayer('culture')}>Культуры</button>
            <button className={layer === 'politics' ? 'active' : ''} onClick={() => setLayer('politics')}>Границы</button>
            <button className={layer === 'danger' ? 'active' : ''} onClick={() => setLayer('danger')}>Опасность</button>
            <button className={layer === 'knowledge' ? 'active' : ''} onClick={() => setLayer('knowledge')}>Знания</button>
            <button className={layer === 'history' ? 'active' : ''} onClick={() => setLayer('history')}>Древность</button>
          </div>
          <div className="map-zoom-controls" aria-label="Масштаб карты">
            <button onClick={() => changeZoom(-.2)} aria-label="Уменьшить"><Minus size={16} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => changeZoom(.2)} aria-label="Увеличить"><Plus size={16} /></button>
          </div>
        </div>
      </header>

      <div className="map-layout">
        <div className="map-stage">
          <div className="map-scroll parchment-panel pinch-zoom-map" ref={mapScrollRef}>
            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} width={mapWidth * zoom} height={mapHeight * zoom} className="hex-map" role="img" aria-label="Процедурная карта мира">
              {state.world.tiles.map((hex) => {
                const [cx, cy] = center(hex)
                const realm = realmMap.get(hex.stateId ?? '')
                const isSelected = hex.id === selectedId
                return (
                  <g key={hex.id} onClick={() => selectTile(hex.id)} className="hex-cell">
                    <polygon points={points(cx, cy)} fill={fillFor(hex)} stroke={isSelected ? '#f0cf7d' : hex.knowledge > 0 && layer !== 'politics' ? realm?.color ?? '#15130f' : '#15130f'} strokeWidth={isSelected ? 2.2 : 0.55} opacity={hex.knowledge === 1 ? 0.68 : 1} />
                  </g>
                )
              })}

              {state.world.routes.filter((route) => route.type === 'river').map((route) => {
                const visible = route.tileIds.map((id) => tileMap.get(id)).filter((entry): entry is WorldTile => Boolean(entry && entry.knowledge > 0))
                if (visible.length < 2) return null
                return <polyline key={route.id} points={visible.map((entry) => center(entry).join(',')).join(' ')} fill="none" stroke="#5c91a7" strokeWidth="2.2" opacity=".72" strokeLinecap="round" strokeLinejoin="round" />
              })}
              {state.world.routes.filter((route) => route.type !== 'river').map((route) => {
                const visible = route.tileIds.map((id) => tileMap.get(id)).filter((entry): entry is WorldTile => Boolean(entry && entry.knowledge > 0))
                if (visible.length < 2) return null
                return <polyline key={route.id} points={visible.map((entry) => center(entry).join(',')).join(' ')} fill="none" stroke={route.status === 'abandoned' ? '#5e5550' : route.status === 'disrupted' ? '#b66f49' : route.type === 'trade' ? '#d1ad65' : '#806f55'} strokeWidth={route.type === 'trade' ? 2 : 1.2} opacity={route.status === 'abandoned' ? .35 : route.status === 'disrupted' ? .58 : .7} strokeDasharray={route.status !== 'active' ? '4 4' : route.type === 'road' ? '4 3' : undefined} strokeLinecap="round" />
              })}

              {state.world.tiles.map((hex) => {
                if (hex.knowledge === 0) return null
                const [cx, cy] = center(hex)
                const settlement = hex.settlementId ? settlementMap.get(hex.settlementId) : undefined
                return <g key={`marker-${hex.id}`} pointerEvents="none">
                  {settlement && <circle cx={cx} cy={cy} r={settlement.kind === 'capital' ? 4.5 : settlement.kind === 'city' ? 3.7 : 2.8} fill="#e3c88d" stroke="#1a130b" strokeWidth="1.2" />}
                  {hex.knowledge >= 2 && hex.siteId && <path d={`M ${cx - 3} ${cy + 4} L ${cx} ${cy - 4} L ${cx + 3} ${cy + 4} Z`} fill="#a85041" stroke="#1a130b" strokeWidth="1" />}
                  {hex.knowledge >= 2 && hex.monsterPopulationId && <circle cx={cx + 6} cy={cy - 6} r="2" fill="#d4664f" />}
                  {settlement && hex.knowledge >= 3 && ['capital', 'city', 'town'].includes(settlement.kind) && <text x={cx + 6} y={cy - 5} className="map-label">{settlement.name}</text>}
                </g>
              })}

              {expeditionPositions.map(({ expedition, tileId }) => {
                const current = tileMap.get(tileId)
                if (!current) return null
                const [cx, cy] = center(current)
                return <g key={expedition.id} className="expedition-marker"><circle cx={cx} cy={cy} r="7" fill="#d5ae55" stroke="#241708" strokeWidth="2" /><circle cx={cx} cy={cy} r="2.6" fill="#241708" /></g>
              })}
              {rivalPositions.map(({ expedition, tileId }) => {
                const current = tileMap.get(tileId)
                if (!current || current.knowledge === 0 || expedition.secrecy > 82) return null
                const [cx, cy] = center(current)
                return <g key={expedition.id} className="rival-expedition-marker"><path d={`M ${cx} ${cy - 8} L ${cx + 7} ${cy + 6} L ${cx - 7} ${cy + 6} Z`} fill="#b65c57" stroke="#120c0b" strokeWidth="1.5" /><circle cx={cx} cy={cy + 1} r="1.8" fill="#f1d7d3" /></g>
              })}
            </svg>
          </div>
          <div className="map-legend">
            <span><i className="legend-road" />дорога</span><span><i className="legend-trade" />торговый путь</span><span><i className="legend-river" />река</span><span><i className="legend-settlement" />поселение</span><span><i className="legend-site" />руины</span><span><i className="legend-rival" />чужая экспедиция</span>
          </div>
        </div>

        <aside className={`map-sidebar paper-card ${tile ? 'has-selection' : ''} ${detailExpanded ? 'expanded' : 'collapsed'}`}>
          {tile ? (
            <>
              <div className="map-sheet-handle" />
              <button className="icon-button close-detail" onClick={() => setSelectedId(null)} aria-label="Закрыть"><X size={18} /></button>
              <div className="map-detail-heading">
                <div><p className="eyebrow">Клетка {tile.x}:{tile.y}</p><h2>{selectedTitle}</h2></div>
                {tile.knowledge > 0 && <div className="map-quick-stats"><span><Compass size={14} />{BIOME_LABELS[tile.biome]}</span><span><Skull size={14} />{tile.danger.toFixed(1)}</span><span><MapPin size={14} />{tile.knowledge}/5</span></div>}
              </div>

              {tile.knowledge === 0 ? <p className="map-unknown-copy">Нет достоверных сведений. Нужна картографическая экспедиция.</p> : (
                <>
                  <div className="map-primary-summary">
                    {selectedSettlement && <span><Flag size={15} />{selectedSettlement.kind === 'capital' ? 'Столица' : selectedSettlement.kind === 'town' ? 'Город' : 'Поселение'} · {selectedSettlement.population.toLocaleString('ru-RU')}</span>}
                    {selectedSite && <span><Sparkles size={15} />{selectedSite.type} · исследовано {selectedSite.exploration}%</span>}
                    {selectedSpecies && <span><Skull size={15} />{selectedSpecies.name} · около {selectedPopulation?.size}</span>}
                    {!selectedSettlement && !selectedSite && !selectedSpecies && <span><Compass size={15} />Проходимость {tile.travelCost.toFixed(1)} · магия {Math.round(tile.magic * 100)}%</span>}
                  </div>

                  <button className="map-detail-toggle" onClick={() => setDetailExpanded((value) => !value)}>{detailExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{detailExpanded ? 'Свернуть' : 'Подробнее'}</button>

                  {detailExpanded && <div className="detail-stack map-detail-more">
                    <div className="map-detail-grid">
                      <div className="detail-row"><Compass size={15} /><span>{BIOME_LABELS[tile.biome]}, проходимость {tile.travelCost.toFixed(1)}</span></div>
                      <div className="detail-row"><Skull size={15} /><span>Опасность {tile.danger.toFixed(1)}/10</span></div>
                      <div className="detail-row"><Sparkles size={15} /><span>Магический фон {Math.round(tile.magic * 100)}%</span></div>
                      <div className="detail-row"><Sprout size={15} /><span>Экосистема {Math.round(tile.ecosystemHealth)} · растительность {Math.round(tile.vegetation)}</span></div>
                      <div className="detail-row"><Droplets size={15} /><span>Вода {Math.round(tile.waterAvailability)} · почва {Math.round(tile.soilFertility)}</span></div>
                      <div className="detail-row"><MapPin size={15} /><span>Изученность {tile.knowledge}/5</span></div>
                    </div>
                    {tile.hasRiver && <div className="detail-row"><Waves size={15} /><span>Через район проходит река</span></div>}
                    {tile.knowledge >= 3 && localDeposits.length > 0 && <div className="detail-row"><Sprout size={15} /><span>Ресурсы: {localDeposits.slice(0, 4).map((entry) => `${entry.kind} ${Math.round(entry.abundance)}`).join(' · ')}</span></div>}
                    {localRoutes.filter((entry) => entry.type !== 'river').map((entry) => <div className="detail-row" key={entry.id}><Route size={15} /><span>{entry.name} · {entry.status === 'active' ? `${entry.income} дохода` : entry.status === 'disrupted' ? 'движение нарушено' : 'заброшен'}</span></div>)}
                    {selectedRealm && <div className="detail-block realm-detail" style={{ borderColor: selectedRealm.color }}><h3><Castle size={16} /> {selectedRealm.name}</h3><p>{selectedRealm.government}; правитель — {selectedRealm.ruler}.</p><p>Культура: {selectedRealm.culture}. Вера: {selectedRealm.dominantFaith}.</p><p className="danger-text">{selectedRealm.currentIssue}</p></div>}
                    {(selectedPeople || selectedCulture) && <div className="detail-block"><h3><Flag size={16} /> Население</h3><p>{selectedPeople?.name ?? 'Смешанное население'} · {selectedPeople?.ancestry ?? 'разные народы'}.</p>{selectedCulture && <p>{selectedCulture.name}: {selectedCulture.subsistence}. {selectedCulture.architecture}.</p>}{tile.populationDensity !== undefined && <p>Плотность {Math.round(tile.populationDensity)} · миграционное давление {Math.round(tile.migrationPressure ?? 0)}.</p>}</div>}
                    {selectedSettlement && <div className="detail-block"><h3><Flag size={16} /> {selectedSettlement.name}</h3><p>Благополучие {Math.round(selectedSettlement.prosperity)}/100 · безопасность {Math.round(selectedSettlement.safety)}/100</p><p>Рост {selectedSettlement.growth.toFixed(1)} · волнения {Math.round(selectedSettlement.unrest)} · продовольствие {Math.round(selectedSettlement.foodSecurity)}</p><p>Производит: {selectedSettlement.production.join(', ')}. Нуждается: {selectedSettlement.demand.join(', ')}.</p></div>}
                    {selectedSite && tile.knowledge >= 2 && <div className="detail-block danger-block"><h3>{selectedSite.type}</h3><p>{selectedSite.origin}. Возраст около {selectedSite.age} лет.</p><p>Глубина {selectedSite.depth}, опасность {selectedSite.danger}/10.</p><div className="zone-mini-list">{selectedSite.zones.slice(0, 5).map((zone) => <span key={zone.id}>{zone.explored ? '✓' : '○'} {zone.name}</span>)}</div></div>}
                    {selectedPopulation && selectedSpecies && tile.knowledge >= 2 && <div className="detail-block monster-block"><h3>{selectedSpecies.name}</h3><p>{selectedSpecies.behavior}. Численность около {selectedPopulation.size}.</p>{selectedPopulation.legendary && <p className="legendary-warning">★ {selectedPopulation.legendaryName}: {selectedPopulation.history}</p>}<p>Слабость: {selectedSpecies.weakness}.</p></div>}
                  </div>}
                </>
              )}
            </>
          ) : <div className="empty-detail"><TentTree size={30} /><h2>Выбери клетку</h2><p>Коснись гекса, чтобы открыть краткую сводку.</p></div>}
        </aside>
      </div>
    </section>
  )
}
