# Bat recorder setup by sound

A static page for a phone. It sets a bat recorder's clock and settings by playing sound at it.

| Tab | Sound | Sends |
|---|---|---|
| Tascam X8 | AudioMoth chime | Date, time and UTC offset |
| AudioMoth | AudioMoth chime, with an optional tone first | The same, plus optional location and deployment ID |
| PippyG | Our own encoder for the PippyG's chirp (`pippyg_chirp.js`) | Device ID, location, date and time, wake and sleep times, recording mode, trigger level, recording length |

## Running it

The page has no build step. To try it on this computer:

```bash
python3 -m http.server 8743
```

Then open <http://localhost:8743/>. To use it on a phone, publish this folder on any https host. Getting the phone's location needs https.

## Files

`audiomothchime.js` and `audiomothchime_connector.js` are unmodified copies of Open Acoustic Devices' MIT-licensed library (`LICENSE-audiomoth.txt`).

The chirp encoder has not been tried on a real PippyG. To test it:

```bash
node --test tools/test_pippyg_chirp.mjs
```

`tools/chime_render.mjs` runs the AudioMoth encoder in Node and writes a chime to a WAV file:

```bash
node tools/chime_render.mjs --rate 192000 --unix 1793000000 --tz 660 --out chime.wav
```

## The Tascam X8

The X8's bat detector firmware and the chime decoder are in the `batchi-tascam-oversample-colab` repository, in `crates/x8-patch` and `crates/chime`. The chime decoder's tests use a render from `tools/chime_render.mjs`.

The X8 firmware cannot read the chime yet. To test a recording, record the chime on the X8 at 192 kHz, copy the WAV file to the computer, and run this in that repository:

```bash
cargo run --release -p chime --example decode_wav -- FILE.wav
```

## History

This page moved here from `web/recorder-setup/` in `batchi-tascam-oversample-colab`. Its earlier history is in that repository, from commit 015292d to 14c18d1.
