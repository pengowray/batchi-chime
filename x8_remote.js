'use strict';

/* The deployment IDs of the Tascam X8 phone remote. docs/PHONE_REMOTE.md in the
   oversample-tascam-firmware repository is the format. tools/test_x8_remote.mjs checks
   this file against the same test vectors as the X8's decoder. */
(function (root) {
    const MAGIC = [0x42, 0x41, 0x54, 0x58]; /* "BATX" */
    const MILLISECONDS_IN_SECOND = 1000;
    /* The connector's own rule: a chime starts on the next whole second that is at least
       this far ahead. */
    const MINIMUM_DELAY_MS = 200;

    /* The time and UTC offset that the connector puts in a chime when it is given `date`.
       A coded command's check covers both, so they are worked out here first and the
       offset is passed to the connector, which would otherwise read it again. */
    function chimeTime(date) {
        let delay = MILLISECONDS_IN_SECOND - date.getMilliseconds();
        if (delay < MINIMUM_DELAY_MS) delay += MILLISECONDS_IN_SECOND;
        const sendTime = new Date(date.getTime() + delay);
        return {
            unixTime: Math.round(sendTime.getTime() / MILLISECONDS_IN_SECOND),
            utcOffsetMinutes: -sendTime.getTimezoneOffset()
        };
    }

    /* Version 1, with no code: "BATX", 1, the command, and a 16-bit argument, low byte
       first. Bat firmware B249 and later reads it. */
    function plainId(command, argument) {
        return MAGIC.concat([1, command, argument & 0xff, argument >> 8]);
    }

    /* The 6 digits of a code as typed, or null. Spaces are allowed, because the X8 shows
       the code in two groups. */
    function codeDigits(text) {
        const digits = text.replace(/\s+/g, '');
        return /^\d{6}$/.test(digits) ? digits : null;
    }

    /* Version 2, with a code: "BATX", 2, the command and argument in one byte, and a
       2-byte check. The check is the first 2 bytes of HMAC-SHA1, keyed with the code's 6
       ASCII digits, over the ID's first 6 bytes, the chime's Unix time (4 bytes) and its
       UTC offset in minutes (2 bytes), both low byte first. Bat firmware B273 and later
       reads it. Resolves to the 8 bytes. */
    function codedId(digits, command, argument, unixTime, utcOffsetMinutes) {
        const head = MAGIC.concat([2, (command << 4) | (argument & 0x0f)]);
        const message = new Uint8Array(12);
        message.set(head);
        const view = new DataView(message.buffer);
        view.setUint32(6, unixTime, true);
        view.setInt16(10, utcOffsetMinutes, true);
        const key = Uint8Array.from(digits, function (digit) { return digit.charCodeAt(0); });
        const subtle = root.crypto.subtle;
        return subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
            .then(function (hmacKey) { return subtle.sign('HMAC', hmacKey, message); })
            .then(function (digest) {
                const check = new Uint8Array(digest);
                return head.concat([check[0], check[1]]);
            });
    }

    /* Browsers offer this only on https and localhost. */
    function canCode() {
        return Boolean(root.crypto && root.crypto.subtle);
    }

    root.X8Remote = { chimeTime: chimeTime, plainId: plainId, codeDigits: codeDigits, codedId: codedId, canCode: canCode };
}(typeof window === 'undefined' ? globalThis : window));
