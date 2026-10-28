import {
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Clock,
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
import candidateAvatar from '@/assets/images/avatar-candidate.svg'
import recruiterAvatar from '@/assets/images/avatar-recruiter.svg'
import { useActiveApplicationsBadge } from '@/features/candidate/jobs/hooks/useApplications.js'

/*
 * Per-role workspace configuration: sidebar navigation, identity block and header
 * variant, as seen in the Figma Overview frames for each role.
 * `to` is relative to the workspace basePath ('' = the overview/index route).
 * Nav icons are the lucide equivalents of the exported Figma SVGs (verified on a
 * contact sheet); `iconSrc` is used where Figma ships a custom (non-Lucide) glyph.
 */
export const WORKSPACES = {
  candidate: {
    id: 'candidate',
    label: 'Candidate',
    basePath: '/candidate',
    signInPath: '/sign-in',
    user: { name: 'Alex Morgan', subtitle: 'Personal account', avatar: candidateAvatar },
    headerAvatar: candidateAvatar,
    showWorkspaceSwitch: true,
    showLocation: true,
    profilePath: 'profile',
    promo: {
      title: 'Your next move, smarter.',
      text: 'A stronger profile means more relevant opportunities.',
      linkLabel: 'Complete your profile',
      to: 'onboarding/story',
    },
    nav: [
      { label: 'Overview', to: '', icon: LayoutDashboard, end: true },
      { label: 'Find jobs', to: 'jobs', icon: Search },
      { label: 'Applications', to: 'applications', icon: BriefcaseBusiness, badge: { useText: useActiveApplicationsBadge } },
      { label: 'Job alerts', to: 'job-alerts', icon: Bell },
      { label: 'My profile', to: 'profile', icon: Users },
      { label: 'CV & versions', to: 'cv-versions', icon: FileText },
      { label: 'Verification', to: 'verification', icon: ShieldCheck },
      { label: 'AI insights', to: 'ai-insights', iconSrc: aiNavIcon, badge: { text: 'AI', tone: 'ai' } },
      { label: 'Learning', to: 'learning', icon: GraduationCap },
    ],
  },
  recruiter: {
    id: 'recruiter',
    label: 'Recruiter',
    basePath: '/recruiter',
    signInPath: '/recruiter/sign-in',
    user: { name: 'Sarah Miller', subtitle: 'Acme Studio', avatar: recruiterAvatar },
    headerAvatar: recruiterAvatar,
    showWorkspaceSwitch: true,
    showLocation: true,
    profilePath: 'company',
    nav: [
      { label: 'Overview', to: '', icon: LayoutDashboard, end: true },
      { label: 'Jobs', to: 'jobs', icon: BriefcaseBusiness },
      { label: 'Find candidates', to: 'find-candidates', icon: Search },
      { label: 'Shortlists', to: 'shortlists', icon: Bookmark },
      { label: 'Applications', to: 'applications', icon: FileText },
      { label: 'Hiring pipeline', to: 'hiring-pipeline', icon: Layers },
      { label: 'Recruiter learning', to: 'learning', icon: GraduationCap },
      { label: 'Company', to: 'company', icon: Building2 },
    ],
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    basePath: '/admin',
    signInPath: '/admin/sign-in',
    user: { name: 'Workspace admin', subtitle: 'Acme Studio', avatar: candidateAvatar },
    headerAvatar: candidateAvatar,
    showWorkspaceSwitch: false,
    showLocation: false,
    profilePath: 'settings',
    nav: [
      { label: 'Overview', to: '', icon: LayoutDashboard, end: true },
      { label: 'Candidates', to: 'candidates', icon: Users },
      { label: 'Recruiters', to: 'recruiters', icon: BriefcaseBusiness },
      { label: 'Jobs', to: 'jobs', icon: BriefcaseBusiness },
      { label: 'Applications', to: 'applications', icon: FileText },
      { label: 'Recruitment', to: 'recruitment', icon: Layers },
      { label: 'Access Management', to: 'access-management', iconSrc: accessManagementIcon, activeIcon: ShieldCheck },
      { label: 'Courses', to: 'courses', icon: BookOpen },
      { label: 'AI & matching', to: 'ai-matching', iconSrc: aiNavIcon },
      { label: 'Analytics', to: 'analytics', icon: TrendingUp },
      { label: 'Reports', to: 'reports', icon: FileText },
      { label: 'Moderation', to: 'moderation', icon: ShieldCheck },
      { label: 'Audit logs', to: 'audit-logs', icon: Clock },
    ],
  },
}

/** Absolute path for a nav item (or any workspace-relative `to`). */
export function workspacePath(workspace, to = '') {
  return to ? `${workspace.basePath}/${to}` : workspace.basePath
}
