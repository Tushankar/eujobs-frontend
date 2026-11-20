/*
 * The product tour of each workspace (texts: tour:<role>.steps.<key>). A step first points at its sidebar item;
 * "Take me there" opens `to` and moves the spotlight to `target` on that page (a centred card when it is not shown).
 * `done` is where the last dialog's main action leads.
 */
export const TOURS = {
  candidate: {
    steps: [
      { key: 'cv', to: 'cv-versions', target: '[data-tour="cv-upload"]' },
      { key: 'profile', to: 'profile', target: '[data-tour="profile-edit"]' },
      { key: 'jobs', to: 'jobs', target: '[data-tour="jobs-search"]' },
      { key: 'applications', to: 'applications', target: '[data-get-started]' },
    ],
    done: 'cv-versions',
  },
  recruiter: {
    steps: [
      { key: 'company', to: 'company', target: '[data-tour="company-card"]' },
      { key: 'jobs', to: 'jobs', target: '[data-tour="job-create"]' },
      { key: 'candidates', to: 'find-candidates', target: '[data-tour="candidates-search"]' },
      { key: 'pipeline', to: 'hiring-pipeline', target: '[data-tour="pipeline-filters"]' },
    ],
    done: 'jobs/new',
  },
  // 2026-11-20: agencies start with their clients and agreement, then post jobs and see placements.
  agency: {
    steps: [
      { key: 'clients', to: 'clients', target: '[data-add-client]' },
      { key: 'agreement', to: 'talent', target: '[data-tour="talent-tabs"]' },
      { key: 'jobs', to: 'jobs', target: '[data-tour="job-create"]' },
      { key: 'placements', to: 'placements', target: '[data-get-started], [data-tour="placements-tabs"]' },
    ],
    done: 'clients',
  },
}
