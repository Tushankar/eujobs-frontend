import { useState } from 'react'
import { Button, Checkbox, Modal, SelectField, TextField } from '@/components/ui'
import { AUDIENCES, COURSE_LEVELS } from '../data/courses.js'
import { validateCourse } from '../utils/courseFormat.js'
import styles from './CourseFormModal.module.css'

const FORM_ID = 'course-form'

const ACCESS_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid (one-time purchase)' },
]

/** Upload a new course (course = null) or manage an existing one. Only the media file name is kept, as the page note says. */
export default function CourseFormModal({ audience, course, onClose, onSave }) {
  const editing = Boolean(course)
  const [values, setValues] = useState({
    title: course?.title ?? '',
    category: course?.category ?? '',
    level: course?.level ?? COURSE_LEVELS[0],
    lessons: String(course?.lessons ?? 4),
    access: course && course.price > 0 ? 'paid' : 'free',
    price: course && course.price > 0 ? String(course.price) : '',
    mediaName: course?.mediaName ?? '',
    published: course ? course.status === 'published' : true,
  })
  const [errors, setErrors] = useState({})

  const setField = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCourse(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSave({
      audience,
      title: values.title.trim(),
      category: values.category.trim(),
      level: values.level,
      lessons: Number(values.lessons),
      price: values.access === 'paid' ? Number(values.price) : 0,
      mediaName: values.mediaName,
      status: values.published ? 'published' : 'draft',
    })
  }

  return (
    <Modal
      open
      divided
      width={640}
      title={editing ? 'Manage course' : 'Upload course'}
      description={`${editing ? 'Update' : 'Add'} a course for the ${AUDIENCES[audience].visibleIn} workspace.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Upload course'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField label="Course title" value={values.title} onChange={setField('title')} error={errors.title} maxLength={80} data-autofocus />
        <div className={styles.pair}>
          <TextField label="Category or skill" value={values.category} onChange={setField('category')} error={errors.category} maxLength={40} />
          <SelectField label="Level" value={values.level} onChange={setField('level')} options={COURSE_LEVELS} />
        </div>
        <div className={styles.pair}>
          <TextField label="Lessons" type="number" min={1} max={60} value={values.lessons} onChange={setField('lessons')} error={errors.lessons} />
          <SelectField label="Access" value={values.access} onChange={setField('access')} options={ACCESS_OPTIONS} />
        </div>
        {values.access === 'paid' && (
          <TextField
            label="Price (GBP)"
            type="number"
            min={0}
            step="0.01"
            value={values.price}
            onChange={setField('price')}
            error={errors.price}
          />
        )}
        <TextField
          label="Course media"
          type="file"
          onChange={(event) => setValues((current) => ({ ...current, mediaName: event.target.files?.[0]?.name ?? '' }))}
          hint={
            values.mediaName
              ? `Selected: ${values.mediaName}. Only the file name is kept in this prototype.`
              : 'Optional. Only the file name is kept in this prototype.'
          }
        />
        <Checkbox
          checked={values.published}
          onChange={(event) => setValues((current) => ({ ...current, published: event.target.checked }))}
        >
          Published: visible in {AUDIENCES[audience].visibleIn}
        </Checkbox>
      </form>
    </Modal>
  )
}
