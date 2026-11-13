/** The largest yearly saving among `plans` (GET /plans), or 0 when none offers yearly billing (2026-11-13). */
export const bestSaving = (plans = []) => Math.max(0, ...plans.map((plan) => plan.yearlyPrice?.savingPercent ?? 0))
