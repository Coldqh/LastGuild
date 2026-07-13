import { Award, BookOpen, CheckCircle2, FileWarning, HeartPulse, ScrollText, Skull, Sparkles, Users } from 'lucide-react'
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
  published: { label: 'Опубликовать', note: 'Слава и научный авторитет, но мир начнёт реагировать.' },
  archived: { label: 'Оставить в архиве', note: 'Знания сохранятся без немедленного политического шума.' },
  sold: { label: 'Продать сведения', note: 'Казна вырастет, контроль над открытием будет потерян.' },
  secret: { label: 'Засекретить', note: 'Сведения останутся внутри, но возможна утечка.' },
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
      <article className="debrief-modal paper-card">
        <header className="debrief-header">
          <div>
            <p className="eyebrow">Обязательный разбор · день {state.day}</p>
            <h2>{expedition?.name ?? 'Возвращение экспедиции'}</h2>
            <p>Награда уже поступила в казну. Теперь гильдия должна закрепить официальную версию, авторство и судьбу находок.</p>
          </div>
          <div className={`debrief-result ${debrief.success ? 'success' : 'failure'}`}><CheckCircle2 /><strong>{debrief.success ? 'Успех' : 'Неполный результат'}</strong><span>{debrief.reward} кр.</span></div>
        </header>

        <div className="debrief-summary-grid">
          <div><Users /><span>Вернулись</span><strong>{survivors.length}</strong></div>
          <div><Skull /><span>Погибли</span><strong>{casualties.length}</strong></div>
          <div><HeartPulse /><span>Нуждаются в лечении</span><strong>{injured.length}</strong></div>
          <div><Sparkles /><span>Открытия</span><strong>{discoveries.length}</strong></div>
        </div>

        <div className="debrief-columns">
          <section>
            <div className="section-title"><ScrollText size={19} /><div><p className="eyebrow">Версии событий</p><h3>Официальный отчёт</h3></div></div>
            <div className="report-choice-list">
              {debrief.reports.map((report) => {
                const author = state.characters.find((character) => character.id === report.authorId)
                return (
                  <button className={officialReportId === report.id ? 'selected' : ''} key={report.id} onClick={() => setOfficialReportId(report.id)}>
                    <span className="report-radio" />
                    <div><strong>{report.title}</strong><small>{author?.name ?? 'неизвестный автор'} · достоверность {report.reliability}%</small><p>{report.claim}</p>{report.contradictsReportId && <em><FileWarning size={13} /> противоречит другому отчёту</em>}</div>
                  </button>
                )
              })}
            </div>
            {selectedReport?.contradictsReportId && <div className="warning-line"><FileWarning size={15} />Принятие этой версии ударит по доверию к лидеру, но укрепит точность архива.</div>}
          </section>

          <section>
            <div className="section-title"><Award size={19} /><div><p className="eyebrow">Слава</p><h3>Автор открытия</h3></div></div>
            {discoveries.length ? (
              <>
                <select value={leadDiscovererId} onChange={(event) => setLeadDiscovererId(event.target.value)}>
                  {survivors.map((character) => <option key={character!.id} value={character!.id}>{character!.name} · {character!.profession}</option>)}
                </select>
                <p className="muted">Рекомендация архива: {state.characters.find((character) => character.id === debrief.suggestedLeadId)?.name ?? 'не определена'}. Несправедливое авторство создаст обиды.</p>
              </>
            ) : <p className="muted">Подтверждённых открытий нет.</p>}

            <div className="section-title debrief-disposition-title"><BookOpen size={19} /><div><p className="eyebrow">Контроль знаний</p><h3>Судьба открытия</h3></div></div>
            <div className="disposition-grid">
              {(['published', 'archived', 'sold', 'secret'] as DiscoveryDisposition[]).map((value) => (
                <button className={disposition === value ? 'selected' : ''} key={value} onClick={() => setDisposition(value)}>
                  <strong>{dispositionLabels[value].label}</strong><span>{dispositionLabels[value].note}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {discoveries.length > 0 && <div className="debrief-discovery-strip">{discoveries.map((discovery) => <div key={discovery.id}><Sparkles size={15} /><span><strong>{discovery.title}</strong><small>доказательства {discovery.evidenceQuality}% · ценность {discovery.value} кр.</small></span></div>)}</div>}
        {casualties.length > 0 && <div className="debrief-casualties"><Skull size={17} /><span>В хронику погибших войдут: {casualties.map((character) => character!.name).join(', ')}</span></div>}

        <button className="primary-button debrief-confirm" disabled={!officialReportId} onClick={() => onResolve({ officialReportId, leadDiscovererId: discoveries.length ? (leadDiscovererId || undefined) : undefined, disposition })}>Утвердить разбор и продолжить</button>
      </article>
    </div>
  )
}
