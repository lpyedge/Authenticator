/**
 * @module QRCode
 * @package @nuintun/qrcode
 * @license MIT
 * @version 5.0.2
 * @author nuintun <nuintun@qq.com>
 * @description A pure JavaScript QRCode encode and decode library.
 * @see https://github.com/nuintun/qrcode#readme
 */

'use strict';

/**
 * @module ECLevel
 */
const VALUES_TO_ECLEVEL = new Map();
function fromECLevelBits(bits) {
  const ecLevel = VALUES_TO_ECLEVEL.get(bits);
  if (ecLevel != null) {
    return ecLevel;
  }
  throw new Error('illegal error correction bits');
}
class ECLevel {
  #name;
  #bits;
  #level;
  // L = ~7% correction.
  static L = new ECLevel('L', 0, 0x01);
  // L = ~15% correction.
  static M = new ECLevel('M', 1, 0x00);
  // L = ~25% correction.
  static Q = new ECLevel('Q', 2, 0x03);
  // L = ~30% correction.
  static H = new ECLevel('H', 3, 0x02);
  constructor(name, level, bits) {
    this.#bits = bits;
    this.#name = name;
    this.#level = level;
    VALUES_TO_ECLEVEL.set(bits, this);
  }
  get bits() {
    return this.#bits;
  }
  get name() {
    return this.#name;
  }
  get level() {
    return this.#level;
  }
}

exports.ECLevel = ECLevel;
exports.fromECLevelBits = fromECLevelBits;
