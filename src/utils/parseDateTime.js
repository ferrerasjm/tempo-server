function parseDateTime(value) {
  if (typeof value !== "string" || !/T.*(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = parseDateTime;
