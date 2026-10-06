import { spawn } from 'node:child_process';

const AUDIO_BITRATE = '64k';
const IMAGE_WIDTH = '1024';

function runFfmpeg(args: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', ...args, 'pipe:1']);
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    ffmpeg.on('error', (err) => reject(new Error(`ffmpeg not available: ${err.message}`)));
    ffmpeg.on('close', (code) => {
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited with ${code}: ${Buffer.concat(errors).toString().slice(0, 300)}`));
    });
    ffmpeg.stdin.on('error', () => undefined);
    ffmpeg.stdin.end(input);
  });
}

/**
 * @param wav WAV audio
 * @returns mono MP3 at 64 kbps
 */
export function wavToMp3(wav: Buffer): Promise<Buffer> {
  return runFfmpeg(['-vn', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', AUDIO_BITRATE, '-f', 'mp3'], wav);
}

/**
 * @param image PNG or JPEG image
 * @returns JPEG scaled to 1024 px wide
 */
export function toJpeg(image: Buffer): Promise<Buffer> {
  return runFfmpeg(['-vf', `scale=${IMAGE_WIDTH}:-2`, '-q:v', '4', '-f', 'image2pipe', '-c:v', 'mjpeg'], image);
}
