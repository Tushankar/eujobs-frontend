import { Link } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { Button, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'

/**
 * The admin sidebar and profile menu link to Settings, but the Figma file has no admin settings frame
 * (only candidate and recruiter settings exist). Rather than invent a screen, say so and link back.
 */
export default function AdminSettingsPage() {
  return (
    <>
      <PageTitle title="Settings" description="Workspace settings for administrators." />
      <Panel padding={24} style={{ marginTop: 32 }}>
        <EmptyState
          icon={Settings2}
          title="Admin settings are not part of the supplied design"
          description="The design file includes settings for candidates and recruiters only. Admin controls live on the Access management, AI & matching and Audit logs pages."
          action={
            <Button as={Link} to="/admin/access-management" variant="outline">
              Open access management
            </Button>
          }
        />
      </Panel>
    </>
  )
}
