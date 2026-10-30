import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Earth, FileText, Link2, MapPin, Plus, ShieldCheck, SquarePen, Trash2, Upload } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Avatar, Button, Checkbox, Icon, IconButton, Panel } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { checkUpload, useErrorText, useUploadText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import {
  useDeleteCertificateMutation,
  useDeleteEntryMutation,
  useGetProfileQuery,
  useRemovePhotoMutation,
  useSetNoneMutation,
  useUploadPhotoMutation,
} from '../api.js'
import CertificateDialog from '../components/CertificateDialog.jsx'
import CompletenessChecklist from '../components/CompletenessChecklist.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'
import EntryDialog from '../components/EntryDialog.jsx'
import LanguagesDialog from '../components/LanguagesDialog.jsx'
import LinksDialog from '../components/LinksDialog.jsx'
import RightToWorkDialog from '../components/RightToWorkDialog.jsx'
import styles from './ProfilePage.module.css'

/** "My profile" (§3.2, OD16): section cards with their editors, the photo, and the server's completeness checklist. */
export default function ProfilePage() {
  const { data: profile } = useGetProfileQuery()
  return profile ? <ProfileView profile={profile} /> : null
}

function Section({ name, title, action, children }) {
  return (
    <section className={styles.section} data-section={name}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function EntryRow({ title, meta, children, onEdit, onDelete, editLabel, deleteLabel }) {
  return (
    <li className={styles.entry}>
      <div className={styles.entryText}>
        <p className={styles.entryTitle}>{title}</p>
        {meta && <p className={styles.entryMeta}>{meta}</p>}
        {children}
      </div>
      <div className={styles.entryActions}>
        <IconButton icon={SquarePen} label={editLabel} onClick={onEdit} />
        {onDelete && <IconButton icon={Trash2} label={deleteLabel} onClick={onDelete} />}
      </div>
    </li>
  )
}

function ProfileView({ profile }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const photoRule = config?.limits.uploads.photo
  const photoText = useUploadText(photoRule)
  const photoInput = useRef(null)
  const [uploadPhoto, { isLoading: uploadingPhoto }] = useUploadPhotoMutation()
  const [removePhoto] = useRemovePhotoMutation()
  const [setNone] = useSetNoneMutation()
  const [deleteEntry] = useDeleteEntryMutation()
  const [deleteCertificate] = useDeleteCertificateMutation()
  // Each opening gets a new key, so an editor always starts from the saved profile.
  const [dialog, setDialog] = useState({ type: null, entry: null, key: 0 })
  const [deleting, setDeleting] = useState(null)
  const [message, setMessage] = useState('')
  const [photoError, setPhotoError] = useState('')

  const openDialog = (type, entry = null) => {
    setMessage('')
    setDialog((current) => ({ type, entry, key: current.key + 1 }))
  }
  const closeDialog = () => setDialog((current) => ({ ...current, type: null }))
  const saved = () => {
    closeDialog()
    setMessage(t('profile:saved'))
  }
  const month = (value) => format.month(value)
  const period = (entry, ongoing, ongoingLabel) => t('profile:period', { start: month(entry.start), end: entry[ongoing] ? ongoingLabel : month(entry.end) })
  const { location, salaryMin, links } = profile

  async function handlePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkUpload(file, photoRule)
    setPhotoError(problem ? photoText.problem(problem, file) : '')
    if (problem) return
    try {
      await uploadPhoto(file).unwrap()
      setMessage(t('profile:saved'))
    } catch (failure) {
      setPhotoError(errorText.code(failure))
    }
  }

  async function confirmDelete() {
    const { kind, entry } = deleting
    setDeleting(null)
    if (kind === 'certificates') await deleteCertificate(entry.id)
    else await deleteEntry({ kind, id: entry.id })
  }

  const entryKinds = [
    {
      kind: 'work-history',
      list: profile.workHistory,
      none: profile.noWorkExperience,
      section: 'workHistory',
      title: (entry) => `${entry.title} · ${entry.employer}`,
      meta: (entry) => period(entry, 'current', t('profile:present')),
    },
    {
      kind: 'education',
      list: profile.education,
      none: profile.noFormalQualification,
      section: 'education',
      title: (entry) => `${entry.degree} · ${entry.institution}`,
      meta: (entry) => period(entry, 'stillStudying', t('profile:stillStudying')),
    },
  ]

  return (
    <>
      <PageTitle
        title={t('profile:title')}
        description={t('profile:description')}
        actions={
          <Button leftIcon={<Icon as={SquarePen} size={20} />} onClick={() => openDialog('core')}>
            {t('profile:edit')}
          </Button>
        }
      />

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <div className={styles.layout}>
        <Panel padding={32} className={styles.main}>
          <div className={styles.identity}>
            <Avatar name={profile.fullName} src={profile.photoUrl ?? undefined} size={80} />
            <div className={styles.who}>
              <h2 className={styles.name}>{profile.fullName}</h2>
              {profile.headline && <p className={styles.headline}>{profile.headline}</p>}
              {location && (
                <p className={styles.location}>
                  <Icon as={MapPin} size={12} />
                  {t('common:city.value', { city: location.city, country: format.country(location.countryCode) })}
                </p>
              )}
            </div>
            <PillBadge tone={profile.availability === 'not_looking' ? 'neutral' : 'success'} dot>
              {t(`enums:availability.${profile.availability}`)}
            </PillBadge>
          </div>
          <div className={styles.photoActions}>
            <input ref={photoInput} type="file" name="photo" className="sr-only" accept={photoRule?.types.map((type) => `.${type}`).join(',')} onChange={handlePhoto} />
            <Button variant="secondary" size="sm" loading={uploadingPhoto} leftIcon={<Icon as={Upload} size={14} />} onClick={() => photoInput.current.click()}>
              {t(profile.photoUrl ? 'profile:photo.change' : 'profile:photo.upload')}
            </Button>
            {profile.photoUrl && (
              <Button variant="ghost" size="sm" onClick={() => removePhoto()}>
                {t('profile:photo.remove')}
              </Button>
            )}
            <span className={styles.photoHint}>{t('profile:photo.hint', { limits: photoText.limits })}</span>
          </div>
          {photoError && (
            <p className={styles.error} role="alert">
              {photoError}
            </p>
          )}

          <Section name="about" title={t('profile:about.title')}>
            <p className={styles.about}>{profile.about || t('profile:about.empty')}</p>
          </Section>

          <Section name="strengths" title={t('profile:strengths.title')}>
            {profile.yearsExperience == null && profile.skills.length === 0 ? (
              <p className={styles.detail}>{t('profile:strengths.empty')}</p>
            ) : (
              <>
                {profile.yearsExperience != null && <p className={styles.detail}>{t('profile:strengths.years', { count: profile.yearsExperience })}</p>}
                <ul className={styles.tags}>
                  {profile.skills.map((skill) => (
                    <li key={skill}>
                      <PillBadge tone="primary">{skill}</PillBadge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {entryKinds.map(({ kind, list, none, section, title, meta }) => (
            <Section
              key={kind}
              name={kind}
              title={t(`profile:${section}.title`)}
              action={
                <Button variant="secondary" size="sm" leftIcon={<Icon as={Plus} size={14} />} onClick={() => openDialog(kind)}>
                  {t(`profile:${section}.add`)}
                </Button>
              }
            >
              {list.length > 0 ? (
                <ul className={styles.entries}>
                  {list.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      title={title(entry)}
                      meta={meta(entry)}
                      editLabel={t('profile:actions.edit', { name: title(entry) })}
                      deleteLabel={t('profile:actions.delete', { name: title(entry) })}
                      onEdit={() => openDialog(kind, entry)}
                      onDelete={() => setDeleting({ kind, entry, name: title(entry) })}
                    >
                      {entry.description && <p className={styles.entryDescription}>{entry.description}</p>}
                    </EntryRow>
                  ))}
                </ul>
              ) : (
                <>
                  <p className={styles.detail}>{t(`profile:${section}.empty`)}</p>
                  <Checkbox className={styles.none} name={`${kind}-none`} checked={none} onChange={(event) => setNone({ kind, none: event.target.checked })}>
                    {t(`profile:${section}.none`)}
                  </Checkbox>
                </>
              )}
            </Section>
          ))}

          <Section
            name="languages"
            title={t('profile:languages.title')}
            action={
              <Button variant="secondary" size="sm" leftIcon={<Icon as={SquarePen} size={14} />} onClick={() => openDialog('languages')}>
                {t('profile:languages.edit')}
              </Button>
            }
          >
            {profile.languages.length > 0 ? (
              <ul className={styles.tags}>
                {profile.languages.map((entry) => (
                  <li key={entry.code}>
                    <PillBadge>
                      {format.languageName(entry.code)} · {t(`enums:languageLevel.${entry.level}`)}
                    </PillBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.detail}>{t('profile:languages.empty')}</p>
            )}
          </Section>

          <Section
            name="right-to-work"
            title={t('profile:rightToWork.title')}
            action={
              <Button variant="secondary" size="sm" leftIcon={<Icon as={SquarePen} size={14} />} onClick={() => openDialog('rightToWork')}>
                {t('profile:rightToWork.edit')}
              </Button>
            }
          >
            {profile.rightToWork.length > 0 ? (
              <ul className={styles.entries}>
                {profile.rightToWork.map((entry) => (
                  <li key={entry.id} className={styles.entry}>
                    <div className={styles.entryText}>
                      <p className={styles.entryTitle}>
                        {t(`enums:rtwRegion.${entry.region}`)} · {t(`enums:rtwStatus.${entry.status}`)}
                      </p>
                      {entry.permitExpiresOn && <p className={styles.entryMeta}>{t('profile:rightToWork.validUntil', { date: format.date(entry.permitExpiresOn) })}</p>}
                    </div>
                    {entry.permitExpired && <PillBadge tone="warning">{t('profile:rightToWork.expired')}</PillBadge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.detail}>{t('profile:rightToWork.empty')}</p>
            )}
          </Section>

          <Section
            name="links"
            title={t('profile:links.title')}
            action={
              <Button variant="secondary" size="sm" leftIcon={<Icon as={SquarePen} size={14} />} onClick={() => openDialog('links')}>
                {t('profile:links.edit')}
              </Button>
            }
          >
            {links.linkedin || links.portfolio ? (
              <ul className={styles.linkList}>
                {['linkedin', 'portfolio']
                  .filter((name) => links[name])
                  .map((name) => (
                    <li key={name}>
                      <Icon as={Link2} size={14} />
                      <span className={styles.linkLabel}>{t(`profile:links.${name}`)}</span>
                      <a href={links[name]} target="_blank" rel="noopener noreferrer">
                        {links[name]}
                      </a>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className={styles.detail}>{t('profile:links.empty')}</p>
            )}
          </Section>

          <Section
            name="certificates"
            title={t('profile:certificates.title')}
            action={
              <Button variant="secondary" size="sm" leftIcon={<Icon as={Plus} size={14} />} onClick={() => openDialog('certificate')}>
                {t('profile:certificates.add')}
              </Button>
            }
          >
            {profile.certificates.length > 0 ? (
              <ul className={styles.entries}>
                {profile.certificates.map((certificate) => (
                  <EntryRow
                    key={certificate.id}
                    title={`${certificate.name} · ${certificate.issuer}`}
                    meta={[
                      t('profile:certificates.issued', { date: month(certificate.issuedOn) }),
                      certificate.expiresOn && t('profile:certificates.expires', { date: month(certificate.expiresOn) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    editLabel={t('profile:actions.edit', { name: certificate.name })}
                    deleteLabel={t('profile:actions.delete', { name: certificate.name })}
                    onEdit={() => openDialog('certificate', certificate)}
                    onDelete={() => setDeleting({ kind: 'certificates', entry: certificate, name: certificate.name })}
                  >
                    <p className={styles.certificateLinks}>
                      {certificate.url && (
                        <a href={certificate.url} target="_blank" rel="noopener noreferrer">
                          {t('profile:certificates.link')}
                        </a>
                      )}
                      {certificate.file && (
                        <a href={certificate.file.url} target="_blank" rel="noopener noreferrer">
                          {t('profile:certificates.file')}
                        </a>
                      )}
                    </p>
                  </EntryRow>
                ))}
              </ul>
            ) : (
              <p className={styles.detail}>{t('profile:certificates.empty')}</p>
            )}
          </Section>

          <Section name="next-step" title={t('profile:nextStep.title')}>
            <ul className={cx(styles.tags, styles.nextStep)}>
              {profile.workPreference && (
                <li>
                  <PillBadge>
                    <Icon as={Earth} size={12} />
                    {t(`enums:workPreference.${profile.workPreference}`)}
                  </PillBadge>
                </li>
              )}
              {salaryMin && (
                <li>
                  <PillBadge>
                    {t('profile:nextStep.salary', {
                      amount: format.salary({ min: salaryMin.amount, currency: salaryMin.currency }),
                      period: t(`enums:salaryPeriod.${salaryMin.period}`),
                    })}
                  </PillBadge>
                </li>
              )}
            </ul>
          </Section>
        </Panel>

        <aside className={styles.side}>
          <Panel padding={24}>
            <CompletenessChecklist completeness={profile.completeness} heading={<h2 className={styles.sectionTitle}>{t('completeness:title')}</h2>} />
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('profile:resume.title')}</h2>
            <div className={styles.resumeFile}>
              <Icon as={FileText} size={22} className={styles.resumeIcon} />
              <span className={styles.resumeName}>{profile.liveCv ? profile.liveCv.originalName : t('profile:resume.none')}</span>
            </div>
            <Button as={Link} to="/candidate/cv-versions" variant="outline" fullWidth leftIcon={<Icon as={Upload} size={14} />}>
              {t('profile:resume.update')}
            </Button>
          </Panel>

          <section className={styles.control}>
            <Icon as={ShieldCheck} size={22} className={styles.controlIcon} />
            <h2 className={styles.controlTitle}>{t('profile:control.title')}</h2>
            <p className={styles.controlText}>{t('profile:control.text')}</p>
            <Link to="/candidate/settings/privacy" className={styles.controlLink}>
              {t('profile:control.link')}
              <Icon as={ArrowRight} size={12} />
            </Link>
          </section>
        </aside>
      </div>

      <EditProfileModal key={`core-${dialog.key}`} open={dialog.type === 'core'} profile={profile} onSaved={saved} onClose={closeDialog} />
      {entryKinds.map(({ kind }) => (
        <EntryDialog key={`${kind}-${dialog.key}`} open={dialog.type === kind} kind={kind} entry={dialog.entry} onSaved={saved} onClose={closeDialog} />
      ))}
      <LanguagesDialog key={`languages-${dialog.key}`} open={dialog.type === 'languages'} languages={profile.languages} onSaved={saved} onClose={closeDialog} />
      <RightToWorkDialog key={`rtw-${dialog.key}`} open={dialog.type === 'rightToWork'} rightToWork={profile.rightToWork} onSaved={saved} onClose={closeDialog} />
      <LinksDialog key={`links-${dialog.key}`} open={dialog.type === 'links'} links={links} onSaved={saved} onClose={closeDialog} />
      <CertificateDialog key={`certificate-${dialog.key}`} open={dialog.type === 'certificate'} certificate={dialog.entry} onSaved={saved} onClose={closeDialog} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('profile:deleteDialog.title')}
        confirmLabel={t('profile:deleteDialog.confirm')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        <p className={styles.detail}>{deleting && t('profile:deleteDialog.body', { name: deleting.name })}</p>
      </ConfirmDialog>
    </>
  )
}
