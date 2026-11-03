import type { Seg } from './rows'

export const BLOCK = '▀'
export const EXIT_NO_DRAWER = 3
export const EXIT_DRAW_FAILED = 4

export const BLOCK_POLICY = [
  '<policymap>',
  '  <policy domain="delegate" rights="none" pattern="*"/>',
  '  <policy domain="coder" rights="none" pattern="*"/>',
  '  <policy domain="coder" rights="read" pattern="PNG"/>',
  '  <policy domain="coder" rights="write" pattern="RGB"/>',
  '  <policy domain="path" rights="none" pattern="@*"/>',
  '  <policy domain="filter" rights="none" pattern="*"/>',
  '</policymap>',
].join('\n')

export const BLOCKS = [
  'src=$1 base=$2 w=$3 h=$4 policy=$5 paper=${6:-#000000}',
  'd=$(mktemp -d "$base/filetree-blocks.XXXXXX") || exit 1',
  'trap \'rm -rf "$d"\' EXIT',
  'printf "%s\\n" "$policy" > "$d/policy.xml" || exit 1',
  'tried=',
  'if command -v magick >/dev/null 2>&1; then tried=1; MAGICK_CONFIGURE_PATH="$d" magick -limit memory 256MiB -limit map 512MiB -limit area 128MP -limit width 32KP -limit height 32KP -limit time 20 "png:$src[0]" -auto-orient -background "$paper" -alpha remove -alpha off -resize "${w}x${h}!" -depth 8 "rgb:$d/px" && [ -s "$d/px" ] && { od -An -tu1 -v -- "$d/px"; exit 0; }; fi',
  'if command -v ffmpeg >/dev/null 2>&1; then tried=1; ffmpeg -nostdin -v error -y -protocol_whitelist file -f image2 -i "file:$src" -frames:v 1 -vf "scale=$w:$h:flags=area" -f rawvideo -pix_fmt rgb24 "$d/px" && [ -s "$d/px" ] && { od -An -tu1 -v -- "$d/px"; exit 0; }; fi',
  '[ -n "$tried" ] && exit 4',
  'echo "no magick or ffmpeg on PATH to draw it" >&2; exit 3',
].join('\n')

export function parseRgb(text: string, width: number, height: number): Uint8Array | null {
  const nums = text.trim().split(/\s+/).filter(Boolean).map(Number)
  if (nums.length !== width * height * 3 || nums.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return Uint8Array.from(nums)
}

export function blockRows(px: Uint8Array, columns: number, rows: number): Seg[][] {
  const q = (v: number) => Math.min(255, Math.round(v / 8) * 8)
  const hex = (at: number) => `#${[0, 1, 2].map(k => q(px[at + k] ?? 0).toString(16).padStart(2, '0')).join('')}`
  const out: Seg[][] = []
  for (let y = 0; y < rows; y++) {
    const segs: Seg[] = []
    for (let x = 0; x < columns; x++) {
      const c = hex((2 * y * columns + x) * 3)
      const bg = hex(((2 * y + 1) * columns + x) * 3)
      const last = segs[segs.length - 1]
      if (last && last.c === c && last.bg === bg) last.t += BLOCK
      else segs.push({ t: BLOCK, c, bg })
    }
    out.push(segs)
  }
  return out
}
