// Publish a refreshed collection only after every page succeeds.
export async function readAllPages(readPage, shouldStop = () => false, pageSize = 500) {
  const rows = [];
  let page;
  do {
    if (shouldStop()) return rows;
    page = await readPage(pageSize, rows.length);
    if (!Array.isArray(page)) throw new Error('Could not refresh records');
    rows.push(...page);
  } while (page.length === pageSize);
  return rows;
}
