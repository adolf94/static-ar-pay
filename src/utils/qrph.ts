/**
 * Minimal QRPh (com.p2pqrpay / InstaPay P2P) payload tools.
 *
 * These QR strings are TLV-encoded (tag, length, value). Note: this
 * issuer uses DECIMAL 2-digit lengths (verified by round-trip + CRC
 * against the bank-issued strings), unlike hex-length EMVco QRs.
 *
 * To embed a transaction amount we need to:
 *   1. flip tag 01 (Point of Initiation) from "11" static → "12" dynamic
 *   2. insert tag 54 (Transaction Amount) after tag 53 (Currency)
 *   3. recompute the tag 63 CRC-16/CCITT-FALSE over the whole payload
 *
 * If anything about the payload looks unexpected, the original string
 * is returned untouched — a broken QR is worse than a static one.
 */

type Tlv = { tag: string; value: string };

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), hex, uppercase. */
const crc16 = (data: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/** Parse the top-level TLV fields (templates like tag 27 stay opaque). */
const parseTlv = (payload: string): Tlv[] => {
  const fields: Tlv[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) throw new Error('truncated header');
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10); // decimal lengths
    if (!Number.isFinite(len)) throw new Error('bad length');
    const start = i + 4;
    const end = start + len;
    if (end > payload.length) throw new Error('truncated value');
    fields.push({ tag, value: payload.slice(start, end) });
    i = end;
  }
  return fields;
};

const serializeTlv = (fields: Tlv[]): string =>
  fields
    .map((f) => f.tag + f.value.length.toString(10).padStart(2, '0') + f.value)
    .join('');

/**
 * Return `qrData` with `amount` embedded as the transaction amount.
 * Falls back to the original string if the payload can't be parsed.
 */
export const embedAmount = (qrData: string, amount: number): string => {
  try {
    const fields = parseTlv(qrData);
    if (!fields.some((f) => f.tag === '63')) return qrData; // no CRC — leave untouched

    const body = fields
      .filter((f) => f.tag !== '63' && f.tag !== '54')
      // Dynamic QR: an amount is present, so initiation becomes "12"
      .map((f) => (f.tag === '01' ? { tag: f.tag, value: '12' } : f));

    // Tag order is ascending; 54 sits after 53 (currency) / before 58
    const insertAt = body.findIndex((f) => f.tag > '54');
    const ordered =
      insertAt === -1
        ? [...body, { tag: '54', value: amount.toFixed(2) }]
        : [...body.slice(0, insertAt), { tag: '54', value: amount.toFixed(2) }, ...body.slice(insertAt)];

    const payload = serializeTlv(ordered) + '6304';
    return payload + crc16(payload);
  } catch {
    return qrData;
  }
};
