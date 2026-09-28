"""Generate the printed QR codes for the MRC posters, and refuse to save any
that does not scan.

    python tools/make_qr.py OUTDIR       (needs segno, zxing-cpp, pillow)

Each code points at https://mrcmiracle.vercel.app/q/<slug>, which counts the
scan server-side and then redirects (see api/q.js).

WHY THE SEAL IS A RISK, AND WHY EVERY FILE IS DECODED BEFORE IT IS KEPT
The seal covers the middle of the code. Error correction level H can rebuild
about 30% of a damaged code, which is what makes a centre logo possible at
all - but the new HOSA seal is far DARKER than the one it replaces (a deep
violet ring where the old seal was mostly white). Dark ink over modules is
not automatically worse than white, but it is a real change to what a scanner
sees, so nothing here is taken on faith: every PNG is decoded with ZXing at
seven sizes, down to 150px, and a file that fails any read is not written.

The SVGs are checked separately, because nothing here can rasterise one (no
libcairo on this machine, and a check that silently does not run is worse than
no check). They are rendered to a canvas in Chrome and decoded with the
browser's own BarcodeDetector - the 2026-09-19 set read back correctly at
1200, 600 and 300px, all ten files.

Do NOT check these with OpenCV's basic QRCodeDetector: it failed ~2% of codes
that ZXing and real phones read without trouble, which sent an earlier round
of this work chasing two conclusions that were both wrong.
"""
import base64
import io
import os
import sys

import segno
import zxingcpp
from PIL import Image, ImageDraw

BASE = 'https://mrcmiracle.vercel.app/q/'
INK = '#2a1550'
# The seal with the flattened black background already cut away, kept beside
# this script so regenerating the set is reproducible. The file
# Instagram/Canva exports has its transparency flattened to BLACK, and pasting
# that straight into the middle of a QR code puts a black square over the
# modules - which is why the transparent master is stored rather than re-cut
# by hand each time.
SEAL_SRC = os.environ.get(
    'MRC_SEAL',
    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 'seal-source-transparent.png'))

# Fractions of the finished PNG width, measured off the codes this replaces so
# the posters keep the same proportions.
PAD_FRAC = 0.216                            # white disc behind the seal
SEAL_FRAC = 0.170                           # the artwork itself

# Every file comes out at exactly this width so the set drops into a poster
# layout interchangeably. The module SIZE is then whatever divides evenly into
# it - a shorter URL gets a lower QR version, so fewer and bigger modules, which
# is what scans from across a library foyer. The leftover pixels widen the quiet
# zone, which only helps.
PNG_PX, PNG_BORDER = 2385, 4
SVG_SCALE, SVG_BORDER = 10, 0               # 450px, matching the old files

# Sizes a printed code realistically gets read at, plus the extremes.
CHECK_SIZES = [2385, 1200, 800, 600, 400, 300, 150]

CODES = [
    'kcls-bothell', 'kcls-kenmore', 'kcls-kingsgate', 'kcls-kirkland',
    'kcls-lake-forest-park', 'kcls-redmond', 'kcls-redmond-ridge',
    'kcls-woodinville', 'north-creek-hs', 'community-event',
]


def seal_image(px):
    """The seal on its white disc, at px by px, ready to paste."""
    art = Image.open(SEAL_SRC).convert('RGBA')
    pad = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    ImageDraw.Draw(pad).ellipse([0, 0, px - 1, px - 1], fill=(255, 255, 255, 255))
    d = int(px * SEAL_FRAC / PAD_FRAC)
    art = art.resize((d, d), Image.LANCZOS)
    off = (px - d) // 2
    pad.paste(art, (off, off), art)
    return pad


def build_png(url):
    qr = segno.make(url, error='h')
    modules = qr.symbol_size(scale=1, border=PNG_BORDER)[0]
    scale = PNG_PX // modules                    # integer: no blurred module edges
    buf = io.BytesIO()
    qr.save(buf, kind='png', scale=scale, border=PNG_BORDER, dark=INK, light='#ffffff')
    code = Image.open(buf).convert('RGB')
    img = Image.new('RGB', (PNG_PX, PNG_PX), '#ffffff')
    off = (PNG_PX - code.size[0]) // 2
    img.paste(code, (off, off))
    w = PNG_PX
    pad_px = int(round(w * PAD_FRAC))
    seal = seal_image(pad_px)
    pos = ((w - pad_px) // 2, (w - pad_px) // 2)
    img.paste(seal, pos, seal)
    return img, qr


def build_svg(url, qr):
    """Same code, same seal, as vector - for a printer that wants one. The seal
    itself is a raster embedded as a data URI: it is a photographic-style mark,
    and tracing it would change the artwork."""
    buf = io.BytesIO()
    qr.save(buf, kind='svg', scale=SVG_SCALE, border=SVG_BORDER, dark=INK,
            svgclass=None, lineclass=None, xmldecl=False, svgns=True)
    svg = buf.getvalue().decode('utf-8')
    side = qr.symbol_size(scale=SVG_SCALE, border=SVG_BORDER)[0]

    pad = side * PAD_FRAC
    seal_px = int(round(pad * 4))                      # 4x for print resolution
    s = seal_image(seal_px)
    art = io.BytesIO()
    s.save(art, format='PNG')
    b64 = base64.b64encode(art.getvalue()).decode('ascii')
    x = (side - pad) / 2
    overlay = (
        f'<image x="{x:.2f}" y="{x:.2f}" width="{pad:.2f}" height="{pad:.2f}" '
        f'xlink:href="data:image/png;base64,{b64}" '
        f'xmlns:xlink="http://www.w3.org/1999/xlink"/>'
    )
    return svg.replace('</svg>', overlay + '</svg>')


def decodes_to(img, url, sizes):
    """Every size must read back exactly the intended URL."""
    bad = []
    for s in sizes:
        test = img if img.size[0] == s else img.resize((s, s), Image.LANCZOS)
        res = zxingcpp.read_barcodes(test)
        got = res[0].text if res else None
        if got != url:
            bad.append((s, got or 'NO READ'))
    return bad


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    failures = []
    for slug in CODES:
        url = BASE + slug
        img, qr = build_png(url)
        bad = decodes_to(img, url, CHECK_SIZES)
        if bad:
            failures.append((slug, bad))
            print(f'FAIL {slug}: ' + ', '.join(f'{s}px->{g}' for s, g in bad))
            continue
        img.save(os.path.join(outdir, slug + '.png'))
        with open(os.path.join(outdir, slug + '.svg'), 'w') as f:
            f.write(build_svg(url, qr))
        print(f'ok   {slug:24s} {img.size[0]}px, read at all {len(CHECK_SIZES)} sizes')

    if failures:
        print(f'\n{len(failures)} code(s) failed and were NOT written.')
        return 1
    print(f'\nAll {len(CODES)} codes written to {outdir} and decoded at '
          f'{CHECK_SIZES} px.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))
