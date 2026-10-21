"""Soundtrack for the WhatsApp reel: a soft synth pad, a gentle pulse, and small pops timed to
the animation (message bubbles, chips, counters). Generated here so there is no licensed music.
Usage: python3 sound.py out.wav 40"""
import sys
import wave
import numpy as np

SR = 44100
out, dur = sys.argv[1], float(sys.argv[2])
n = int(SR * dur)
t = np.arange(n) / SR
mix = np.zeros(n)


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):  # one pole; fine for 40 s
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


# Pad: four chords, 10 s each (Fmaj7 - Am7 - Dm9 - Cmaj7), soft saw-ish voices with slow swell.
chords = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 57, 60, 64], [48, 55, 59, 64]]
pad = np.zeros(n)
for k, ch in enumerate(chords):
    a, b = k * 10.0, min(dur, k * 10.0 + 10.6)
    s, e = int(a * SR), int(b * SR)
    tt = t[s:e] - a
    env = np.minimum(1, tt / 1.6) * np.minimum(1, (b - a - tt) / 1.2)
    for m in ch:
        f = note(m)
        for det in (-0.12, 0.12):
            ph = 2 * np.pi * f * (1 + det / 100) * tt
            pad[s:e] += env * (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)) / 8
pad = lowpass(pad, 1400)
mix += 0.55 * pad

# Pulse: a soft kick-like thump on each beat from 4 s to 36 s (100 bpm), quieter in the night scene.
beat = 60 / 100
for bt in np.arange(4.0, 36.0, beat):
    s = int(bt * SR)
    L = int(0.25 * SR)
    if s + L > n:
        break
    tt = np.arange(L) / SR
    f = 55 + 45 * np.exp(-tt * 30)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14)
    gain = 0.22 if 22.2 < bt < 25 else 0.32
    mix[s:s + L] += gain * thump

# Pops: short sine blips at each on-screen event.
events = [0.15, 0.6, 1.95, 3.05, 4.25, 4.67, 5.09, 5.51, 5.0, 5.42, 5.84, 6.26, 7.25,
          11.9, 12.7, 13.4, 14.1, 14.8, 15.6, 25.6, 26.4, 28.5, 30.4,
          31.7, 31.83, 31.96, 32.09, 32.22, 34.6, 35.4, 36.2, 37.2]
for k, ev in enumerate(events):
    s = int(ev * SR)
    L = int(0.12 * SR)
    if s + L > n:
        continue
    tt = np.arange(L) / SR
    f = note(76 + (k * 5) % 12)
    mix[s:s + L] += 0.16 * np.sin(2 * np.pi * f * tt) * np.exp(-tt * 38)

# Whooshes: filtered noise swells into the big scene changes.
rng = np.random.default_rng(7)
for ev in [9.5, 16.7, 18.7, 22.1, 31.4, 37.0]:
    a, L = ev - 0.6, int(1.0 * SR)
    s = int(a * SR)
    noise = lowpass(rng.standard_normal(L), 900)
    tt = np.arange(L) / SR
    env = np.sin(np.pi * tt / 1.0) ** 2
    mix[s:s + L] += 0.5 * noise * env

# Fade in/out, normalise to -1 dBFS peak.
mix *= np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 1.5)
mix /= np.max(np.abs(mix)) / 0.89
pcm = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("sound:", out)
