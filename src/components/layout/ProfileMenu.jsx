import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Earth, MapPin, Users } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Dropdown, Icon } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import { LOCATIONS, useWorkspacePreferences } from './WorkspacePreferences.jsx'
import styles from './ProfileMenu.module.css'

/** Avatar dropdown (Figma "Menu - Profile menu"): identity, profile link, location and language rows. */
export default function ProfileMenu({ workspace }) {
  const { location, setLocation, language } = useWorkspacePreferences()
  const [locationOpen, setLocationOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const { user, profilePath } = workspace

  return (
    <Dropdown
      trigger={(props) => (
        <button type="button" className={styles.trigger} aria-label="Open profile menu" {...props}>
          <img src={workspace.headerAvatar} alt="" width={32} height={32} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.menu}>
          <div className={styles.identity}>
            <p className={styles.name}>{user.name}</p>
            <p className={styles.role}>{workspace.label} workspace</p>
          </div>

          <div className={styles.body}>
            {profilePath && (
              <Link to={workspacePath(workspace, profilePath)} className={styles.row} onClick={close}>
                <Icon as={Users} size={16} />
                <span className={styles.rowLabel}>Profile</span>
                <Icon as={ChevronRight} size={14} />
              </Link>
            )}

            {workspace.showLocation && (
              <>
                <button
                  type="button"
                  className={cx(styles.row, styles.rowTall)}
                  aria-expanded={locationOpen}
                  onClick={() => setLocationOpen((current) => !current)}
                >
                  <Icon as={MapPin} size={16} />
                  <span className={styles.rowLabel}>Location</span>
                  <span className={styles.rowValue}>{location}</span>
                  <Icon as={ChevronDown} size={14} className={cx(locationOpen && styles.flipped)} />
                </button>
                {locationOpen && (
                  <div className={styles.options}>
                    {LOCATIONS.filter((option) => option !== location).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={styles.option}
                        onClick={() => {
                          setLocation(option)
                          setLocationOpen(false)
                        }}
                      >
                        {option}
                      </button>
                    ))}
                    <p className={styles.optionsNote}>Local marketplace preference for this workspace.</p>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              className={styles.row}
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen((current) => !current)}
            >
              <Icon as={Earth} size={16} />
              <span className={styles.rowLabel}>Languages</span>
              <span className={styles.rowValue}>{language}</span>
              <Icon as={ChevronDown} size={14} className={cx(languageOpen && styles.flipped)} />
            </button>
            {languageOpen && (
              <div className={styles.options}>
                <button type="button" className={styles.option} onClick={() => setLanguageOpen(false)}>
                  {language}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Dropdown>
  )
}
