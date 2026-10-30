import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { signOut, SIGN_IN_PATH } from '@/app/session.js'
import { usePreferences } from '@/lib/preferences.js'
import { useAcceptLegalMutation } from '../api.js'

const keepOpen = () => {}

/** U22: a newer Terms or Privacy version blocks the workspace until it is accepted (or the user signs out). */
export default function LegalAcceptDialog() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const [accept, { isLoading }] = useAcceptLegalMutation()

  return (
    <Modal
      open={Boolean(me?.legal.acceptRequired)}
      onClose={keepOpen}
      dismissible={false}
      title={t('legal:reaccept.title')}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              signOut()
              navigate(SIGN_IN_PATH[me.role])
            }}
          >
            {t('shell:signOut')}
          </Button>
          <Button onClick={() => accept()} loading={isLoading}>
            {t('legal:reaccept.accept')}
          </Button>
        </>
      }
    >
      <p>
        <Trans
          i18nKey="legal:reaccept.text"
          components={{ terms: <Link to="/legal/terms" target="_blank" />, privacy: <Link to="/legal/privacy" target="_blank" /> }}
        />
      </p>
    </Modal>
  )
}
