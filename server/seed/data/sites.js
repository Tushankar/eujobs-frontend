/*
 * 2026-11-24: the starter sector sites (owner-approved mapping). eujobs.careers is the main site (CLIENT_ORIGIN), not a
 * row; eujobs.site and eujobs.space redirect to it at the host (client/vercel.json). Admins edit these in admin › Website
 * › Sites. `title` is the hero's first line (the second stays "With EU Jobs"), `text` its intro.
 */
export const SITES = [
  {
    host: 'eujobs.tech',
    sectors: ['it_software', 'engineering'],
    title: { en: 'Find a Tech Job', es: 'Encuentra empleo tech', fr: 'Trouvez un emploi tech' },
    text: {
      en: 'IT, software and engineering jobs across Europe, from first roles to lead positions. Apply with ease and track every step in one place.',
      es: 'Empleos de informática, software e ingeniería en toda Europa, desde el primer puesto hasta puestos de liderazgo. Postula fácilmente y sigue cada paso en un solo lugar.',
      fr: 'Des offres en informatique, logiciel et ingénierie partout en Europe, du premier poste aux postes de direction. Postulez facilement et suivez chaque étape au même endroit.',
    },
  },
  {
    host: 'eujobs.health',
    sectors: ['healthcare'],
    title: { en: 'Find a Healthcare Job', es: 'Encuentra empleo en sanidad', fr: 'Trouvez un emploi dans la santé' },
    text: {
      en: 'Nursing, care and medical jobs across Europe. Apply with ease and track every step in one place.',
      es: 'Empleos de enfermería, cuidados y medicina en toda Europa. Postula fácilmente y sigue cada paso en un solo lugar.',
      fr: 'Des offres en soins infirmiers, accompagnement et médecine partout en Europe. Postulez facilement et suivez chaque étape au même endroit.',
    },
  },
  {
    host: 'eujobs.art',
    sectors: ['arts_culture', 'marketing_media'],
    title: { en: 'Find a Creative Job', es: 'Encuentra empleo creativo', fr: 'Trouvez un emploi créatif' },
    text: {
      en: 'Arts, culture, design and media jobs across Europe. Apply with ease and track every step in one place.',
      es: 'Empleos de arte, cultura, diseño y medios en toda Europa. Postula fácilmente y sigue cada paso en un solo lugar.',
      fr: 'Des offres en arts, culture, design et médias partout en Europe. Postulez facilement et suivez chaque étape au même endroit.',
    },
  },
  {
    host: 'eujobs.foundation',
    sectors: ['charity_nonprofit'],
    employmentTypes: ['volunteer'],
    title: { en: 'Work That Gives Back', es: 'Un trabajo que aporta', fr: 'Un travail qui a du sens' },
    text: {
      en: 'Charity, non-profit and volunteer roles across Europe. Apply with ease and track every step in one place.',
      es: 'Puestos benéficos, sin ánimo de lucro y de voluntariado en toda Europa. Postula fácilmente y sigue cada paso en un solo lugar.',
      fr: 'Des postes associatifs, humanitaires et bénévoles partout en Europe. Postulez facilement et suivez chaque étape au même endroit.',
    },
  },
  {
    host: 'eujobs.online',
    remoteOnly: true,
    title: { en: 'Find a Remote Job', es: 'Encuentra empleo en remoto', fr: 'Trouvez un emploi à distance' },
    text: {
      en: 'Remote jobs in every sector, open to people across Europe. Apply with ease and track every step in one place.',
      es: 'Empleos en remoto de todos los sectores, abiertos a personas de toda Europa. Postula fácilmente y sigue cada paso en un solo lugar.',
      fr: 'Des offres à distance dans tous les secteurs, ouvertes partout en Europe. Postulez facilement et suivez chaque étape au même endroit.',
    },
  },
]
