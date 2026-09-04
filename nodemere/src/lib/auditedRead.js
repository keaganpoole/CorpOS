// Thin compatibility adapter for existing read-only Supabase screen queries.
// The server resolves membership and ignores client authority; no keys live here.
export function auditedRead(table, columns, request) {
  const body = {columns: columns || '*', filters: [], order: [], limit: 1000, offset: 0};
  const query = {
    order(field, options = {}) { body.order.push({field, ascending: options.ascending !== false, nullsFirst: options.nullsFirst === true}); return query; },
    limit(limit) { body.limit = limit; return query; },
    range(start, end) { body.offset = start; body.limit = end - start + 1; return query; },
    single() { body.single = 'single'; return query; },
    maybeSingle() { body.single = 'maybeSingle'; return query; },
    then(resolve, reject) {
      return request(table, body).then(data => ({data, error: null})).catch(() => ({data: null, error: {message: 'Could not load authorized records. Please try again.'}})).then(resolve, reject);
    },
  };
  for (const op of ['eq','gte','lte','gt','lt','in','is']) query[op] = (field,value) => {body.filters.push({op,field,value}); return query;};
  return query;
}
