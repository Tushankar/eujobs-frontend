/**
 * A DataTable's loading flags from its RTK Query result: `busy` while the rows on screen belong to the previous
 * arguments (filters, page), `loading` when there is nothing to show yet (the first fetch, or a refetch from an empty
 * list). A refetch for the same arguments (after a change) keeps the table as it is.
 */
export function tableState({ isFetching, currentData }, rows) {
  const busy = isFetching && !currentData
  return { loading: busy && rows.length === 0, busy }
}
