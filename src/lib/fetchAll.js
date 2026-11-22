// Supabase returns at most 1,000 rows per request. Read page after page until a short page
// comes back, so long lists (regears, regear items, CTA slots, sign-ups...) are never cut off.
// `buildQuery` must return a fresh query each time (query builders can only be run once).
export const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
