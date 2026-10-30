import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useGetMeQuery, useUpdateMeMutation } from '@/app/api.js'
import {
  countryName,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatList,
  formatLocale,
  formatMoney,
  formatMonth,
  formatNumber,
  formatRelative,
  formatSalary,
  languageNameIn,
} from './format.js'

/*
 * Language and country (M-134, M-135). Signed in, the server is the source of truth (PATCH /me);
 * anonymous visitors keep their choice in localStorage (§2.15).
 */
const ANONYMOUS_KEYS = { language: 'lwm-pref-language', country: 'lwm-pref-country' }

export function readAnonymousPreference(name) {
  try {
    return window.localStorage.getItem(ANONYMOUS_KEYS[name])
  } catch {
    return null
  }
}

export function writeAnonymousPreference(name, value) {
  try {
    window.localStorage.setItem(ANONYMOUS_KEYS[name], value)
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

/** The signed-in account (or undefined), the UI language, the country and the format locale. */
export function usePreferences() {
  const signedIn = useSelector((state) => state.session.signedIn)
  const { data: me } = useGetMeQuery(undefined, { skip: !signedIn })
  const { i18n } = useTranslation()
  const [updateMe] = useUpdateMeMutation()
  const language = i18n.language
  const country = me ? me.pickerCountry : readAnonymousPreference('country')

  async function setLanguage(next) {
    if (me) await updateMe({ language: next, languageExplicit: true }).unwrap()
    else writeAnonymousPreference('language', next)
    await i18n.changeLanguage(next)
  }

  /** The server may also switch the language to the country's default (M-134). */
  async function setCountry(code) {
    const updated = await updateMe({ pickerCountry: code }).unwrap()
    if (updated.language !== i18n.language) await i18n.changeLanguage(updated.language)
  }

  return { me, language, country, locale: formatLocale(language, country), setLanguage, setCountry }
}

/** Formatters bound to the current format locale. */
export function useFormat() {
  const { t } = useTranslation()
  const { locale, language } = usePreferences()
  return useMemo(
    () => ({
      locale,
      number: (value, options) => formatNumber(value, locale, options),
      money: (amountMinor, currency) => formatMoney(amountMinor, currency, locale),
      date: (value, options) => formatDate(value, locale, options),
      dateTime: (value) => formatDateTime(value, locale),
      month: (value) => formatMonth(value, locale),
      relative: (value) => formatRelative(value, locale),
      fileSize: (bytes) => formatFileSize(bytes, locale),
      list: (items, type) => formatList(items, locale, type),
      salary: (salary) => formatSalary(salary, locale),
      languageName: (code) => languageNameIn(code, language),
      country: (code) => (code === 'REMOTE' ? t('common:remote') : countryName(code, language)),
    }),
    [locale, language, t],
  )
}
