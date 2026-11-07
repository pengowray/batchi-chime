# Bat recorder setup by sound

A static page for a phone. It sets a bat recorder's clock and settings by playing sound at it.

| Tab | Sound | Sends |
|---|---|---|
| Tascam X8 | AudioMoth chime, after a tone for the remote | Date, time and UTC offset; for the remote, a start or stop command and optional location |
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

The X8's firmware does not set its clock from the chime yet. Firmware B235 and later can show the time it reads: in BAT DETECTOR's settings, tap `Chime test` (on B239 and later, tap `Tools` first).

Firmware B239 and later can also start and stop recording from the `Start recording` and `Stop recording` buttons on the Tascam X8 tab, with Phone remote turned on under SETTINGS, Tools. Each press plays a 0.5 s tone, then a chime whose deployment ID is `BATXREC` followed by 1 (start) or 2 (stop), and plays both twice. To test a recording on any firmware, record the chime on the X8 at 192 kHz, copy the WAV file to the computer, and run this in that repository:

```bash
cargo run --release -p chime --example decode_wav -- FILE.wav
```

## History

This page moved here from `web/recorder-setup/` in `batchi-tascam-oversample-colab`. Its earlier history is in that repository, from commit 015292d to 14c18d1.
