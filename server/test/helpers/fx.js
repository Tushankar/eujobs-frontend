/* A fixed euro rate table for API tests (they never call the ECB): units of each currency per euro. */
export const FX_STUB = {
  date: '2026-11-05',
  rates: { EUR: 1, GBP: 0.83393, PLN: 4.389, SEK: 10.9845, DKK: 7.4747, CZK: 24.289, HUF: 363.18, RON: 5.3385 },
}

export const fxStub = () => FX_STUB
