#!/bin/zsh
# Normalizes voice to -16 LUFS and peak-normalizes effects to -3 dBFS, writing *.norm.* next to the source.
set -e
cd "${0:A:h}/../film/assets"
for f in voice/*.mp3(N); do
  [[ $f == *.norm.mp3 ]] && continue
  ffmpeg -y -loglevel error -i $f -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -b:a 192k ${f:r}.norm.mp3
done
for f in sfx/*.mp3(N); do
  [[ $f == *.norm.mp3 ]] && continue
  peak=$(ffmpeg -hide_banner -nostats -i $f -af volumedetect -f null - 2>&1 | grep max_volume | grep -oE -- '-?[0-9.]+ dB' | grep -oE -- '-?[0-9.]+')
  gain=$(echo "-3 - ($peak)" | bc -l)
  ffmpeg -y -loglevel error -i $f -af "volume=${gain}dB" -ar 44100 -b:a 192k ${f:r}.norm.mp3
done
echo normalized
