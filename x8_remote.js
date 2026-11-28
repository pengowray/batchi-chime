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

    /* SipHash-2-4 with a 64-bit result, by Aumasson and Bernstein: a keyed hash made for
       short messages, small enough for the X8's patch. `key` is 16 bytes. BigInt does the
       64-bit arithmetic. */
    const MASK = (1n << 64n) - 1n;

    function rotl(x, bits) {
        return ((x << bits) | (x >> (64n - bits))) & MASK;
    }

    function word(bytes, at) {
        let value = 0n;
        for (let i = 7; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[at + i]);
        return value;
    }

    function sipHash24(key, message) {
        const k0 = word(key, 0);
        const k1 = word(key, 8);
        let v0 = k0 ^ 0x736f6d6570736575n;
        let v1 = k1 ^ 0x646f72616e646f6dn;
        let v2 = k0 ^ 0x6c7967656e657261n;
        let v3 = k1 ^ 0x7465646279746573n;
        function round() {
            v0 = (v0 + v1) & MASK; v1 = rotl(v1, 13n); v1 ^= v0; v0 = rotl(v0, 32n);
            v2 = (v2 + v3) & MASK; v3 = rotl(v3, 16n); v3 ^= v2;
            v0 = (v0 + v3) & MASK; v3 = rotl(v3, 21n); v3 ^= v0;
            v2 = (v2 + v1) & MASK; v1 = rotl(v1, 17n); v1 ^= v2; v2 = rotl(v2, 32n);
        }
        /* The message, zeros up to 1 byte short of a multiple of 8, then its length. */
        const padded = new Uint8Array((Math.floor(message.length / 8) + 1) * 8);
        padded.set(message);
        padded[padded.length - 1] = message.length & 0xff;
        for (let at = 0; at < padded.length; at += 8) {
            const m = word(padded, at);
            v3 ^= m;
            round();
            round();
            v0 ^= m;
        }
        v2 ^= 0xffn;
        for (let i = 0; i < 4; i += 1) round();
        return v0 ^ v1 ^ v2 ^ v3;
    }

    /* Version 2, with a code: "BATX", 2, the command and argument in one byte, and a
       2-byte check. The check is the low 2 bytes, low byte first, of SipHash-2-4 over the
       ID's first 6 bytes, the chime's Unix time (4 bytes) and its UTC offset in minutes
       (2 bytes), both low byte first. The key is the code's 6 ASCII digits, then 10 zero
       bytes. Bat firmware B273 and later reads it. Returns the 8 bytes. */
    function codedId(digits, command, argument, unixTime, utcOffsetMinutes) {
        return checkedId(digits, 2, command, argument, unixTime, utcOffsetMinutes);
    }

    /* "BATX", `version`, the command and argument in one byte, and the check. */
    function checkedId(digits, version, command, argument, unixTime, utcOffsetMinutes) {
        const head = MAGIC.concat([version, (command << 4) | (argument & 0x0f)]);
        const message = new Uint8Array(12);
        message.set(head);
        const view = new DataView(message.buffer);
        view.setUint32(6, unixTime, true);
        view.setInt16(10, utcOffsetMinutes, true);
        const key = new Uint8Array(16);
        for (let i = 0; i < 6; i += 1) key[i] = digits.charCodeAt(i);
        const hash = sipHash24(key, message);
        return head.concat([Number(hash & 0xffn), Number((hash >> 8n) & 0xffn)]);
    }

    /* The accuracy of the chime's location goes in 4 bits as a step: step 1 is up to 3 m,
       step 14 up to 10 km, and step 15 is over 10 km. The accuracy is the radius that 68% of
       readings are within, which GUANO's Loc Accuracy field holds. */
    const ACCURACY_STEPS_M = [3, 5, 7, 10, 15, 20, 30, 50, 100, 200, 500, 1000, 3000, 10000];

    /* The first step that is not under `metres`, or 15 for over 10 km. 0 for an accuracy
       that is not known: a command is then sent in version 1 or 2. */
    function accuracyStep(metres) {
        if (typeof metres !== 'number' || !(metres >= 0)) return 0;
        const step = ACCURACY_STEPS_M.findIndex(function (bound) { return metres <= bound; });
        return step < 0 ? 15 : step + 1;
    }

    /* With the location's accuracy, for bat firmware B293 and later: as version 2, but byte 4
       is 0x30 plus the accuracy step, and the check covers it. With no code (`digits` null),
       byte 4 is 0x40 plus the step, and the check's 2 bytes are 0. Returns the 8 bytes. */
    function accurateId(digits, step, command, argument, unixTime, utcOffsetMinutes) {
        if (digits) return checkedId(digits, 0x30 | step, command, argument, unixTime, utcOffsetMinutes);
        return MAGIC.concat([0x40 | step, (command << 4) | (argument & 0x0f), 0, 0]);
    }

    root.X8Remote = {
        chimeTime: chimeTime, plainId: plainId, codeDigits: codeDigits, codedId: codedId, sipHash24: sipHash24,
        accuracyStep: accuracyStep, accurateId: accurateId
    };
}(typeof window === 'undefined' ? globalThis : window));
