import {
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Bell,
} from 'lucide-react'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import accessManagementIcon from '@/assets/icons/access-management.svg'
import { useActiveApplicationsBadge } from '@/features/candidate/applications/api.js'
import { useUnreadMessagesBadge } from '@/features/messages/api.js'
import { useProfileCompletionBadge } from '@/features/candidate/profile/api.js'

/*
 * Per-role workspace configuration: sidebar navigation and header variant, as seen in the Figma
 * Overview frames for each role. Labels are `shell:nav.<key>` translations; identity comes from /me.
 * `to` is relative to the workspace basePath ('' = the overview/index route). `entitlement` marks a page that
 * shows a plan chip to candidates without it (M-118).
 * Nav icons are the lucide equivalents of the exported Figma SVGs (verified on a
 * contact sheet); `iconSrc` is used where Figma ships a custom (non-Lucide) glyph.
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
      { key: 'overview', to: '', icon: LayoutDashboard, end: true },
      { key: 'findJobs', to: 'jobs', icon: Search },
      { key: 'applications', to: 'applications', icon: BriefcaseBusiness, badge: { useText: useActiveApplicationsBadge } },
      { key: 'messages', to: 'messages', icon: MessageSquare, badge: { useText: useUnreadMessagesBadge } },
      { key: 'jobAlerts', to: 'job-alerts', icon: Bell, entitlement: 'job_alerts' },
      { key: 'myProfile', to: 'profile', icon: Users, badge: { useText: useProfileCompletionBadge } },
      { key: 'cvVersions', to: 'cv-versions', icon: FileText },
      { key: 'verification', to: 'verification', icon: ShieldCheck },
      { key: 'aiInsights', to: 'ai-insights', iconSrc: aiNavIcon, badge: { textKey: 'nav.aiBadge', tone: 'ai' }, entitlement: 'ai' },
      { key: 'learning', to: 'learning', icon: GraduationCap },
    ],
  },
  recruiter: {
    id: 'recruiter',
    basePath: '/recruiter',
    signInPath: '/recruiter/sign-in',
    showLocation: true,
    profilePath: 'company',
    nav: [
      { key: 'overview', to: '', icon: LayoutDashboard, end: true },
      { key: 'jobs', to: 'jobs', icon: BriefcaseBusiness },
      { key: 'findCandidates', to: 'find-candidates', icon: Search },
      // §3.22: Shortlists need Recruiter Plus (`discovery`); without it the item shows the plan chip and the page the gate.
      { key: 'shortlists', to: 'shortlists', icon: Bookmark, entitlement: 'discovery' },
      { key: 'applications', to: 'applications', icon: FileText },
      { key: 'messages', to: 'messages', icon: MessageSquare, badge: { useText: useUnreadMessagesBadge } },
      { key: 'hiringPipeline', to: 'hiring-pipeline', icon: Layers },
      { key: 'recruiterLearning', to: 'learning', icon: GraduationCap },
      { key: 'company', to: 'company', icon: Building2 },
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
      { key: 'overview', to: '', icon: LayoutDashboard, end: true, permission: 'dashboard.view' },
      { key: 'candidates', to: 'candidates', icon: Users, permission: 'users.view' },
      { key: 'recruiters', to: 'recruiters', icon: BriefcaseBusiness, permission: 'users.view' },
      { key: 'jobs', to: 'jobs', icon: BriefcaseBusiness, permission: 'jobs.view' },
      { key: 'applications', to: 'applications', icon: FileText, permission: 'candidates.view' },
      { key: 'recruitment', to: 'recruitment', icon: Layers, permission: 'candidates.view' },
      { key: 'accessManagement', to: 'access-management', iconSrc: accessManagementIcon, activeIcon: ShieldCheck, permission: 'roles.view' },
      { key: 'courses', to: 'courses', icon: BookOpen, permission: 'learning.view' },
      { key: 'payments', to: 'payments', icon: CreditCard, permission: 'finance.view' },
      { key: 'aiMatching', to: 'ai-matching', iconSrc: aiNavIcon, permission: 'ai.view' },
      { key: 'analytics', to: 'analytics', icon: TrendingUp, permission: 'reports.view' },
      { key: 'reports', to: 'reports', icon: FileText, permission: 'reports.view' },
      { key: 'moderation', to: 'moderation', icon: ShieldCheck, permission: 'moderation.manage' },
      { key: 'auditLogs', to: 'audit-logs', icon: Clock, permission: 'audit.view' },
    ],
  },
}

/** Absolute path for a nav item (or any workspace-relative `to`). */
export function workspacePath(workspace, to = '') {
  return to ? `${workspace.basePath}/${to}` : workspace.basePath
}
