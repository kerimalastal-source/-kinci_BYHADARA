# فيديو «فيلا مرمرة هيفن: 5 أسئلة، 5 إجابات قصيرة» (2026-11-13)

على نمط فيديو UZM Group اللي بعته المالك. عربي، مع تعليق صوتي من ElevenLabs (صوت «Abdullah - Dramatic Bass»).

- `villa-ad-ar-916.mp4`: 1080×1920 للريلز. `villa-ad-ar-45.mp4`: 1080×1350 للفيدات. 30 ثانية، والسعر «من 1.55 مليون دولار» بشاشة النهاية.
- `villa-qa-916.html` / `villa-qa-45.html`: التصميم والحركة (`window.render(t)`)، والتوقيت من `timing-30s.json` (مكتوب جوّا الملف كـ `VO`).
- `voice-elevenlabs.mp3`: الصوت الأصلي (37.8 ث). `voice-30s.mp3`: بعد القص والتسريع (atempo 1.2، بدون «على أربعة طوابق» و«خاصة بالفيلا»).
- الخطوط: Amiri وPlayfair Display (Google Fonts، OFL).

إعادة البناء (من جذر الريبو):

```
node scripts/ads/villa-qa-2026-11/render.cjs scripts/ads/villa-qa-2026-11/villa-qa-45.html /tmp/f45 --fps 30 --h 1350
ffmpeg -framerate 30 -i /tmp/f45/f%04d.jpg -i scripts/ads/villa-qa-2026-11/voice-30s.mp3 -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart out.mp4
```

لسا ما انعمل إعلان. قرار المالك: مجموعة إعلانية جديدة لما يقرر (مش جوّا حملة فيلا الخليج الشغّالة).
