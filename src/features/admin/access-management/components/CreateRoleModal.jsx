import { useState } from 'react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Button, Modal, SelectField, TextField, TextareaField } from '@/components/ui'
import { ACCESS_SCOPES, PERMISSION_GROUPS } from '../data/accessData.js'
import { validateRole } from '../utils/validateRole.js'
import PermissionOption from './PermissionOption.jsx'
import styles from './CreateRoleModal.module.css'

const FORM_ID = 'create-role-form'

/** "Create custom role" dialog: name, scope, description and the permission matrix. Saving adds a reusable role. */
export default function CreateRoleModal({ existingNames, onClose, onCreate }) {
  const [values, setValues] = useState({ name: '', scope: ACCESS_SCOPES[0], description: '' })
  const [permissions, setPermissions] = useState([])
  const [errors, setErrors] = useState({})

  const setField = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))
  const togglePermission = (id, checked) =>
    setPermissions((current) => (checked ? [...current, id] : current.filter((existing) => existing !== id)))

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateRole(values, existingNames)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onCreate({ ...values, permissions })
  }

  return (
    <Modal
      open
      divided
      className={styles.dialog}
      width={896}
      title="Create custom role"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} className={styles.save} disabled={permissions.length === 0}>
            Save reusable role
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.pair}>
          <TextField label="Role name" value={values.name} onChange={setField('name')} error={errors.name} maxLength={40} data-autofocus />
          <SelectField label="Access scope" value={values.scope} onChange={setField('scope')} options={ACCESS_SCOPES} />
        </div>
        <TextareaField
          label="Description"
          value={values.description}
          onChange={setField('description')}
          error={errors.description}
          rows={2}
          style={{ minHeight: 60 }}
        />

        <section aria-labelledby="role-permissions">
          <SectionTitle
            id="role-permissions"
            title="Permissions"
            description={`${permissions.length} selected · Apply least privilege and choose only what this role needs.`}
          />
          <div className={styles.matrix}>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.id} role="group" aria-labelledby={`group-${group.id}`} className={styles.group}>
                <p className={styles.legend} id={`group-${group.id}`}>
                  {group.label}
                </p>
                <div className={styles.options}>
                  {group.permissions.map((permission) => (
                    <PermissionOption
                      key={permission.id}
                      checked={permissions.includes(permission.id)}
                      onChange={(checked) => togglePermission(permission.id, checked)}
                      label={permission.label}
                      description={permission.description}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </form>
    </Modal>
  )
}
