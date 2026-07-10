import { useMemo, useState } from 'react'
import { Castle, Compass, MapPin, Skull, TentTree, X } from 'lucide-react'
import { BIOME_COLORS, BIOME_LABELS } from '../data/content'
import type { GameState, WorldTile } from '../types/game'

interface Props {
  state: GameState
}

const HEX_W = 28
const HEX_H = 24
const X_STEP = 21
const Y_STEP = 24

function points(cx: number, cy: number): string {
  return [
    [cx - 14, cy],
    [cx - 7, cy - 12],
    [cx + 7, cy - 12],
    [cx + 14, cy],
    [cx + 7, cy + 12],
    [cx - 7, cy + 12],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
}

export default function WorldMap({ state }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [layer, setLayer] = useState<'geography' | 'politics' | 'danger' | 'knowledge'>('geography')
  const tile = state.world.tiles.find((candidate) => candidate.id === selectedId)
  const realmMap = useMemo(() => new Map(state.world.realms.map((realm) => [realm.id, realm])), [state.world.realms])
  const settlementMap = useMemo(() => new Map(state.world.settlements.map((settlement) => [settlement.id, settlement])), [state.world.settlements])
  const siteMap = useMemo(() => new Map(state.world.sites.map((site) => [site.id, site])), [state.world.sites])
  const populationMap = useMemo(() => new Map(state.world.monsterPopulations.map((population) => [population.id, population])), [state.world.monsterPopulations])
  const speciesMap = useMemo(() => new Map(state.world.monsterSpecies.map((species) => [species.id, species])), [state.world.monsterSpecies])

  const fillFor = (hex: WorldTile): string => {
    if (hex.knowledge === 0) return '#100f0c'
    if (layer === 'politics') return realmMap.get(hex.stateId ?? '')?.color ?? '#2c2922'
    if (layer === 'danger') {
      const light = Math.max(17, 52 - hex.danger * 3.2)
      return `hsl(${Math.max(0, 115 - hex.danger * 13)} 42% ${light}%)`
    }
    if (layer === 'knowledge') return ['#100f0c', '#292820', '#46493a', '#687050', '#8d945e', '#b6ad75'][hex.knowledge]
    return BIOME_COLORS[hex.biome]
  }

  const mapWidth = state.world.width * X_STEP + HEX_W + 30
  const mapHeight = state.world.height * Y_STEP + HEX_H + 36
  const expeditionPositions = state.expeditions
    .filter((expedition) => expedition.status === 'active' || expedition.status === 'returning')
    .map((expedition) => ({ expedition, tileId: expedition.route[expedition.routeIndex] }))

  const selectedSettlement = tile?.settlementId ? settlementMap.get(tile.settlementId) : undefined
  const selectedSite = tile?.siteId ? siteMap.get(tile.siteId) : undefined
  const selectedPopulation = tile?.monsterPopulationId ? populationMap.get(tile.monsterPopulationId) : undefined
  const selectedSpecies = selectedPopulation ? speciesMap.get(selectedPopulation.speciesId) : undefined

  return (
    <section className="view world-view">
      <header className="view-heading map-heading">
        <div>
          <p className="eyebrow">Региональная карта</p>
          <h1>Неизвестные земли</h1>
          <p>Карта хранит только знания гильдии. Чёрные клетки ещё не исследованы.</p>
        </div>
        <div className="segmented-control">
          <button className={layer === 'geography' ? 'active' : ''} onClick={() => setLayer('geography')}>Рельеф</button>
          <button className={layer === 'politics' ? 'active' : ''} onClick={() => setLayer('politics')}>Границы</button>
          <button className={layer === 'danger' ? 'active' : ''} onClick={() => setLayer('danger')}>Опасность</button>
          <button className={layer === 'knowledge' ? 'active' : ''} onClick={() => setLayer('knowledge')}>Изученность</button>
        </div>
      </header>

      <div className="map-layout">
        <div className="map-scroll parchment-panel">
          <svg width={mapWidth} height={mapHeight} className="hex-map" role="img" aria-label="Процедурная карта мира">
            {state.world.tiles.map((hex) => {
              const cx = 20 + hex.x * X_STEP
              const cy = 22 + hex.y * Y_STEP + (hex.x % 2 ? 12 : 0)
              const realm = realmMap.get(hex.stateId ?? '')
              const isSelected = hex.id === selectedId
              return (
                <g key={hex.id} onClick={() => setSelectedId(hex.id)} className="hex-cell">
                  <polygon
                    points={points(cx, cy)}
                    fill={fillFor(hex)}
                    stroke={isSelected ? '#f0cf7d' : hex.knowledge > 0 && layer !== 'politics' ? realm?.color ?? '#15130f' : '#15130f'}
                    strokeWidth={isSelected ? 2.2 : 0.55}
                    opacity={hex.knowledge === 1 ? 0.68 : 1}
                  />
                  {hex.knowledge > 0 && hex.settlementId && (
                    <circle cx={cx} cy={cy} r={settlementMap.get(hex.settlementId)?.kind === 'capital' ? 4.2 : 3} fill="#e3c88d" stroke="#1a130b" strokeWidth="1.2" />
                  )}
                  {hex.knowledge >= 2 && hex.siteId && (
                    <path d={`M ${cx - 3} ${cy + 4} L ${cx} ${cy - 4} L ${cx + 3} ${cy + 4} Z`} fill="#a85041" stroke="#1a130b" strokeWidth="1" />
                  )}
                  {hex.knowledge >= 2 && hex.monsterPopulationId && (
                    <circle cx={cx + 6} cy={cy - 6} r="2" fill="#d4664f" />
                  )}
                </g>
              )
            })}
            {expeditionPositions.map(({ expedition, tileId }) => {
              const current = state.world.tiles.find((candidate) => candidate.id === tileId)
              if (!current) return null
              const cx = 20 + current.x * X_STEP
              const cy = 22 + current.y * Y_STEP + (current.x % 2 ? 12 : 0)
              return (
                <g key={expedition.id} className="expedition-marker">
                  <circle cx={cx} cy={cy} r="7" fill="#d5ae55" stroke="#241708" strokeWidth="2" />
                  <circle cx={cx} cy={cy} r="2.6" fill="#241708" />
                </g>
              )
            })}
          </svg>
        </div>

        <aside className="map-sidebar paper-card">
          {tile ? (
            <>
              <button className="icon-button close-detail" onClick={() => setSelectedId(null)} aria-label="Закрыть"><X size={18} /></button>
              <p className="eyebrow">Клетка {tile.x}:{tile.y}</p>
              <h2>{tile.knowledge === 0 ? 'Неизвестная земля' : selectedSettlement?.name ?? selectedSite?.name ?? BIOME_LABELS[tile.biome]}</h2>
              {tile.knowledge === 0 ? (
                <p>У гильдии нет достоверных сведений. Нужна картографическая экспедиция.</p>
              ) : (
                <div className="detail-stack">
                  <div className="detail-row"><Compass size={16} /><span>{BIOME_LABELS[tile.biome]}, проходимость {tile.travelCost.toFixed(1)}</span></div>
                  <div className="detail-row"><Skull size={16} /><span>Опасность: {tile.danger.toFixed(1)}/10</span></div>
                  <div className="detail-row"><MapPin size={16} /><span>Изученность: {tile.knowledge}/5</span></div>
                  {realmMap.get(tile.stateId ?? '') && (
                    <div className="realm-chip" style={{ borderColor: realmMap.get(tile.stateId ?? '')?.color }}>
                      <Castle size={16} /> {realmMap.get(tile.stateId ?? '')?.name}
                    </div>
                  )}
                  {selectedSettlement && (
                    <div className="detail-block">
                      <h3>{selectedSettlement.kind === 'capital' ? 'Столица' : selectedSettlement.kind === 'town' ? 'Город' : 'Поселение'}</h3>
                      <p>Население: {selectedSettlement.population.toLocaleString('ru-RU')}</p>
                      <p>Благополучие: {selectedSettlement.prosperity}/100</p>
                      <div className="tag-list">{selectedSettlement.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                    </div>
                  )}
                  {selectedSite && tile.knowledge >= 2 && (
                    <div className="detail-block danger-block">
                      <h3>{selectedSite.type}</h3>
                      <p>{selectedSite.origin}. Возраст: около {selectedSite.age} лет.</p>
                      <p>Глубина: {selectedSite.depth}, опасность: {selectedSite.danger}/10.</p>
                      <div className="tag-list">{selectedSite.rewards.map((reward) => <span key={reward}>{reward}</span>)}</div>
                    </div>
                  )}
                  {selectedPopulation && selectedSpecies && tile.knowledge >= 2 && (
                    <div className="detail-block monster-block">
                      <h3>{selectedSpecies.name}</h3>
                      <p>{selectedSpecies.behavior}. Численность: около {selectedPopulation.size}.</p>
                      <p>Известная слабость: {selectedSpecies.weakness}.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-detail">
              <TentTree size={34} />
              <h2>Выбери клетку</h2>
              <p>Здесь появятся сведения о местности, государстве, поселениях, руинах и чудовищах.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
