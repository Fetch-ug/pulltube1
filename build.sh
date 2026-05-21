#!/usr/bin/env bash
set -e

echo "── Installing Node dependencies ──"
npm install

echo "── Installing yt-dlp ──"
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version

echo "── Installing ffmpeg ──"
apt-get update -qq && apt-get install -y -qq ffmpeg
ffmpeg -version | head -1

echo "── Build complete ──"
