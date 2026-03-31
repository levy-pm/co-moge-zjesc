function toSqlDateParam(value) {
  const candidate = value instanceof Date ? value : new Date(value || Date.now());
  const safeDate =
    Number.isFinite(candidate.getTime()) ? candidate : new Date(Date.now());
  return new Date(safeDate.getTime());
}

module.exports = {
  toSqlDateParam,
};
