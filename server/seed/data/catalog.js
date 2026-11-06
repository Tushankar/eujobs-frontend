/* Catalogue data for seed:catalog (U41). */

// EU 27 + GB + Remote (M-139). 21 countries use EUR, BG included since 2026 (D16).
const EU = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
const OWN_CURRENCY = { CZ: 'CZK', DK: 'DKK', HU: 'HUF', PL: 'PLN', RO: 'RON', SE: 'SEK', GB: 'GBP' }
// M-134: ES → es; FR, BE, LU → fr; every other country → en.
const DEFAULT_LANGUAGE = { ES: 'es', FR: 'fr', BE: 'fr', LU: 'fr' }

export const COUNTRIES = [
  ...[...EU, 'GB'].sort().map((code, index) => ({
    code,
    currency: OWN_CURRENCY[code] ?? 'EUR',
    defaultLanguage: DEFAULT_LANGUAGE[code] ?? 'en',
    isRemote: false,
    order: index + 1,
    enabled: true,
  })),
  { code: 'REMOTE', currency: 'EUR', defaultLanguage: 'en', isRemote: true, order: 29, enabled: true },
]

// OD1 plan prices in major units; stored as integer minor units (U24).
export const PLUS_PRICES = { GBP: 9, EUR: 10, PLN: 45, SEK: 119, DKK: 79, CZK: 259, HUF: 3990, RON: 55 }
// P11c-Q2: Recruiter Plus uses the approved £49 row of §3.10.
export const RECRUITER_PLUS_PRICES = { GBP: 49, EUR: 57, PLN: 245, SEK: 629, DKK: 429, CZK: 1399, HUF: 21990, RON: 289 }
const minor = (prices) => Object.entries(prices).map(([currency, amount]) => ({ currency, amountMinor: amount * 100 }))

