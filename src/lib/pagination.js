// Build safe pagination values from validated query data.
export function getPagination(query) {
  // Resolve current page.
  const page = Number(query.page) > 0 ? Number(query.page) : 1;

  // Resolve requested page size.
  const requestedPageSize = Number(query.page_size) > 0 ? Number(query.page_size) : 50;

  // Cap page size to avoid oversized queries.
  const pageSize = requestedPageSize > 100 ? 100 : requestedPageSize;

  // SQL limit.
  const limit = pageSize;

  // SQL offset.
  const offset = (page - 1) * pageSize;

  // Return pagination primitives.
  return { page, pageSize, limit, offset };
}

// Build the standard paginated response payload.
export function paginationData(results, total, pagination) {
  return {
    results,
    page: pagination.page,
    page_size: pagination.pageSize,
    total_results: Number(total)
  };
}
