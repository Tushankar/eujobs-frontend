import { ACTIVITY_BY_RANGE, ANALYTICS_STATS, DEMANDED_SKILLS } from '@/features/admin/analytics/data/analytics.js'

/** Report types the admin can export. `rows()` returns the CSV data section (header row first). */
export const REPORT_TYPES = [
  {
    id: 'marketplace-summary',
    label: 'Marketplace summary',
    rows: () => [['Metric', 'Value', 'Context'], ...ANALYTICS_STATS.map((stat) => [stat.label, stat.value, stat.caption])],
  },
  {
    id: 'skills-demand',
    label: 'Most demanded skills',
    rows: () => [['Skill', 'Job requirements naming it'], ...DEMANDED_SKILLS.map((skill) => [skill.name, skill.count])],
  },
  {
    id: 'platform-activity',
    label: 'Platform activity (this week, illustrative)',
    rows: () => {
      const { labels, registrations, applications } = ACTIVITY_BY_RANGE['this-week']
      return [['Day', 'Registrations', 'Applications'], ...labels.map((label, index) => [label, registrations[index], applications[index]])]
    },
  },
]

export const MAX_BRIEF_LENGTH = 500

/** CSV rows for one report: a small header block (what, when, context), a blank line, then the data. */
export function buildReportRows({ typeId, brief, voiceNote, generatedAt }) {
  const type = REPORT_TYPES.find((candidate) => candidate.id === typeId)
  return [
    ['Report', type.label],
    ['Generated', generatedAt],
    ['Scope', 'Current local workspace'],
    ['Brief', brief || '(none)'],
    ['Voice note file name', voiceNote || '(none)'],
    [],
    ...type.rows(),
  ]
}

export function reportFilename(typeId, generatedAt) {
  return `${typeId}-${generatedAt.slice(0, 10)}.csv`
}