// M-115, M-116, §3.3: what each plan unlocks; Free covers everything that is not gated. §3.22: Recruiter Plus (P11c-Q1 … Q4).
export const PLANS = [
  {
    key: 'free',
    role: 'candidate',
    name: { en: 'Free', es: 'Gratis', fr: 'Gratuit' },
    features: [
      {
        en: 'Browse, search and save jobs',
        es: 'Explora, busca y guarda ofertas de empleo',
        fr: 'Parcourez, recherchez et enregistrez des offres d’emploi',
      },
      {
        en: 'Complete your profile, CV versions and verification',
        es: 'Completa tu perfil, tus versiones de CV y tu verificación',
        fr: 'Complétez votre profil, vos versions de CV et votre vérification',
      },
      {
        en: 'Read messages from recruiters',
        es: 'Lee los mensajes de los reclutadores',
        fr: 'Lisez les messages des recruteurs',
      },
      { en: 'Buy and take courses', es: 'Compra y realiza cursos', fr: 'Achetez et suivez des formations' },
    ],
    interval: 'month',
    prices: [],
    entitlements: [],
  },
  {
    key: 'plus',
    role: 'candidate',
    name: { en: 'Plus', es: 'Plus', fr: 'Plus' },
    features: [
      { en: 'Apply to jobs', es: 'Postúlate a ofertas de empleo', fr: 'Postulez aux offres d’emploi' },
      {
        en: 'Message recruiters and reply to them',
        es: 'Escribe a los reclutadores y respóndeles',
        fr: 'Écrivez aux recruteurs et répondez-leur',
      },
      { en: 'Job alerts by email', es: 'Alertas de empleo por correo electrónico', fr: 'Alertes emploi par e-mail' },
      {
        en: 'AI match scores, explanations and insights',
        es: 'Puntuaciones de compatibilidad con IA, explicaciones y análisis',
        fr: 'Scores de compatibilité par IA, explications et analyses',
      },
      {
        en: 'AI help with your CV, profile summary and translations',
        es: 'Ayuda de la IA con tu CV, el resumen de tu perfil y las traducciones',
        fr: 'Aide de l’IA pour votre CV, le résumé de votre profil et les traductions',
      },
      // P11d-Q9: interviews and documents (never gated for candidates, P11d-Q22; listed as what Plus includes)
      {
        en: 'Pick interview times, with calendar invites and reminders',
        es: 'Elige el horario de tus entrevistas, con invitaciones de calendario y recordatorios',
        fr: 'Choisissez l’horaire de vos entretiens, avec invitations d’agenda et rappels',
      },
      { en: 'In-app video interviews', es: 'Entrevistas por vídeo en la aplicación', fr: 'Entretiens vidéo dans l’application' },
      {
        en: 'Share documents securely with employers',
        es: 'Comparte documentos de forma segura con las empresas',
        fr: 'Partagez vos documents en toute sécurité avec les employeurs',
      },
    ],
    interval: 'month',
    prices: minor(PLUS_PRICES),
    entitlements: ['apply', 'message_send', 'job_alerts', 'ai'],
  },
  {
    // What a recruiter keeps without Recruiter Plus (§3.22): listed beside it on the upgrade page; it unlocks nothing.
    key: 'recruiter_free',
    role: 'recruiter',
    name: { en: 'Free', es: 'Gratis', fr: 'Gratuit' },
    features: [
      {
        en: '1 active job at a time, unlimited drafts',
        es: '1 oferta activa a la vez y borradores ilimitados',
        fr: '1 offre active à la fois, brouillons illimités',
      },
      { en: 'Receive and review applications', es: 'Recibe y revisa candidaturas', fr: 'Recevez et examinez les candidatures' },
      {
        en: 'Hiring pipeline and replies to applicants',
        es: 'Proceso de selección y respuestas a los candidatos',
        fr: 'Suivi des recrutements et réponses aux candidats',
      },
      { en: 'Company page and verification', es: 'Página de empresa y verificación', fr: 'Page entreprise et vérification' },
      { en: 'Recruiter learning', es: 'Formación para reclutadores', fr: 'Formation pour recruteurs' },
    ],
    interval: 'month',
    prices: [],
    entitlements: [],
  },
  {
    key: 'recruiter_plus',
    role: 'recruiter',
    // The name stays the same in every language (P11c-Q1).
    name: { en: 'Recruiter Plus', es: 'Recruiter Plus', fr: 'Recruiter Plus' },
    features: [
      { en: 'Unlimited active jobs', es: 'Ofertas activas ilimitadas', fr: 'Offres actives illimitées' },
      {
        en: 'Find candidates: search, profiles, shortlist, notes and Compare',
        es: 'Buscar candidatos: búsqueda, perfiles, preseleccionados, notas y comparación',
        fr: 'Trouver des candidats : recherche, profils, short-list, notes et comparaison',
      },
      { en: 'Start conversations and request CVs', es: 'Inicia conversaciones y solicita CV', fr: 'Démarrez des conversations et demandez des CV' },
      {
        en: 'AI job summaries, match insights and translations',
        es: 'Resúmenes de ofertas con IA, análisis de compatibilidad y traducciones',
        fr: 'Résumés d’offres par IA, analyses de compatibilité et traductions',
      },
      // P11d-Q9
      {
        en: 'Schedule interviews: offer 2–3 time slots, with calendar invites',
        es: 'Programa entrevistas: ofrece de 2 a 3 horarios, con invitaciones de calendario',
        fr: 'Planifiez des entretiens : proposez 2 ou 3 créneaux, avec invitations d’agenda',
      },
      { en: 'In-app video interviews', es: 'Entrevistas por vídeo en la aplicación', fr: 'Entretiens vidéo dans l’application' },
      {
        en: "AI interview notes (with both people's consent)",
        es: 'Notas de entrevista con IA (con el consentimiento de ambas personas)',
        fr: 'Notes d’entretien par IA (avec le consentement des deux personnes)',
      },
      {
        en: 'Request documents securely in chat',
        es: 'Solicita documentos de forma segura en el chat',
        fr: 'Demandez des documents en toute sécurité dans la messagerie',
      },
    ],
    interval: 'month',
    prices: minor(RECRUITER_PLUS_PRICES),
    entitlements: ['jobs_unlimited', 'discovery', 'outreach', 'ai', 'interviews'],
  },
]

// The three Figma roles (accessData.js) minus the dropped ids (§3.13). Names and descriptions are staff content.
export const SYSTEM_ROLES = [
  {
    key: 'manager',
    name: 'Manager',
    description: 'Supervises a team, manages recruitment activity, and reviews operational reporting.',
    scope: 'department',
    permissions: ['users.view', 'roles.view', 'roles.assign', 'candidates.view', 'reports.view'],
  },
  {
    key: 'accounts_head',
    name: 'Accounts Head',
    description: 'Oversees finance information, approvals, and financial reporting.',
    scope: 'finance_department',
    permissions: ['users.view', 'roles.view', 'finance.view', 'reports.view', 'reports.export', 'audit.view'],
  },
  {
    key: 'staff',
    name: 'Staff',
    description: 'Provides limited operational access for day-to-day responsibilities.',
    scope: 'department',
    permissions: ['users.view', 'candidates.view'],
  },
]
