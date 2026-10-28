import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Earth, FileText, GraduationCap, MapPin, ShieldCheck, SquarePen, Upload } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { cx } from '@/utils/cx.js'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import { CV_STORAGE_KEY, INITIAL_CV } from '../../cv/data/cvVersions.js'
import EditProfileModal from '../components/EditProfileModal.jsx'
import JobSummaryModal from '../components/JobSummaryModal.jsx'
import { INITIAL_PROFILE, PROFILE_STORAGE_KEY } from '../data/profile.js'
import { experienceLabel, initialsOf, salaryLabel } from '../utils/profileText.js'
import styles from './ProfilePage.module.css'

/** "My profile": the candidate's story, editable through one validated dialog and saved on this device. */
export default function ProfilePage() {
  const [profile, setProfile] = useLocalStorage(PROFILE_STORAGE_KEY, INITIAL_PROFILE)
  const [cv] = useLocalStorage(CV_STORAGE_KEY, INITIAL_CV)
  const [editing, setEditing] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [message, setMessage] = useState('')

  const liveCv = cv.versions.find((version) => version.id === cv.liveId)
  const salary = profile ? salaryLabel(profile.salaryMin) : null

  function handleSave(next) {
    setProfile(next)
    setEditing(false)
    setMessage('Profile saved on this device.')
  }

  return (
    <>
      <PageTitle
        title="A profile that feels like you."
        description="Your experience is more than a list. Tell the story behind it."
        actions={
          <div className={styles.actions}>
            {profile && (
              <Button variant="outline" className={styles.aiButton} onClick={() => setSummaryOpen(true)}>
                <img src={aiSparkle} alt="" width={16} height={16} />
                Ai Job Summary
              </Button>
            )}
            <Button leftIcon={<Icon as={SquarePen} size={20} />} onClick={() => setEditing(true)}>
              {profile ? 'Edit profile' : 'Create profile'}
            </Button>
          </div>
        }
      />

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <div className={styles.layout}>
        {profile ? (
          <Panel padding={32} className={styles.main}>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">
                {initialsOf(profile.name)}
              </span>
              <div className={styles.who}>
                <h2 className={styles.name}>{profile.name}</h2>
                <p className={styles.headline}>{profile.headline}</p>
                <p className={styles.location}>
                  <Icon as={MapPin} size={12} />
                  {profile.location}
                </p>
              </div>
              {profile.openToOpportunities && (
                <PillBadge tone="success" dot>
                  Open to opportunities
                </PillBadge>
              )}
            </div>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>A little about me</h2>
              <p className={styles.about}>{profile.about}</p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Experience &amp; strengths</h2>
              <p className={styles.detail}>{experienceLabel(profile.yearsExperience)}</p>
              <ul className={styles.tags}>
                {profile.skills.map((skill) => (
                  <li key={skill}>
                    <PillBadge tone="primary">{skill}</PillBadge>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Education</h2>
              <p className={styles.education}>
                <Icon as={GraduationCap} size={18} />
                {profile.degree} · {profile.institution}
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>The right next step</h2>
              <ul className={cx(styles.tags, styles.nextStep)}>
                <li>
                  <PillBadge>
                    <Icon as={Earth} size={12} />
                    {profile.workMode}
                  </PillBadge>
                </li>
                {salary && (
                  <li>
                    <PillBadge>{salary}</PillBadge>
                  </li>
                )}
              </ul>
            </section>
          </Panel>
        ) : (
          <EmptyState
            icon={FileText}
            title="No profile information is stored on this device"
            description="Your profile was deleted from this browser. Create a new one to see it here."
            action={<Button onClick={() => setEditing(true)}>Create profile</Button>}
          />
        )}

        <aside className={styles.side}>
          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>Your resume</h2>
            <div className={styles.resumeFile}>
              <Icon as={FileText} size={22} className={styles.resumeIcon} />
              <span className={styles.resumeName}>{liveCv ? liveCv.fileName : 'No resume on this device yet'}</span>
            </div>
            <Button as={Link} to="/candidate/cv-versions" variant="outline" fullWidth leftIcon={<Icon as={Upload} size={14} />}>
              Update resume
            </Button>
          </Panel>

          <section className={styles.control}>
            <Icon as={ShieldCheck} size={22} className={styles.controlIcon} />
            <h2 className={styles.controlTitle}>Your story. Your control.</h2>
            <p className={styles.controlText}>Choose who can discover your profile and when your resume is shared.</p>
            <Link to="/candidate/settings/privacy" className={styles.controlLink}>
              Manage privacy
              <Icon as={ArrowRight} size={12} />
            </Link>
          </section>
        </aside>
      </div>

      <EditProfileModal open={editing} profile={profile} onSave={handleSave} onClose={() => setEditing(false)} />
      <JobSummaryModal open={summaryOpen} profile={profile} onClose={() => setSummaryOpen(false)} />
    </>
  )
}
