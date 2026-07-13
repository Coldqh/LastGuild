import { GraduationCap, School, UserRoundCheck } from 'lucide-react'
import { useState } from 'react'
import type { AcademyProgramId, GameState } from '../types/game'

interface Props {
  state: GameState
  onEnroll: (characterId: string, programId: AcademyProgramId, mentorId?: string) => void
  onAssignMentor: (enrollmentId: string, mentorId?: string) => void
  onExam: (enrollmentId: string) => void
  onGraduate: (enrollmentId: string) => void
  onUpgrade: () => void
}

export default function AcademyPanel({ state, onEnroll, onAssignMentor, onExam, onGraduate, onUpgrade }: Props) {
  const [programId, setProgramId] = useState<AcademyProgramId>('scout')
  const [mentorId, setMentorId] = useState('')
  const candidates = state.characters.filter((entry) => !entry.employed && !entry.rivalGuildId && !entry.academyEnrollmentId && !['dead', 'missing', 'retired'].includes(entry.status)).slice(0, 8)
  const mentors = state.characters.filter((entry) => entry.employed && entry.level >= 3 && !['dead', 'missing'].includes(entry.status))
  const active = state.academy.enrollments.filter((entry) => ['training', 'ready'].includes(entry.status))
  const upgradeCost = 650 + state.academy.level * 480
  return <section className="view focused-view academy-view">
    <header className="view-heading compact-heading"><div><p className="eyebrow">Подготовка кадров</p><h1>Академия исследователей</h1><p>Набор, обучение, наставники и выпускники. Школы и историческое наследие вынесены в отдельный раздел.</p></div><div className="capacity-badge"><GraduationCap size={18} /><b>{active.length}/{state.academy.seats}</b><span>учеников</span></div></header>

    <div className="academy-summary-bar">
      <span>Уровень <b>{state.academy.level}</b></span><span>Репутация <b>{state.academy.reputation}</b></span><span>Расходы <b>{state.academy.monthlyCost} кр.</b></span>
      <button className="secondary-button small" disabled={state.guild.treasury < upgradeCost || state.academy.level >= 4} onClick={onUpgrade}>Расширить · {upgradeCost}</button>
    </div>

    <div className="academy-grid compact-academy-grid">
      <section className="paper-card academy-enroll-card">
        <div className="section-title"><School size={19} /><div><p className="eyebrow">Новый набор</p><h2>Зачисление</h2></div></div>
        <div className="academy-form-row">
          <label>Программа<select value={programId} onChange={(event) => setProgramId(event.target.value as AcademyProgramId)}>{state.academy.programs.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.durationMonths} мес.</option>)}</select></label>
          <label>Наставник<select value={mentorId} onChange={(event) => setMentorId(event.target.value)}><option value="">Без наставника</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label>
        </div>
        <div className="academy-candidate-list compact-candidate-list">{candidates.map((candidate) => { const program = state.academy.programs.find((entry) => entry.id === programId)!; return <article key={candidate.id}><div><strong>{candidate.name}</strong><span>{candidate.ancestry} · {candidate.profession} · интеллект {candidate.stats.intellect}</span></div><button className="primary-button small" disabled={active.length >= state.academy.seats || state.guild.treasury < program.tuition} onClick={() => onEnroll(candidate.id, programId, mentorId || undefined)}>Зачислить · {program.tuition}</button></article> })}{!candidates.length && <p className="muted">Подходящих кандидатов сейчас нет.</p>}</div>
      </section>

      <section className="paper-card academy-students-card">
        <div className="section-title"><UserRoundCheck size={19} /><div><p className="eyebrow">Учебный состав</p><h2>Ученики</h2></div></div>
        <div className="student-list compact-student-list">{state.academy.enrollments.filter((entry) => entry.status !== 'graduated').map((enrollment) => {
          const student = state.characters.find((entry) => entry.id === enrollment.characterId)
          const program = state.academy.programs.find((entry) => entry.id === enrollment.programId)
          return <article key={enrollment.id} className={`student-card status-${enrollment.status}`}><div className="student-top"><div><strong>{student?.name}</strong><span>{program?.name}</span></div><b>{Math.round(enrollment.progress)}%</b></div><div className="progress-line"><span style={{ width: `${enrollment.progress}%` }} /></div><div className="student-meta"><span>Успеваемость {enrollment.performance}</span><span>Экзамены {enrollment.examsPassed}</span></div><select value={enrollment.mentorId ?? ''} onChange={(event) => onAssignMentor(enrollment.id, event.target.value || undefined)}><option value="">Без наставника</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select><div className="button-row"><button className="secondary-button small" disabled={enrollment.progress < 45 || enrollment.status !== 'training'} onClick={() => onExam(enrollment.id)}>Экзамен</button><button className="primary-button small" disabled={enrollment.status !== 'ready'} onClick={() => onGraduate(enrollment.id)}>Выпустить</button></div></article>
        })}{!active.length && <p className="muted">Активных учеников нет.</p>}</div>
      </section>
    </div>
  </section>
}
