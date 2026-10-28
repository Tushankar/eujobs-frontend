import { ADMIN_USERS } from '../../shared/data/users.js'

/* Mock data for Admin > Access management. Copy mirrors the Figma frames. */

/** The permission matrix shown in "Create custom role" and "Manage access". */
export const PERMISSION_GROUPS = [
  {
    id: 'people',
    label: 'People',
    permissions: [
      { id: 'users.view', label: 'View users', description: 'View employee and platform user records.' },
      { id: 'users.add', label: 'Add users', description: 'Create or invite a new user record.' },
      { id: 'users.edit', label: 'Edit users', description: 'Update user details and account status.' },
      { id: 'users.deactivate', label: 'Deactivate users', description: 'Suspend or deactivate an existing user.' },
    ],
  },
  {
    id: 'roles',
    label: 'Roles & access',
    permissions: [
      { id: 'roles.view', label: 'View roles', description: 'Review roles, assignments, and effective access.' },
      { id: 'roles.create', label: 'Create roles', description: 'Create reusable custom roles.' },
      { id: 'roles.edit', label: 'Edit roles', description: 'Change custom-role details and permissions.' },
      { id: 'roles.archive', label: 'Archive roles', description: 'Archive an unused custom role.' },
      { id: 'roles.assign', label: 'Assign roles', description: 'Assign, replace, or revoke user access.' },
    ],
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    permissions: [
      { id: 'jobs.manage', label: 'Manage jobs', description: 'Create, edit, publish, and pause jobs.' },
      { id: 'candidates.view', label: 'View candidates', description: 'Review candidate profiles and applications.' },
      { id: 'pipeline.manage', label: 'Manage hiring pipeline', description: 'Move candidates and manage recruitment stages.' },
      { id: 'company.edit', label: 'Edit company profile', description: 'Update employer information and branding.' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & reporting',
    permissions: [
      { id: 'finance.view', label: 'View finance', description: 'View billing and finance-related information.' },
      { id: 'finance.approve', label: 'Approve finance activity', description: 'Approve finance-related changes and requests.' },
      { id: 'reports.view', label: 'View reports', description: 'Review platform and operational reports.' },
      { id: 'reports.export', label: 'Export reports', description: 'Download report and activity data.' },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    permissions: [
      { id: 'moderation.manage', label: 'Manage moderation', description: 'Review account and content moderation cases.' },
      { id: 'audit.view', label: 'View audit log', description: 'Inspect recorded administrative activity.' },
      { id: 'learning.manage', label: 'Manage learning', description: 'Create, edit, and publish learning content.' },
    ],
  },
]

/** Flat permission list in matrix order (the Manage access tiles read left to right in this order). */
export const PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions)

export const ACCESS_SCOPES = ['Organization', 'Department', 'Finance department', 'Team']

export const SYSTEM_ROLES = [
  {
    id: 'manager',
    name: 'Manager',
    description: 'Supervises a team, manages recruitment activity, and reviews operational reporting.',
    scope: 'Department',
    system: true,
    permissions: [
      'users.view',
      'users.edit',
      'roles.view',
      'roles.assign',
      'jobs.manage',
      'candidates.view',
      'pipeline.manage',
      'company.edit',
      'reports.view',
    ],
  },
  {
    id: 'accounts-head',
    name: 'Accounts Head',
    description: 'Oversees finance information, approvals, and financial reporting.',
    scope: 'Finance department',
    system: true,
    permissions: ['users.view', 'roles.view', 'finance.view', 'finance.approve', 'reports.view', 'reports.export', 'audit.view'],
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Provides limited operational access for day-to-day responsibilities.',
    scope: 'Department',
    system: true,
    permissions: ['users.view', 'candidates.view'],
  },
]

/** Accounts listed in User access: identity comes from the shared admin directory, the access state is the Figma default. */
export const DEFAULT_USER_ACCESS = {
  'sarah-miller': { roleId: 'manager', department: 'Talent', granted: [], removed: [] },
}

const FIGMA_ORDER = ['alex-morgan', 'sarah-miller', 'emma-wilson', 'james-chen']
const rank = (id) => (FIGMA_ORDER.includes(id) ? FIGMA_ORDER.indexOf(id) : FIGMA_ORDER.length)

export const ACCESS_USERS = ADMIN_USERS.map((user) => ({ id: user.id, name: user.name, email: user.email, platform: user.role })).sort(
  (a, b) => rank(a.id) - rank(b.id),
)
