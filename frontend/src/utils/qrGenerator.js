/**
 * Lightweight, zero-dependency QR Code Generator in pure JavaScript.
 * Implements ISO/IEC 18004 QR Code standard (Versions 1-10, Byte mode).
 * Compatible with modern React 19 and standard browsers.
 */

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        GF256_EXP[i] = x;
        GF256_EXP[i + 255] = x;
        GF256_LOG[x] = i;
        x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
})();

function gfMultiply(x, y) {
    if (x === 0 || y === 0) return 0;
    return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsComputeRemainder(data, numEcc, gen) {
    const res = new Uint8Array(numEcc);
    for (let i = 0; i < data.length; i++) {
        const factor = data[i] ^ res[0];
        res.copyWithin(0, 1);
        res[numEcc - 1] = 0;
        for (let j = 0; j < numEcc; j++) {
            res[j] ^= gfMultiply(gen[j], factor);
        }
    }
    return res;
}

function rsGeneratorPoly(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
        const next = new Uint8Array(poly.length + 1);
        const root = GF256_EXP[i];
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= gfMultiply(poly[j], root);
            next[j + 1] ^= poly[j];
        }
        poly = next;
    }
    return poly.slice(0, degree);
}

// Version table: [version, totalCodewords, eccCodewordsPerBlock, numBlocks]
// Error Correction Level M:
const VERSION_ECC_M = [
    null,
    [1, 26, 10, 1], // V1: 16 data, 10 ecc
    [2, 44, 16, 1], // V2: 28 data, 16 ecc
    [3, 70, 26, 1], // V3: 44 data, 26 ecc
    [4, 100, 18, 2], // V4: 64 data, 36 ecc
    [5, 134, 24, 2], // V5: 86 data, 48 ecc
    [6, 172, 16, 4], // V6: 108 data, 64 ecc
    [7, 196, 18, 4], // V7: 124 data, 72 ecc
    [8, 242, 22, 4], // V8: 154 data, 88 ecc
    [9, 292, 22, 5], // V9: 182 data, 110 ecc
    [10, 346, 26, 5] // V10: 216 data, 130 ecc
];

// Alignment pattern positions for Versions 1-10
const ALIGNMENT_PATTERN_LOCATIONS = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50]
];

// Format bitmasks for Level M (ECC bits + mask index)
const FORMAT_INFO_M = [
    0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0
];

