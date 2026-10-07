// Require a timezone so the same reservation time is understood on every device.
// Examples: 2026-10-03T10:00:00+08:00 or 2026-10-03T02:00:00Z.
function parseDateTime(value) {
  if (typeof value !== "string" || !/T.*(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = parseDateTime;
