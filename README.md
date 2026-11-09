# Bat recorder setup by sound

A static page for a phone, published at [remote.oversample.com](https://remote.oversample.com/). It sets a bat recorder's clock and settings by playing sound at it.

| Tab | Sound | Sends |
|---|---|---|
| Tascam X8 | AudioMoth chime, after a tone for the remote | Date, time and UTC offset; a command (set clock, start or stop recording, or a listening mode); optional location |
| AudioMoth | AudioMoth chime, with an optional tone first | The same, plus optional location and deployment ID |
| PippyG | Our own encoder for the PippyG's chirp (`pippyg_chirp.js`) | Device ID, location, date and time, wake and sleep times, recording mode, trigger level, recording length |

## Running it

The page has no build step. To try it on this computer:

```bash
python3 -m http.server 8743
```

Then open <http://localhost:8743/>. To use it on a phone, publish this folder on any https host. Getting the phone's location needs https.

When you change a CSS or JS file, raise the `?v=` number on every link to it in `index.html`. GitHub Pages lets browsers keep each file for 10 minutes, so without the new number a phone can show the new page with the old script and stylesheet.

The page is published with GitHub Pages from `main`; `CNAME` gives it the address remote.oversample.com. The X8's SETTINGS, Phone tab shows a QR code for `https://remote.oversample.com/#x8`, which opens the Tascam X8 tab.

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

The Tascam X8 tab's buttons each play a 0.5 s tone, then a chime whose deployment ID holds the command, once. [docs/PHONE_REMOTE.md](https://github.com/pengowray/oversample-tascam-firmware/blob/main/docs/PHONE_REMOTE.md) in the firmware repository describes the format. The X8 needs Phone remote turned on (SETTINGS, Phone tab) and BAT DETECTOR open. Start recording and Stop recording work on firmware B249 and later; Set X8 clock and the listening mode buttons need B257 or later. Builds B239 to B248 used an earlier format and ignore this page's commands.

The Chime test button plays plain chimes for 1 minute, for the X8's PHONE TIME screen (SETTINGS, Phone tab, Phone time; on B239 to B256, SETTINGS, Tests tab), which shows the time each chime holds.

To test a recording on any firmware, record the chime on the X8 at 192 kHz, copy the WAV file to the computer, and run this in that repository:

```bash
cargo run --release -p chime --example decode_wav -- FILE.wav
```

## History

This page moved here from `web/recorder-setup/` in `batchi-tascam-oversample-colab`. Its earlier history is in that repository, from commit 015292d to 14c18d1.
