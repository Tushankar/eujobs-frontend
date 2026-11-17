import { useTranslation } from 'react-i18next'
import { CalendarPlus } from 'lucide-react'
import { Button, Dropdown, Icon } from '@/components/ui'
import { downloadFromApi } from '@/lib/download.js'
import { useGetCalendarLinksQuery } from '../api.js'
import styles from './Cards.module.css'

/** The links load when the menu opens (the panel mounts only then), so the new tab opens on the click itself. */
function CalendarMenu({ interviewId, close }) {
  const { t } = useTranslation()
  const { data } = useGetCalendarLinksQuery(interviewId)
  const external = (key, href) => (
    <li>
      <a className={styles.menuItem} href={href} target="_blank" rel="noopener noreferrer" aria-disabled={!href} onClick={close} data-calendar-link={key}>
        {t(`interviews:calendar.${key}`)}
      </a>
    </li>
  )
  return (
    <ul className={styles.menu}>
      {external('google', data?.google)}
      {external('outlook', data?.outlook)}
      <li>
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            close()
            downloadFromApi(`/interviews/${interviewId}/calendar`)
          }}
          data-calendar-link="ics"
        >
          {t('interviews:calendar.ics')}
        </button>
      </li>
    </ul>
  )
}

/** "Add to calendar" on a booked interview: Google Calendar, Outlook.com or an .ics file (owner 2026-11-17). */
export default function AddToCalendar({ interviewId }) {
  const { t } = useTranslation()
  return (
    <Dropdown
      align="start"
      panelClassName={styles.menuPanel}
      trigger={(props) => (
        <Button variant="outline" leftIcon={<Icon as={CalendarPlus} size={14} />} data-add-calendar {...props}>
          {t('interviews:card.addToCalendar')}
        </Button>
      )}
    >
      {({ close }) => <CalendarMenu interviewId={interviewId} close={close} />}
    </Dropdown>
  )
}
