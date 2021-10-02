'use strict';

exports.toHex = (number, digit) => ('0'.repeat(digit) + number.toString(16)).slice(-digit).toUpperCase();

exports.strToBuffer = (str) => {
    let buffer = Buffer.alloc(str.length / 2);
    for (let i = 0; i < str.length; i += 2) {
        const s = str.slice(i, i + 2);
        buffer[i / 2] = parseInt(s, 16);
    }

    return buffer;
}
