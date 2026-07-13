import { BookMarked, GraduationCap, School, Sparkles, UserRoundCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AcademyProgramId, GameState } from '../types/game'

interface Props {
  state: GameState
  onEnroll: (characterId: string, programId: AcademyProgramId, mentorId?: string) => void
  onAssignMentor: (enrollmentId: string, mentorId?: string) => void
  onExam: (enrollmentId: string) => void
  onGraduate: (enrollmentId: string) => void
  onUpgrade: () => void
  onFoundDoctrine: (founderId: string) => void
}

export default function AcademyPanel({ state, onEnroll, onAssignMentor, onExam, onGraduate, onUpgrade, onFoundDoctrine }: Props) {
  const [programId, setProgramId] = useState<AcademyProgramId>('scout')
  const [mentorId, setMentorId] = useState('')
  const candidates = state.characters.filter((entry) => !entry.employed && !entry.rivalGuildId && !entry.academyEnrollmentId && !['dead', 'missing', 'retired'].includes(entry.status)).slice(0, 10)
  const mentors = state.characters.filter((entry) => entry.employed && entry.level >= 3 && !['dead', 'missing'].includes(entry.status))
  const active = state.academy.enrollments.filter((entry) => ['training', 'ready'].includes(entry.status))
  const eligibleFounders = useMemo(() => state.characters.filter((entry) => entry.employed && entry.level >= 4 && !state.doctrines.some((doctrine) => doctrine.founderId === entry.id)).slice(0, 8), [state.characters, state.doctrines])
  const upgradeCost = 650 + state.academy.level * 480
  return <div className="headquarters-tab-content academy-layout">
    <div className="academy-header-card">
      <div className="section-title"><GraduationCap size={22} /><div><p className="eyebrow">Институт гильдии</p><h2>Академия исследователей</h2></div></div>
      <div className="academy-metrics"><span><b>{state.academy.level}</b> уровень</span><span><b>{active.length}/{state.academy.seats}</b> мест</span><span><b>{state.academy.reputation}</b> репутация</span><span><b>{state.academy.monthlyCost}</b> кр./мес.</span></div>
      <button className="secondary-button" disabled={state.guild.treasury < upgradeCost || state.academy.level >= 4} onClick={onUpgrade}>Расширить академию · {upgradeCost} кр.</button>
    </div>

    <div className="academy-grid">
      <section className="paper-card academy-enroll-card">
        <div className="section-title"><School size={19} /><div><p className="eyebrow">Новый набор</p><h3>Программы обучения</h3></div></div>
        <label>Программа<select value={programId} onChange={(event) => setProgramId(event.target.value as AcademyProgramId)}>{state.academy.programs.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.durationMonths} мес.</option>)}</select></label>
        <label>Наставник<select value={mentorId} onChange={(event) => setMentorId(event.target.value)}><option value="">Без личного наставника</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name} · лидерство {mentor.skills.leadership}</option>)}</select></label>
        <div className="academy-candidate-list">{candidates.map((candidate) => {
          const program = state.academy.programs.find((entry) => entry.id === programId)!
          return <article key={candidate.id}><div><strong>{candidate.name}</strong><span>{candidate.ancestry} · интеллект {candidate.stats.intellect} · {candidate.profession}</span></div><button className="primary-button small" disabled={active.length >= state.academy.seats || state.guild.treasury < program.tuition} onClick={() => onEnroll(candidate.id, programId, mentorId || undefined)}>Зачислить · {program.tuition}</button></article>
        })}</div>
      </section>

      <section className="paper-card academy-students-card">
        <div className="section-title"><UserRoundCheck size={19} /><div><p className="eyebrow">Учебный состав</p><h3>Ученики</h3></div></div>
        <div className="student-list">{state.academy.enrollments.filter((entry) => entry.status !== 'graduated').map((enrollment) => {
          const student = state.characters.find((entry) => entry.id === enrollment.characterId)
          const program = state.academy.programs.find((entry) => entry.id === enrollment.programId)
          return <article key={enrollment.id} className={`student-card status-${enrollment.status}`}><div className="student-top"><div><strong>{student?.name}</strong><span>{program?.name}</span></div><b>{Math.round(enrollment.progress)}%</b></div><div className="progress-line"><span style={{ width: `${enrollment.progress}%` }} /></div><div className="student-meta"><span>Успеваемость {enrollment.performance}</span><span>Экзамены {enrollment.examsPassed}</span></div><select value={enrollment.mentorId ?? ''} onChange={(event) => onAssignMentor(enrollment.id, event.target.value || undefined)}><option value="">Без наставника</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select><div className="button-row"><button className="secondary-button small" disabled={enrollment.progress < 45 || enrollment.status !== 'training'} onClick={() => onExam(enrollment.id)}>Экзамен</button><button className="primary-button small" disabled={enrollment.status !== 'ready'} onClick={() => onGraduate(enrollment.id)}>Выпустить</button></div></article>
        })}{!active.length && <p className="muted">Активных учеников нет.</p>}</div>
      </section>
    </div>

    <section className="paper-card doctrine-panel">
      <div className="section-title"><BookMarked size={19} /><div><p className="eyebrow">Наследие наставников</p><h3>Школы и доктрины</h3></div></div>
      <div className="doctrine-grid">{state.doctrines.map((doctrine) => <article key={doctrine.id}><Sparkles size={18} /><h4>{doctrine.name}</h4><p>{doctrine.principle}</p><strong>{doctrine.bonus}</strong><small>Слабость: {doctrine.weakness}</small></article>)}{eligibleFounders.map((founder) => <article className="doctrine-founder" key={founder.id}><h4>{founder.name}</h4><p>{founder.careerStage} · слава {founder.fame}</p><button className="secondary-button small" onClick={() => onFoundDoctrine(founder.id)}>Основать школу</button></article>)}</div>
    </section>
  </div>
}
