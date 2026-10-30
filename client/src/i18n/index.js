import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

/*
 * UI text (M-141, §2.15). English is bundled; Spanish and French load on demand. The languages are
 * the folders under locales/. In development and test (the e2e runs the dev server) there is no
 * fallback language and a missing key is a console error, so a gap can never hide behind English.
 */
const bundled = import.meta.glob('./locales/en/*.json', { eager: true, import: 'default' })
const onDemand = import.meta.glob(['./locales/*/*.json', '!./locales/en/*.json'], { import: 'default' })

const fileParts = (path) => path.match(/locales\/(\w+)\/(\w+)\.json$/).slice(1)

export const LANGUAGES = [...new Set(Object.keys({ ...bundled, ...onDemand }).map((path) => fileParts(path)[0]))].sort()
export const NAMESPACES = Object.keys(bundled).map((path) => fileParts(path)[1])
const DEFAULT_LANGUAGE = 'en'

const backend = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = onDemand[`./locales/${language}/${namespace}.json`]
    if (!load) return callback(new Error(`No ${language}/${namespace} translations`), false)
    load().then(
      (data) => callback(null, data),
      (error) => callback(error, false),
    )
  },
}

/** The browser's language when it is one of ours (M-135), else English. */
export function browserLanguage() {
  const preferred = (navigator.languages ?? [navigator.language]).map((tag) => tag.slice(0, 2).toLowerCase())
  return preferred.find((language) => LANGUAGES.includes(language)) ?? DEFAULT_LANGUAGE
}

/** Endonym with a capital first letter ("Español", "Français"). */
export function languageName(language) {
  const name = new Intl.DisplayNames([language], { type: 'language' }).of(language)
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1)
}

export function initI18n(language) {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
  return i18n
    .use(backend)
    .use(initReactI18next)
    .init({
      resources: { en: Object.fromEntries(Object.entries(bundled).map(([path, data]) => [fileParts(path)[1], data])) },
      partialBundledLanguages: true,
      lng: LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE,
      supportedLngs: LANGUAGES,
      fallbackLng: import.meta.env.DEV ? false : DEFAULT_LANGUAGE,
      ns: NAMESPACES,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      saveMissing: import.meta.env.DEV,
      saveMissingTo: 'current',
      missingKeyHandler: (languages, namespace, key) => console.error(`Missing i18n key ${namespace}:${key} (${languages.join(', ')})`),
      react: { useSuspense: false },
    })
}

export default i18n
