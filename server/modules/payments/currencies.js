/*
 * The currencies plans and courses are charged in (M-130). EU 27 + UK pay in their own 8 currencies; since the platform
 * went worldwide (owner 2026-11-16) every other country pays in USD. Job salaries are not charges: they keep any
 * country's currency.
 */
export const CHARGING_CURRENCIES = ['EUR', 'CZK', 'DKK', 'GBP', 'HUF', 'PLN', 'RON', 'SEK', 'USD']

/** The currency a country's currency is charged in. */
export const chargeCurrency = (currency) => (CHARGING_CURRENCIES.includes(currency) ? currency : 'USD')
