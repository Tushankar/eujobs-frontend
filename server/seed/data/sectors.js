/*
 * 2026-11-24: the starter job sectors (owner-approved list). A sector describes the kind of work, not the employer's
 * industry. The key is permanent (jobs, companies, links and the sector sites use it); admins rename or hide sectors in
 * admin › Website › Sectors, and add their own.
 */
export const SECTORS = [
  { key: 'arts_culture', name: { en: 'Arts & Culture', es: 'Arte y cultura', fr: 'Arts et culture' } },
  { key: 'charity_nonprofit', name: { en: 'Charity & Non-profit', es: 'Benéfico y sin ánimo de lucro', fr: 'Associatif et humanitaire' } },
  { key: 'construction_trades', name: { en: 'Construction & Trades', es: 'Construcción y oficios', fr: 'BTP et métiers' } },
  { key: 'education', name: { en: 'Education', es: 'Educación', fr: 'Éducation' } },
  { key: 'engineering', name: { en: 'Engineering', es: 'Ingeniería', fr: 'Ingénierie' } },
  { key: 'finance_economics', name: { en: 'Finance & Economics', es: 'Finanzas y economía', fr: 'Finance et économie' } },
  { key: 'healthcare', name: { en: 'Healthcare', es: 'Sanidad', fr: 'Santé' } },
  { key: 'hospitality_tourism', name: { en: 'Hospitality & Tourism', es: 'Hostelería y turismo', fr: 'Hôtellerie et tourisme' } },
  { key: 'hr_recruitment', name: { en: 'HR & Recruitment', es: 'RR. HH. y selección', fr: 'RH et recrutement' } },
  { key: 'it_software', name: { en: 'IT & Software', es: 'Informática y software', fr: 'Informatique et logiciels' } },
  { key: 'legal', name: { en: 'Legal', es: 'Jurídico', fr: 'Juridique' } },
  { key: 'logistics_transport', name: { en: 'Logistics & Transport', es: 'Logística y transporte', fr: 'Logistique et transport' } },
  { key: 'marketing_media', name: { en: 'Marketing & Media', es: 'Marketing y medios', fr: 'Marketing et médias' } },
  { key: 'public_sector', name: { en: 'Public Sector', es: 'Sector público', fr: 'Secteur public' } },
  { key: 'real_estate', name: { en: 'Real Estate & Property', es: 'Inmobiliaria', fr: 'Immobilier' } },
  { key: 'retail_ecommerce', name: { en: 'Retail & E-commerce', es: 'Comercio y e-commerce', fr: 'Commerce et e-commerce' } },
  { key: 'science_research', name: { en: 'Science & Research', es: 'Ciencia e investigación', fr: 'Sciences et recherche' } },
]
