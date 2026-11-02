import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, IconButton, Modal, SelectField, TextField } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useAddStageMutation, useRemoveStageMutation, useReorderStagesMutation, useUpdateStageMutation } from '@/features/recruiter/applications/api.js'
import styles from './ManageStagesModal.module.css'

/** A Manage stages error as text: the M-072 rules come back as codes and field keys from the server. */
function useStageError() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  return (error) => {
    const body = error?.data?.error
    if (body?.code === 'IN_USE') return t('applications:stages.inUse', { count: body.params.count })
    if (body?.code === 'CONFLICT') return t('applications:stages.entry')
    if (body?.fields?.stages) return t(body.fields.stages === 'too_many' ? 'applications:stages.tooMany' : 'applications:stages.tooFew', body.params)
    if (body?.fields?.name) return errorText.field('stageName', { key: body.fields.name, params: body.params })
    return errorText.code(error)
  }
}

/** One numbered stage row: the name edits in place (saved on blur / Enter), the candidate status, reorder and remove. */
function StageRow({ stage, index, total, categoryOptions, onMove, onError, error }) {
  const { t } = useTranslation()
  const stageError = useStageError()
  const [updateStage] = useUpdateStageMutation()
  const [removeStage] = useRemoveStageMutation()
  const [draft, setDraft] = useState(stage.name)

  async function save(body) {
    try {
      await updateStage({ id: stage.id, ...body }).unwrap()
      onError(stage.id, null)
      return true
    } catch (failure) {
      onError(stage.id, stageError(failure))
      return false
    }
  }

  async function commit() {
    if (draft.trim() === stage.name) {
      setDraft(stage.name)
      onError(stage.id, null)
      return
    }
    if (await save({ name: draft })) setDraft(draft.trim())
  }

  async function remove() {
    try {
      await removeStage(stage.id).unwrap()
    } catch (failure) {
      onError(stage.id, stageError(failure))
    }
  }

  return (
    <li className={styles.item} data-stage={stage.name}>
      <div className={styles.row}>
        <span className={styles.index} aria-hidden="true">
          {index + 1}.
        </span>
        <input
          className={styles.name}
          aria-label={t('applications:stages.name', { index: index + 1 })}
          aria-invalid={error ? true : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape' && draft !== stage.name) {
              event.stopPropagation()
              setDraft(stage.name)
              onError(stage.id, null)
            }
          }}
        />
        <select
          className={styles.category}
          aria-label={t('applications:stages.category', { name: stage.name })}
          value={stage.category}
          disabled={stage.isEntry}
          onChange={(event) => save({ category: event.target.value })}
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <IconButton icon={ChevronUp} iconSize={15} label={t('applications:stages.up', { name: stage.name })} className={styles.reorder} disabled={stage.isEntry || index <= 1} onClick={() => onMove(index, -1)} />
        <IconButton icon={ChevronDown} iconSize={15} label={t('applications:stages.down', { name: stage.name })} className={styles.reorder} disabled={stage.isEntry || index === total - 1} onClick={() => onMove(index, 1)} />
        <IconButton icon={Trash2} label={t('applications:stages.remove', { name: stage.name })} disabled={stage.isEntry} onClick={remove} />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

/**
 * "Your process. Your stages." (M-072, OD5): 2 to 12 stages, names up to 24 characters and unique, the first stage
 * fixed in place, each stage with the status candidates see. Every change is saved on the server at once.
 */
export default function ManageStagesModal({ open, onClose, stages }) {
  const { t } = useTranslation()
  const stageError = useStageError()
  const { data: config } = useGetConfigQuery()
  const [addStage, { isLoading }] = useAddStageMutation()
  const [reorderStages] = useReorderStagesMutation()
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('screening')
  const [addError, setAddError] = useState(null)
  const [rowErrors, setRowErrors] = useState({})
  const categoryOptions = (config?.enums.stageCategory ?? []).map((category) => ({ value: category, label: t(`applications:stages.status.${category}`) }))

  const setRowError = (id, message) => setRowErrors((current) => ({ ...current, [id]: message }))

  async function handleAdd(event) {
    event.preventDefault()
    try {
      await addStage({ name: newName, category: newCategory }).unwrap()
      setNewName('')
      setNewCategory('screening')
      setAddError(null)
    } catch (failure) {
      setAddError(stageError(failure))
    }
  }

  function move(index, direction) {
    const ids = stages.map((stage) => stage.id)
    ;[ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]
    reorderStages(ids)
  }

  return (
    <Modal open={open} onClose={onClose} title={t('applications:stages.title')} description={t('applications:stages.categoryHint')} width={600} divided>
      <ol className={styles.list}>
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            total={stages.length}
            categoryOptions={categoryOptions}
            error={rowErrors[stage.id]}
            onError={setRowError}
            onMove={move}
          />
        ))}
      </ol>
      <form className={styles.add} onSubmit={handleAdd} noValidate>
        <TextField
          className={styles.newName}
          aria-label={t('applications:stages.new')}
          placeholder={t('applications:stages.new')}
          name="stageName"
          value={newName}
          error={addError}
          data-autofocus
          onChange={(event) => {
            setNewName(event.target.value)
            setAddError(null)
          }}
        />
        <SelectField className={styles.newCategory} aria-label={t('applications:stages.newCategory')} name="stageCategory" options={categoryOptions} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
        <Button type="submit" className={styles.addButton} loading={isLoading} leftIcon={<Icon as={Plus} size={14} />}>
          {t('applications:stages.add')}
        </Button>
      </form>
      <p className={styles.note}>{t('applications:stages.note')}</p>
    </Modal>
  )
}
