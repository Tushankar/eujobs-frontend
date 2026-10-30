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
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Bell,
} from 'lucide-react'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import accessManagementIcon from '@/assets/icons/access-management.svg'
import { useActiveApplicationsBadge } from '@/features/candidate/jobs/hooks/useApplications.js'

/*
 * Per-role workspace configuration: sidebar navigation and header variant, as seen in the Figma
 * Overview frames for each role. Labels are `shell:nav.<key>` translations; identity comes from /me.
 * `to` is relative to the workspace basePath ('' = the overview/index route).
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
    promo: { to: 'onboarding/story' },
    nav: [
      { key: 'overview', to: '', icon: LayoutDashboard, end: true },
      { key: 'findJobs', to: 'jobs', icon: Search },
      { key: 'applications', to: 'applications', icon: BriefcaseBusiness, badge: { useText: useActiveApplicationsBadge } },
      { key: 'jobAlerts', to: 'job-alerts', icon: Bell },
      { key: 'myProfile', to: 'profile', icon: Users },
      { key: 'cvVersions', to: 'cv-versions', icon: FileText },
      { key: 'verification', to: 'verification', icon: ShieldCheck },
      { key: 'aiInsights', to: 'ai-insights', iconSrc: aiNavIcon, badge: { textKey: 'nav.aiBadge', tone: 'ai' } },
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
      { key: 'shortlists', to: 'shortlists', icon: Bookmark },
      { key: 'applications', to: 'applications', icon: FileText },
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
    nav: [
      { key: 'overview', to: '', icon: LayoutDashboard, end: true },
      { key: 'candidates', to: 'candidates', icon: Users },
      { key: 'recruiters', to: 'recruiters', icon: BriefcaseBusiness },
      { key: 'jobs', to: 'jobs', icon: BriefcaseBusiness },
      { key: 'applications', to: 'applications', icon: FileText },
      { key: 'recruitment', to: 'recruitment', icon: Layers },
      { key: 'accessManagement', to: 'access-management', iconSrc: accessManagementIcon, activeIcon: ShieldCheck },
      { key: 'courses', to: 'courses', icon: BookOpen },
      { key: 'payments', to: 'payments', icon: CreditCard },
      { key: 'aiMatching', to: 'ai-matching', iconSrc: aiNavIcon },
      { key: 'analytics', to: 'analytics', icon: TrendingUp },
      { key: 'reports', to: 'reports', icon: FileText },
      { key: 'moderation', to: 'moderation', icon: ShieldCheck },
      { key: 'auditLogs', to: 'audit-logs', icon: Clock },
    ],
  },
}

/** Absolute path for a nav item (or any workspace-relative `to`). */
export function workspacePath(workspace, to = '') {
  return to ? `${workspace.basePath}/${to}` : workspace.basePath
}