export function generateQrMatrix(text) {
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(text);

    // Find smallest version (1-10) for Level M
    let chosenVersion = null;
    let chosenConfig = null;
    for (let v = 1; v <= 10; v++) {
        const cfg = VERSION_ECC_M[v];
        const dataCap = cfg[1] - cfg[2] * cfg[3];
        // 4 bits mode + 8 bits count (for v1-9) + data length
        const neededBits = 4 + (v <= 9 ? 8 : 16) + utf8Bytes.length * 8;
        if (Math.ceil(neededBits / 8) <= dataCap) {
            chosenVersion = v;
            chosenConfig = cfg;
            break;
        }
    }

    if (!chosenVersion) {
        throw new Error(`Data is too long for QR Code (max supported in compact mode is ~210 bytes).`);
    }

    const [, totalCodewords, eccPerBlock, numBlocks] = chosenConfig;
    const totalDataCodewords = totalCodewords - eccPerBlock * numBlocks;

    // Build data bits: Mode Byte (0100) + Character Count + UTF-8 bytes
    const bitStream = [];
    const pushBits = (val, length) => {
        for (let i = length - 1; i >= 0; i--) {
            bitStream.push((val >>> i) & 1);
        }
    };

    pushBits(0b0100, 4); // Byte Mode
    pushBits(utf8Bytes.length, chosenVersion <= 9 ? 8 : 16);
    for (let i = 0; i < utf8Bytes.length; i++) {
        pushBits(utf8Bytes[i], 8);
    }

    // Terminator (up to 4 zeroes)
    const capacityBits = totalDataCodewords * 8;
    for (let i = 0; i < 4 && bitStream.length < capacityBits; i++) {
        bitStream.push(0);
    }
    // Byte boundary
    while (bitStream.length % 8 !== 0) {
        bitStream.push(0);
    }
    // Pad bytes
    const padBytes = [0xec, 0x11];
    let padIndex = 0;
    while (bitStream.length < capacityBits) {
        pushBits(padBytes[padIndex % 2], 8);
        padIndex++;
    }

    // Convert bits to data codewords
    const dataCodewords = new Uint8Array(totalDataCodewords);
    for (let i = 0; i < totalDataCodewords; i++) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) {
            byteVal = (byteVal << 1) | bitStream[i * 8 + b];
        }
        dataCodewords[i] = byteVal;
    }

    // Error correction computation across blocks
    const genPoly = rsGeneratorPoly(eccPerBlock);
    const dataBlocks = [];
    const eccBlocks = [];
    const baseBlockSize = Math.floor(totalDataCodewords / numBlocks);
    const extraBlocks = totalDataCodewords % numBlocks;

    let offset = 0;
    for (let b = 0; b < numBlocks; b++) {
        const blockSize = baseBlockSize + (b >= numBlocks - extraBlocks ? 1 : 0);
        const blkData = dataCodewords.slice(offset, offset + blockSize);
        offset += blockSize;
        dataBlocks.push(blkData);
        eccBlocks.push(rsComputeRemainder(blkData, eccPerBlock, genPoly));
    }

    // Interleave data codewords
    const finalCodewords = [];
    const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxDataLen; i++) {
        for (let b = 0; b < numBlocks; b++) {
            if (i < dataBlocks[b].length) {
                finalCodewords.push(dataBlocks[b][i]);
            }
        }
    }
    // Interleave ECC codewords
    for (let i = 0; i < eccPerBlock; i++) {
        for (let b = 0; b < numBlocks; b++) {
            finalCodewords.push(eccBlocks[b][i]);
        }
    }

    // Remainder bits for versions: V1-V6: 0, V2: 7? None for v1-6
    const size = chosenVersion * 4 + 17;
    const modules = Array.from({ length: size }, () => Array(size).fill(null));
    const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

    function setModule(r, c, val) {
        modules[r][c] = val;
        isFunction[r][c] = true;
    }

    // 1. Finder patterns (7x7) at (0,0), (0, size-7), (size-7, 0)
    function drawFinder(r0, c0) {
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
                const rr = r0 + r;
                const cc = c0 + c;
                if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
                    const isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
                    const isCenter = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                    const val = (r >= 0 && r <= 6 && c >= 0 && c <= 6) && (isBorder || isCenter);
                    setModule(rr, cc, val);
                }
            }
        }
    }
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // 2. Alignment patterns
    const alignPos = ALIGNMENT_PATTERN_LOCATIONS[chosenVersion];
    for (let i = 0; i < alignPos.length; i++) {
        for (let j = 0; j < alignPos.length; j++) {
            const r0 = alignPos[i];
            const c0 = alignPos[j];
            // Skip if overlapping finder patterns
            if ((i === 0 && j === 0) || (i === 0 && j === alignPos.length - 1) || (i === alignPos.length - 1 && j === 0)) {
                continue;
            }
            for (let r = -2; r <= 2; r++) {
                for (let c = -2; c <= 2; c++) {
                    const val = Math.max(Math.abs(r), Math.abs(c)) !== 1;
                    setModule(r0 + r, c0 + c, val);
                }
            }
        }
    }

    // 3. Timing patterns
    for (let i = 8; i < size - 8; i++) {
        if (!isFunction[6][i]) setModule(6, i, i % 2 === 0);
        if (!isFunction[i][6]) setModule(i, 6, i % 2 === 0);
    }

    // Dark module
    setModule(size - 8, 8, true);

    // Reserve format bits area
    for (let i = 0; i < 9; i++) {
        if (!isFunction[8][i]) { modules[8][i] = false; isFunction[8][i] = true; }
        if (!isFunction[i][8]) { modules[i][8] = false; isFunction[i][8] = true; }
    }
    for (let i = size - 8; i < size; i++) {
        if (!isFunction[8][i]) { modules[8][i] = false; isFunction[8][i] = true; }
    }
    for (let i = size - 7; i < size; i++) {
        if (!isFunction[i][8]) { modules[i][8] = false; isFunction[i][8] = true; }
    }

    // Convert final codewords to bits
    const allBits = [];
    for (const byte of finalCodewords) {
        for (let b = 7; b >= 0; b--) {
            allBits.push((byte >>> b) & 1);
        }
    }

    // Place data bits in zigzag right to left
    let bitIdx = 0;
    let upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
        if (right === 6) right--; // Skip vertical timing column
        for (let v = 0; v < size; v++) {
            const r = upward ? size - 1 - v : v;
            for (let c = right; c > right - 2; c--) {
                if (!isFunction[r][c]) {
                    const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
                    modules[r][c] = Boolean(bit);
                }
            }
        }
        upward = !upward;
    }

    // Apply Mask Pattern (Mask 0: (row + col) % 2 === 0)
    const maskIdx = 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!isFunction[r][c]) {
                if ((r + c) % 2 === 0) {
                    modules[r][c] = !modules[r][c];
                }
            }
        }
    }

    // Draw format info bits
    const formatBits = FORMAT_INFO_M[maskIdx];
    for (let i = 0; i < 15; i++) {
        const bit = ((formatBits >>> i) & 1) === 1;
        // Top-left
        if (i < 6) modules[i][8] = bit;
        else if (i < 8) modules[i + 1][8] = bit;
        else if (i === 8) modules[7][8] = bit;
        else if (i === 9) modules[8][7] = bit;
        else modules[8][15 - i] = bit;

        // Bottom-left and Top-right
        if (i < 8) modules[8][size - 1 - i] = bit;
        else modules[size - 15 + i][8] = bit;
    }

    return modules;
}

export function generateQrSvgString(text, options = {}) {
    const {
        size = 220,
        margin = 2,
        color = '#111827',
        bgColor = '#ffffff'
    } = options;

    const modules = generateQrMatrix(text);
    const numModules = modules.length;
    const viewBoxSize = numModules + margin * 2;

    let rects = [];
    for (let r = 0; r < numModules; r++) {
        for (let c = 0; c < numModules; c++) {
            if (modules[r][c]) {
                rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${color}" shape-rendering="crispEdges"/>`);
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        ${rects.join('\n')}
    </svg>`;
}

export function generateQrDataUrl(text, options = {}) {
    const svg = generateQrSvgString(text, options);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

