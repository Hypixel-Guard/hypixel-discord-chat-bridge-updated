let suppressedUntil = 0;

/** @param {number} ms */
function suppressRepeatNotice(ms) {
  suppressedUntil = Math.max(suppressedUntil, Date.now() + ms);
}

function isRepeatNoticeSuppressed() {
  return Date.now() < suppressedUntil;
}

module.exports = { suppressRepeatNotice, isRepeatNoticeSuppressed };
