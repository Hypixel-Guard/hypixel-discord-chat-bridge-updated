// Port of ImgPrev's token/Mixed.java.
//
// Packs payload fields into one number, each field in its own radix, so a token spends no characters on separators
// or rounding each field up to whole Base62 digits. Fields come back out in reverse order: the last one put is the
// first one taken. Taking from a number that wasn't made this way gives garbage, never an exception, so callers
// validate what they take and check isEmpty() at the end.

const Base62 = require("./base62.js");

class Mixed {
  constructor(n = 0n) {
    this.n = n;
  }

  /** @returns {Mixed | null} */
  static fromBase62(s) {
    try {
      return new Mixed(Base62.decode(s));
    } catch (error) {
      return null;
    }
  }

  toBase62() {
    return Base62.encode(this.n);
  }

  isEmpty() {
    return this.n === 0n;
  }

  /**
   * @param {bigint | number} v
   * @param {bigint | number} radix
   */
  put(v, radix) {
    v = BigInt(v);
    radix = BigInt(radix);
    if (v < 0n || v >= radix) {
      throw new Error(`${v} out of radix ${radix}`);
    }

    this.n = this.n * radix + v;
    return this;
  }

  putBits(v, bits) {
    return this.put(v, 1n << BigInt(bits));
  }

  /** @returns {bigint} */
  takeBig(radix) {
    radix = BigInt(radix);
    const v = this.n % radix;
    this.n /= radix;
    return v;
  }

  /** @returns {number} */
  take(radix) {
    return Number(this.takeBig(radix));
  }

  /** @returns {bigint} */
  takeBits(bits) {
    return this.takeBig(1n << BigInt(bits));
  }

  /** Each character as its index in alphabet, then the length, so takeString reads the length first. */
  putString(s, alphabet, minLen, maxLen) {
    if (s.length < minLen || s.length > maxLen) {
      throw new Error(`length ${s.length}`);
    }

    for (const ch of s) {
      const v = alphabet.indexOf(ch);
      if (v < 0) {
        throw new Error(`not in alphabet: ${ch}`);
      }

      this.put(v, alphabet.length);
    }

    return this.put(s.length - minLen, maxLen - minLen + 1);
  }

  takeString(alphabet, minLen, maxLen) {
    const length = this.take(maxLen - minLen + 1) + minLen;
    const out = new Array(length);
    for (let i = length - 1; i >= 0; i--) {
      out[i] = alphabet[this.take(alphabet.length)];
    }

    return out.join("");
  }
}

module.exports = Mixed;
