import aiNavIcon from '@/assets/icons/ai-nav.svg'
import { useActiveApplicationsBadge } from '@/features/candidate/applications/api.js'
import { useUnreadMessagesBadge } from '@/features/messages/api.js'
import { useProfileCompletionBadge } from '@/features/candidate/profile/api.js'

/*
 * Per-role workspace configuration: sidebar navigation and header variant, as seen in the Figma
 * Overview frames for each role. Labels are `shell:nav.<key>` translations; identity comes from /me.
 * `to` is relative to the workspace basePath ('' = the overview/index route). `entitlement` marks a page that
 * shows a plan chip to candidates without it (M-118).
 * `vuesax` names the Figma "D S › Outlined" vuesax/linear icon of an item (assets/icons/nav, owner 2026-11-13);
 * `iconSrc` is the custom Figma AI glyph.
 */
export const WORKSPACES = {
  candidate: {
    id: 'candidate',
    basePath: '/candidate',
    signInPath: '/sign-in',
    showLocation: true,
    profilePath: 'profile',
    // M-196: Free sees the Plus upsell; Plus with an incomplete profile is sent to the checklist.
    promo: { to: 'profile' },
    nav: [
      { key: 'overview', to: '', vuesax: 'element-3', end: true },
      { key: 'findJobs', to: 'jobs', vuesax: 'search-normal' },
      { key: 'applications', to: 'applications', vuesax: 'briefcase', badge: { useText: useActiveApplicationsBadge } },
      { key: 'messages', to: 'messages', vuesax: 'messages-2', badge: { useText: useUnreadMessagesBadge } },
      { key: 'jobAlerts', to: 'job-alerts', vuesax: 'notification', entitlement: 'job_alerts' },
      { key: 'myProfile', to: 'profile', vuesax: 'profile-circle', badge: { useText: useProfileCompletionBadge } },
      { key: 'cvVersions', to: 'cv-versions', vuesax: 'document-text' },
      { key: 'verification', to: 'verification', vuesax: 'shield-tick' },
      { key: 'aiInsights', to: 'ai-insights', iconSrc: aiNavIcon, badge: { textKey: 'nav.aiBadge', tone: 'ai' }, entitlement: 'ai' },
      { key: 'learning', to: 'learning', vuesax: 'teacher' },
    ],
  },
  recruiter: {
    id: 'recruiter',
    basePath: '/recruiter',
    signInPath: '/recruiter/sign-in',
    showLocation: true,
    profilePath: 'company',
    nav: [
      { key: 'overview', to: '', vuesax: 'element-3', end: true },
      { key: 'jobs', to: 'jobs', vuesax: 'briefcase' },
      { key: 'findCandidates', to: 'find-candidates', vuesax: 'user-search' },
      // §3.22: Shortlists need Recruiter Plus (`discovery`); without it the item shows the plan chip and the page the gate.
      { key: 'shortlists', to: 'shortlists', vuesax: 'bookmark', entitlement: 'discovery' },
      { key: 'applications', to: 'applications', vuesax: 'document-text' },
      { key: 'messages', to: 'messages', vuesax: 'messages-2', badge: { useText: useUnreadMessagesBadge } },
      { key: 'hiringPipeline', to: 'hiring-pipeline', vuesax: 'kanban' },
      { key: 'recruiterLearning', to: 'learning', vuesax: 'teacher' },
      { key: 'company', to: 'company', vuesax: 'buildings' },
    ],
  },
  admin: {
    id: 'admin',
    basePath: '/admin',
    signInPath: '/admin/sign-in',
    // Admins have no country picker (M-138).
    showLocation: false,
    profilePath: 'settings',
    // `permission` opens the page (§3.13); without it the item is hidden and a direct URL shows the 403 page (M-155).
    nav: [
      { key: 'overview', to: '', vuesax: 'element-3', end: true, permission: 'dashboard.view' },
      { key: 'candidates', to: 'candidates', vuesax: 'profile-2user', permission: 'users.view' },
      { key: 'recruiters', to: 'recruiters', vuesax: 'user-square', permission: 'users.view' },
      { key: 'jobs', to: 'jobs', vuesax: 'briefcase', permission: 'jobs.view' },
      { key: 'applications', to: 'applications', vuesax: 'document-text', permission: 'candidates.view' },
      { key: 'recruitment', to: 'recruitment', vuesax: 'kanban', permission: 'candidates.view' },
      { key: 'accessManagement', to: 'access-management', vuesax: 'security-user', permission: 'roles.view' },
      { key: 'courses', to: 'courses', vuesax: 'book', permission: 'learning.view' },
      { key: 'payments', to: 'payments', vuesax: 'card', permission: 'finance.view' },
      { key: 'aiMatching', to: 'ai-matching', iconSrc: aiNavIcon, permission: 'ai.view' },
      { key: 'analytics', to: 'analytics', vuesax: 'trend-up', permission: 'reports.view' },
      { key: 'reports', to: 'reports', vuesax: 'chart', permission: 'reports.view' },
      { key: 'moderation', to: 'moderation', vuesax: 'shield-tick', permission: 'moderation.manage' },
      // 2026-11-13: the public website's blog and newsletter subscribers
      { key: 'website', to: 'website', vuesax: 'global', permission: 'content.view' },
      { key: 'auditLogs', to: 'audit-logs', vuesax: 'clock', permission: 'audit.view' },
    ],
  },
}

/** Absolute path for a nav item (or any workspace-relative `to`). */
export function workspacePath(workspace, to = '') {
  return to ? `${workspace.basePath}/${to}` : workspace.basePath
}
