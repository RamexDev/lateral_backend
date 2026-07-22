// Detect MySQL/MariaDB duplicate-entry errors.
export function isDuplicateEntryError(err) {
  return Boolean(err && err.code === 'ER_DUP_ENTRY');
}
