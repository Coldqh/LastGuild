import { Award, BookOpen, CheckCircle2, ChevronDown, FileWarning, HeartPulse, ScrollText, Skull, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DiscoveryDisposition, ExpeditionDebrief, GameState } from '../types/game'
import type { DebriefResolution } from '../game/simulation'

interface Props {
  debrief: ExpeditionDebrief
  state: GameState
  onResolve: (resolution: DebriefResolution) => void
}

const dispositionLabels: Record<DiscoveryDisposition, { label: string; note: string }> = {
  unreviewed: { label: 'Не решено', note: 'Разбор нельзя закрыть без решения.' },
  published: { label: 'Опубликовать', note: 'Репутация и реакция мира.' },
  archived: { label: 'В архив', note: 'Сохранить без шума.' },
  sold: { label: 'Продать', note: 'Деньги, но потеря контроля.' },
  secret: { label: 'Засекретить', note: 'Контроль с риском утечки.' },
}

export default function ExpeditionDebriefModal({ debrief, state, onResolve }: Props) {
  const [officialReportId, setOfficialReportId] = useState(debrief.reports[0]?.id ?? '')
  const [leadDiscovererId, setLeadDiscovererId] = useState(debrief.suggestedLeadId ?? debrief.survivorIds[0] ?? '')
  const [disposition, setDisposition] = useState<DiscoveryDisposition>('published')
  const expedition = state.expeditions.find((candidate) => candidate.id === debrief.expeditionId)
  const discoveries = state.discoveries.filter((discovery) => debrief.discoveryIds.includes(discovery.id))
  const survivors = debrief.survivorIds.map((id) => state.characters.find((character) => character.id === id)).filter(Boolean)
  const casualties = debrief.casualtyIds.map((id) => state.characters.find((character) => character.id === id)).filter(Boolean)
  const injured = debrief.injuredIds.map((id) => state.characters.find((character) => character.id === id)).filter(Boolean)
  const selectedReport = useMemo(() => debrief.reports.find((report) => report.id === officialReportId), [debrief.reports, officialReportId])

  return (
    <div className="modal-backdrop debrief-backdrop">
      <article className="debrief-modal compact-debrief paper-card">
        <header className="compact-debrief-header">
          <div><p className="eyebrow">Разбор возвращения · день {state.day}</p><h2>{expedition?.name ?? 'Возвращение экспедиции'}</h2><p>{debrief.success ? 'Главная задача выполнена.' : 'Отряд вернулся с неполным результатом.'}</p></div>
          <div className={`debrief-result ${debrief.success ? 'success' : 'failure'}`}><CheckCircle2 /><strong>{debrief.success ? 'Успех' : 'Частичный итог'}</strong><span>+{debrief.reward} кр.</span></div>
        </header>

        <div className="debrief-summary-grid compact">
          <div><Users /><span>Вернулись</span><strong>{survivors.length}</strong></div>
          <div><Skull /><span>Погибли</span><strong>{casualties.length}</strong></div>
          <div><HeartPulse /><span>Ранены</span><strong>{injured.length}</strong></div>
          <div><Sparkles /><span>Открытия</span><strong>{discoveries.length}</strong></div>
        </div>

        <div className="compact-debrief-decisions">
          <label><span><ScrollText size={16} />Официальная версия</span><select value={officialReportId} onChange={(event) => setOfficialReportId(event.target.value)}>{debrief.reports.map((report) => { const author = state.characters.find((character) => character.id === report.authorId); return <option key={report.id} value={report.id}>{report.title} · {author?.name ?? 'неизвестный автор'} · {report.reliability}%</option> })}</select>{selectedReport?.contradictsReportId && <small className="danger-text">Версия противоречит другому отчёту.</small>}</label>

          {discoveries.length > 0 && <label><span><Award size={16} />Автор открытия</span><select value={leadDiscovererId} onChange={(event) => setLeadDiscovererId(event.target.value)}>{survivors.map((character) => <option key={character!.id} value={character!.id}>{character!.name} · {character!.profession}</option>)}</select><small>Рекомендация: {state.characters.find((character) => character.id === debrief.suggestedLeadId)?.name ?? 'не определена'}</small></label>}
        </div>

        <section className="compact-disposition">
          <div className="section-title"><BookOpen size={18} /><div><p className="eyebrow">Контроль знаний</p><h3>Что сделать с находками</h3></div></div>
          <div className="disposition-grid compact">{(['published', 'archived', 'sold', 'secret'] as DiscoveryDisposition[]).map((value) => <button className={disposition === value ? 'selected' : ''} key={value} onClick={() => setDisposition(value)}><strong>{dispositionLabels[value].label}</strong><span>{dispositionLabels[value].note}</span></button>)}</div>
        </section>

        <details className="debrief-details">
          <summary><ChevronDown size={15} />Подробные отчёты, открытия и потери</summary>
          <div className="debrief-details-content">
            <section><h3>Версии участников</h3>{debrief.reports.map((report) => { const author = state.characters.find((character) => character.id === report.authorId); return <article key={report.id}><strong>{report.title}</strong><small>{author?.name ?? 'неизвестный автор'} · достоверность {report.reliability}%</small><p>{report.claim}</p>{report.contradictsReportId && <em><FileWarning size={13} /> есть противоречие</em>}</article> })}</section>
            {discoveries.length > 0 && <section><h3>Открытия</h3>{discoveries.map((discovery) => <article key={discovery.id}><strong>{discovery.title}</strong><small>доказательства {discovery.evidenceQuality}% · ценность {discovery.value} кр.</small></article>)}</section>}
            {casualties.length > 0 && <section><h3>Погибшие</h3><p>{casualties.map((character) => character!.name).join(', ')}</p></section>}
          </div>
        </details>

        <button className="primary-button debrief-confirm" disabled={!officialReportId} onClick={() => onResolve({ officialReportId, leadDiscovererId: discoveries.length ? (leadDiscovererId || undefined) : undefined, disposition })}>Утвердить решения и закрыть разбор</button>
      </article>
    </div>
  )
}
