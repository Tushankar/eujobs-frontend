import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button, Icon, IconButton, Modal, TextField } from '@/components/ui'
import { MAX_STAGE_NAME_LENGTH } from '../data/pipeline.js'
import styles from './ManageStagesModal.module.css'

/** One numbered stage row. The name edits in place (saved on blur / Enter); reorder and remove sit on the right. */
function StageRow({ stage, index, total, onRename, onMove, onRemove, error }) {
  const [draft, setDraft] = useState(stage.name)
  const [renameError, setRenameError] = useState(null)
  const message = renameError ?? error

  function commit() {
    if (draft.trim() === stage.name) {
      setDraft(stage.name)
      setRenameError(null)
      return
    }
    const failure = onRename(stage.id, draft)
    setRenameError(failure)
    if (!failure) setDraft(draft.trim())
  }

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <span className={styles.index} aria-hidden="true">
          {index + 1}.
        </span>
        <input
          className={styles.name}
          aria-label={`Name of stage ${index + 1}`}
          aria-invalid={message ? true : undefined}
          value={draft}
          maxLength={MAX_STAGE_NAME_LENGTH + 10}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape' && draft !== stage.name) {
              event.stopPropagation()
              setDraft(stage.name)
              setRenameError(null)
            }
          }}
        />
        <IconButton icon={ChevronUp} iconSize={15} label={`Move ${stage.name} up`} className={styles.reorder} disabled={index === 0} onClick={() => onMove(stage.id, -1)} />
        <IconButton icon={ChevronDown} iconSize={15} label={`Move ${stage.name} down`} className={styles.reorder} disabled={index === total - 1} onClick={() => onMove(stage.id, 1)} />
        <IconButton icon={Trash2} label={`Remove ${stage.name}`} onClick={() => onRemove(stage.id)} />
      </div>
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </li>
  )
}

/** "Your process. Your stages." dialog: rename, reorder, add and remove pipeline stages with validation. */
export default function ManageStagesModal({ open, onClose, stages, onAdd, onRename, onMove, onRemove }) {
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState(null)
  const [removal, setRemoval] = useState(null)

  function handleAdd(event) {
    event.preventDefault()
    const failure = onAdd(newName)
    setAddError(failure)
    if (!failure) setNewName('')
  }

  function handleRemove(stageId) {
    setRemoval({ stageId, message: onRemove(stageId) })
  }

  return (
    <Modal open={open} onClose={onClose} title="Your process. Your stages." width={512} divided>
      <ol className={styles.list}>
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            total={stages.length}
            error={removal?.stageId === stage.id ? removal.message : null}
            onRename={onRename}
            onMove={onMove}
            onRemove={handleRemove}
          />
        ))}
      </ol>
      <form className={styles.add} onSubmit={handleAdd} noValidate>
        <TextField
          className={styles.newName}
          aria-label="New pipeline stage"
          placeholder="New stage name"
          value={newName}
          error={addError}
          data-autofocus
          onChange={(event) => {
            setNewName(event.target.value)
            setAddError(null)
          }}
        />
        <Button type="submit" className={styles.addButton} leftIcon={<Icon as={Plus} size={14} />}>
          Add
        </Button>
      </form>
      <p className={styles.note}>Move candidates out of a stage before removing it. Stage menus offer a keyboard-friendly alternative to dragging.</p>
    </Modal>
  )
}
