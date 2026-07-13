import { useMemo, useState } from 'react'
import { Castle, Compass, Flag, MapPin, Route, Skull, Sparkles, TentTree, Waves, X } from 'lucide-react'
import { BIOME_COLORS, BIOME_LABELS } from '../data/content'
import type { GameState, WorldTile } from '../types/game'

interface Props { state: GameState }

const HEX_W = 28
const HEX_H = 24
const X_STEP = 21
const Y_STEP = 24

function center(hex: WorldTile): [number, number] {
  return [20 + hex.x * X_STEP, 22 + hex.y * Y_STEP + (hex.x % 2 ? 12 : 0)]
}

function points(cx: number, cy: number): string {
  return [[cx - 14, cy], [cx - 7, cy - 12], [cx + 7, cy - 12], [cx + 14, cy], [cx + 7, cy + 12], [cx - 7, cy + 12]].map(([x, y]) => `${x},${y}`).join(' ')
}

export default function WorldMap({ state }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [layer, setLayer] = useState<'geography' | 'politics' | 'danger' | 'knowledge' | 'history'>('geography')
  const tile = state.world.tiles.find((candidate) => candidate.id === selectedId)
  const tileMap = useMemo(() => new Map(state.world.tiles.map((entry) => [entry.id, entry])), [state.world.tiles])
  const realmMap = useMemo(() => new Map(state.world.realms.map((realm) => [realm.id, realm])), [state.world.realms])
  const settlementMap = useMemo(() => new Map(state.world.settlements.map((settlement) => [settlement.id, settlement])), [state.world.settlements])
  const siteMap = useMemo(() => new Map(state.world.sites.map((site) => [site.id, site])), [state.world.sites])
  const populationMap = useMemo(() => new Map(state.world.monsterPopulations.map((population) => [population.id, population])), [state.world.monsterPopulations])
  const speciesMap = useMemo(() => new Map(state.world.monsterSpecies.map((species) => [species.id, species])), [state.world.monsterSpecies])

  const fillFor = (hex: WorldTile): string => {
    if (hex.knowledge === 0) return '#100f0c'
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

  const selectedSettlement = tile?.settlementId ? settlementMap.get(tile.settlementId) : undefined
  const selectedSite = tile?.siteId ? siteMap.get(tile.siteId) : undefined
  const selectedPopulation = tile?.monsterPopulationId ? populationMap.get(tile.monsterPopulationId) : undefined
  const selectedSpecies = selectedPopulation ? speciesMap.get(selectedPopulation.speciesId) : undefined
  const selectedRealm = tile?.stateId ? realmMap.get(tile.stateId) : undefined
  const localRoutes = tile ? state.world.routes.filter((route) => route.tileIds.includes(tile.id)) : []

  return (
    <section className="view world-view">
      <header className="view-heading map-heading">
        <div>
          <p className="eyebrow">Региональная карта · {state.world.width}×{state.world.height}</p>
          <h1>Неизвестные земли</h1>
          <p>{state.world.realms.length} государств, {state.world.settlements.length} поселений, {state.world.sites.length} древних мест. Карта хранит только знания гильдии.</p>
        </div>
        <div className="segmented-control map-layers">
          <button className={layer === 'geography' ? 'active' : ''} onClick={() => setLayer('geography')}>Рельеф</button>
          <button className={layer === 'politics' ? 'active' : ''} onClick={() => setLayer('politics')}>Границы</button>
          <button className={layer === 'danger' ? 'active' : ''} onClick={() => setLayer('danger')}>Опасность</button>
          <button className={layer === 'knowledge' ? 'active' : ''} onClick={() => setLayer('knowledge')}>Изученность</button>
          <button className={layer === 'history' ? 'active' : ''} onClick={() => setLayer('history')}>Древность</button>
        </div>
      </header>

      <div className="map-layout">
        <div>
          <div className="map-scroll parchment-panel">
            <svg width={mapWidth} height={mapHeight} className="hex-map" role="img" aria-label="Процедурная карта мира">
              {state.world.tiles.map((hex) => {
                const [cx, cy] = center(hex)
                const realm = realmMap.get(hex.stateId ?? '')
                const isSelected = hex.id === selectedId
                return (
                  <g key={hex.id} onClick={() => setSelectedId(hex.id)} className="hex-cell">
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
                return <polyline key={route.id} points={visible.map((entry) => center(entry).join(',')).join(' ')} fill="none" stroke={route.type === 'trade' ? '#d1ad65' : '#806f55'} strokeWidth={route.type === 'trade' ? 2 : 1.2} opacity=".7" strokeDasharray={route.type === 'road' ? '4 3' : undefined} strokeLinecap="round" />
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
            </svg>
          </div>
          <div className="map-legend">
            <span><i className="legend-road" />дорога</span><span><i className="legend-trade" />торговый путь</span><span><i className="legend-river" />река</span><span><i className="legend-settlement" />поселение</span><span><i className="legend-site" />руины</span>
          </div>
        </div>

        <aside className="map-sidebar paper-card">
          {tile ? (
            <>
              <button className="icon-button close-detail" onClick={() => setSelectedId(null)} aria-label="Закрыть"><X size={18} /></button>
              <p className="eyebrow">Клетка {tile.x}:{tile.y}</p>
              <h2>{tile.knowledge === 0 ? 'Неизвестная земля' : selectedSettlement?.name ?? selectedSite?.name ?? BIOME_LABELS[tile.biome]}</h2>
              {tile.knowledge === 0 ? <p>У гильдии нет достоверных сведений. Нужна картографическая экспедиция.</p> : (
                <div className="detail-stack">
                  <div className="detail-row"><Compass size={16} /><span>{BIOME_LABELS[tile.biome]}, проходимость {tile.travelCost.toFixed(1)}</span></div>
                  <div className="detail-row"><Skull size={16} /><span>Опасность: {tile.danger.toFixed(1)}/10</span></div>
                  <div className="detail-row"><Sparkles size={16} /><span>Магический фон: {Math.round(tile.magic * 100)}%</span></div>
                  <div className="detail-row"><MapPin size={16} /><span>Изученность: {tile.knowledge}/5</span></div>
                  {tile.hasRiver && <div className="detail-row"><Waves size={16} /><span>Через район проходит река</span></div>}
                  {localRoutes.filter((entry) => entry.type !== 'river').map((entry) => <div className="detail-row" key={entry.id}><Route size={16} /><span>{entry.name}</span></div>)}
                  {selectedRealm && <div className="detail-block realm-detail" style={{ borderColor: selectedRealm.color }}><h3><Castle size={16} /> {selectedRealm.name}</h3><p>{selectedRealm.government}; правитель — {selectedRealm.ruler}.</p><p>Культура: {selectedRealm.culture}. Вера: {selectedRealm.dominantFaith}.</p><p className="danger-text">Текущая проблема: {selectedRealm.currentIssue}.</p></div>}
                  {selectedSettlement && <div className="detail-block"><h3><Flag size={16} /> {selectedSettlement.kind === 'capital' ? 'Столица' : selectedSettlement.kind === 'town' ? 'Город' : 'Поселение'}</h3><p>Население: {selectedSettlement.population.toLocaleString('ru-RU')}</p><p>Благополучие: {selectedSettlement.prosperity}/100 · безопасность {selectedSettlement.safety}/100</p><div className="tag-list">{selectedSettlement.traits.map((trait) => <span key={trait}>{trait}</span>)}</div></div>}
                  {selectedSite && tile.knowledge >= 2 && <div className="detail-block danger-block"><h3>{selectedSite.type}</h3><p>{selectedSite.origin}. Возраст: около {selectedSite.age} лет.</p><p>Глубина: {selectedSite.depth}, опасность: {selectedSite.danger}/10.</p><p>Исследовано: {selectedSite.exploration}% {selectedSite.campEstablished ? '· действует базовый лагерь' : ''}</p><div className="site-layers">{selectedSite.layers.map((entry, index) => <span key={entry}>{index + 1}. {entry}</span>)}</div><div className="tag-list">{selectedSite.rewards.map((reward) => <span key={reward}>{reward}</span>)}</div><div className="zone-mini-list">{selectedSite.zones.slice(0, 5).map((zone) => <span key={zone.id}>{zone.explored ? '✓' : '○'} {zone.name}</span>)}</div></div>}
                  {selectedPopulation && selectedSpecies && tile.knowledge >= 2 && <div className="detail-block monster-block"><h3>{selectedSpecies.name}</h3><p>{selectedSpecies.behavior}. Численность: около {selectedPopulation.size}.</p>{selectedPopulation.legendary && <p className="legendary-warning">★ {selectedPopulation.legendaryName}: {selectedPopulation.history}</p>}<p>Известная слабость: {selectedSpecies.weakness}.</p><p>Способности: {selectedSpecies.abilities.join(', ')}.</p></div>}
                </div>
              )}
            </>
          ) : <div className="empty-detail"><TentTree size={34} /><h2>Выбери клетку</h2><p>Здесь появятся сведения о местности, государстве, дорогах, руинах и чудовищах.</p></div>}
        </aside>
      </div>
    </section>
  )
}
