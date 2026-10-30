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
const PLUS_PRICES = { GBP: 9, EUR: 10, PLN: 45, SEK: 119, DKK: 79, CZK: 259, HUF: 3990, RON: 55 }

// M-115, M-116, §3.3: what each plan unlocks; Free covers everything that is not gated.
export const PLANS = [
  {
    key: 'free',
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
    ],
    interval: 'month',
    prices: Object.entries(PLUS_PRICES).map(([currency, amount]) => ({ currency, amountMinor: amount * 100 })),
    entitlements: ['apply', 'message_send', 'job_alerts', 'ai'],
  },
]

// The three Figma roles (accessData.js) minus the dropped ids (§3.13). Names and descriptions are staff content.
export const SYSTEM_ROLES = [
  {
    name: 'Manager',
    description: 'Supervises a team, manages recruitment activity, and reviews operational reporting.',
    scope: 'department',
    permissions: ['users.view', 'roles.view', 'roles.assign', 'candidates.view', 'reports.view'],
  },
  {
    name: 'Accounts Head',
    description: 'Oversees finance information, approvals, and financial reporting.',
    scope: 'finance_department',
    permissions: ['users.view', 'roles.view', 'finance.view', 'reports.view', 'reports.export', 'audit.view'],
  },
  {
    name: 'Staff',
    description: 'Provides limited operational access for day-to-day responsibilities.',
    scope: 'department',
    permissions: ['users.view', 'candidates.view'],
  },
]
