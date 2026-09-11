const PRISMA_UNIQ_FIELD_REGEXP = /\(`"?([^`"]+)"?`\)/

/**
 * Resolves the human-readable label for a Prisma P2002 unique-constraint error.
 * @param {string} message - the Prisma error message (err.message)
 * @param {Record<string, string>} fields - map of column name -> human label
 * @returns {string} the mapped label, else the raw field name, else 'Поле'
 */
export const uniqConstraintLabel = (message, fields) => {
  const fieldMatch = message.match(PRISMA_UNIQ_FIELD_REGEXP)
  const rawField = fieldMatch ? fieldMatch[1] : null
  return (rawField && fields[rawField]) || rawField || 'Поле'
}
