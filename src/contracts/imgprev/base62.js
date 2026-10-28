// Port of ImgPrev's token/Base62.java (github.com/CJWM-Dev/imgprev). Numbers are BigInts.

const A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * @param {bigint} n
 * @returns {string}
 */
function encode(n) {
  if (n < 0n) {
    throw new Error("negative");
  }

  if (n === 0n) {
    return "0";
  }

  let out = "";
  while (n > 0n) {
    out = A[Number(n % 62n)] + out;
    n /= 62n;
  }

  return out;
}

/**
 * @param {string} s
 * @returns {bigint}
 */
function decode(s) {
  let n = 0n;
  for (const ch of s) {
    const v = A.indexOf(ch);
    if (v < 0) {
      throw new Error(`not base62: ${ch}`);
    }

    n = n * 62n + BigInt(v);
  }

  return n;
}

function leftPad(s, length) {
  return s.padStart(length, "0");
}

module.exports = { A, encode, decode, leftPad };
