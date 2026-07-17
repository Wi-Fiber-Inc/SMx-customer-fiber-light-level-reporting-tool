// Adds limit and offset values to an SMx request path.
function addPagination(requestPath, limit, offset) {
  const separator = requestPath.includes("?") ? "&" : "?";
  return `${requestPath}${separator}limit=${limit}&offset=${offset}`;
}

// Gets every record from a paginated SMx endpoint.
export async function getAllPages(client, requestPath, pageSize = 100) {
  const records = [];
  let offset = 0;
  let totalCount = null;

  while (totalCount === null || records.length < totalCount) {
    const response = await client.get(
      addPagination(requestPath, pageSize, offset),
    );

    if (!Array.isArray(response.data)) {
      throw new Error("SMx returned an unexpected paginated response.");
    }

    records.push(...response.data);
    totalCount = response.totalCount ?? totalCount;

    if (response.data.length === 0) {
      break;
    }

    if (totalCount === null && response.data.length < pageSize) {
      break;
    }

    offset += response.data.length;
  }

  return records;
}
