const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Get playlist info (title + video count) ───────────────────────────────
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    url
  ];

  let data = '';
  let err  = '';
  const proc = spawn('yt-dlp', args);

  proc.stdout.on('data', d => data += d);
  proc.stderr.on('data', d => err  += d);

  proc.on('close', code => {
    try {
      const info = JSON.parse(data);
      res.json({
        title:  info.title  || info.webpage_url_basename || 'Download',
        count:  info.entries ? info.entries.length : 1,
        type:   info.entries ? 'playlist' : 'video',
      });
    } catch {
      res.status(400).json({ error: 'Could not fetch info. Check the URL.' });
    }
  });
});

// ── Download endpoint ─────────────────────────────────────────────────────
app.post('/api/download', async (req, res) => {
  const { url, format, resolution, audioFormat, scope } = req.body;

  if (!url) return res.status(400).json({ error: 'No URL provided' });

  // Temp working directory for this request
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulltube-'));

  const isAudio    = format === 'audio';
  const isPlaylist = scope  === 'playlist';

  // Output template
  const outTemplate = isPlaylist
    ? path.join(tmpDir, '%(playlist_title)s', '%(playlist_index)s - %(title)s.%(ext)s')
    : path.join(tmpDir, '%(title)s.%(ext)s');

  // Build yt-dlp args
  let args = [];

  if (isAudio) {
    args = [
      '-x',
      '--audio-format', audioFormat || 'mp3',
      '--audio-quality', '0',
    ];
  } else {
    const res_ = resolution || '1080';
    let fmt;
    if (res_ === 'best') {
      fmt = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    } else if (res_ === 'mkv') {
      fmt = 'bestvideo+bestaudio/best';
    } else {
      fmt = `bestvideo[height<=${res_}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${res_}][ext=mp4]/best`;
    }
    args = [
      '-f', fmt,
      '--merge-output-format', res_ === 'mkv' ? 'mkv' : 'mp4',
    ];
  }

  args.push(
    '--embed-thumbnail',
    '--add-metadata',
    '--no-playlist-reverse',
    '-o', outTemplate,
    '--no-warnings',
    url
  );

  console.log(`[download] ${url} | ${format} | ${resolution || audioFormat}`);

  const proc = spawn('yt-dlp', args, { cwd: tmpDir });

  // Stream progress via SSE isn't needed here — we just wait and send file
  let stderr = '';
  proc.stderr.on('data', d => stderr += d);

  proc.on('close', async code => {
    if (code !== 0 && code !== null) {
      cleanup(tmpDir);
      return res.status(500).json({ error: 'Download failed. ' + stderr.slice(0, 200) });
    }

    try {
      // Collect all downloaded files
      const files = walkDir(tmpDir);

      if (files.length === 0) {
        cleanup(tmpDir);
        return res.status(500).json({ error: 'No files were downloaded.' });
      }

      if (files.length === 1) {
        // Single file — send directly
        const file = files[0];
        const filename = path.basename(file);
        res.setHeader('Content-Disposition', `attachment; filename="${sanitize(filename)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        const stream = fs.createReadStream(file);
        stream.pipe(res);
        stream.on('end', () => cleanup(tmpDir));
        stream.on('error', () => cleanup(tmpDir));
      } else {
        // Multiple files — zip them
        const playlistName = path.basename(path.dirname(files[0])) || 'playlist';
        const zipName = sanitize(playlistName) + '.zip';

        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('error', () => cleanup(tmpDir));
        archive.on('end', () => cleanup(tmpDir));

        archive.pipe(res);

        files.forEach(f => {
          const rel = path.relative(tmpDir, f);
          archive.file(f, { name: rel });
        });

        archive.finalize();
      }
    } catch (e) {
      cleanup(tmpDir);
      res.status(500).json({ error: e.message });
    }
  });

  proc.on('error', err => {
    cleanup(tmpDir);
    res.status(500).json({ error: 'yt-dlp not found on server. ' + err.message });
  });

  // Clean up if client disconnects
  req.on('close', () => {
    proc.kill();
    cleanup(tmpDir);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────
function walkDir(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(full));
    } else {
      results.push(full);
    }
  });
  return results;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9.\-_ ()]/g, '_');
}

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PullTube running on port ${PORT}`);
});
