import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useGetPrivacyQuery, useUpdatePrivacyMutation } from '../api.js'
import SettingsCard from '../components/SettingsCard.jsx'
import ToggleRow from '../components/ToggleRow.jsx'
import styles from './SettingsPage.module.css'

// M-187: the three flags, enforced by discovery, CV access and matching.
const FLAGS = ['discoverable', 'resumeVisible', 'matchingConsent']

/** Settings > Privacy & visibility: each switch is saved on the server at once. */
export default function PrivacySettingsPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: privacy } = useGetPrivacyQuery()
  const [updatePrivacy] = useUpdatePrivacyMutation()
  const [failure, setFailure] = useState(null)

  async function toggle(flag, checked) {
    setFailure(null)
    try {
      await updatePrivacy({ [flag]: checked }).unwrap()
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <SettingsCard title={t('account:privacy.title')} description={t('account:privacy.description')}>
      {privacy && (
        <ul className={styles.list}>
          {FLAGS.map((flag) => (
            <ToggleRow
              key={flag}
              label={t(`account:privacy.${flag}.label`)}
              description={t(`account:privacy.${flag}.description`)}
              checked={privacy[flag]}
              onChange={(checked) => toggle(flag, checked)}
            />
          ))}
        </ul>
      )}
      {failure && <p role="alert">{errorText.code(failure)}</p>}
      <p className={styles.note}>
        <Icon as={ShieldCheck} size={15} />
        {t('account:privacy.note')}
      </p>
    </SettingsCard>
  )
}
