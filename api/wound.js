/**
 * POST /api/wound — forwards a photo to the wound classifier and returns its
 * answer. Nothing is stored.
 *
 * Why a proxy rather than the browser calling the model directly:
 *
 *  1. This site promises, in privacy.html, that it makes no third-party
 *     runtime requests. A browser posting to another origin would break that
 *     promise. Going through this function keeps every request the visitor's
 *     browser makes first-party.
 *  2. The model's address can change - it is deployed separately - without
 *     touching the page or shipping a new build.
 *  3. It gives one place to be certain about what happens to the image.
 *
 * What happens to the photo: it arrives, it is forwarded, the response comes
 * back, and the function returns. It is never written to disk, never put in a
 * database, never logged, and never cached. Errors log the status code and the
 * message only - never the body, because the body is a picture of somebody's
 * injury.
 *
 * Set WOUND_API_URL in Vercel to the deployed classifier's origin, for example
 * https://wound-analyzer.vercel.app - the /predict path is added here.
 */
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const base = process.env.WOUND_API_URL;
  if (!base) {
    // Not an error the visitor caused: the page has a designed state for this.
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body.image !== 'string') {
    return res.status(400).json({ ok: false, error: 'no image' });
  }

  // data:image/jpeg;base64,AAAA...
  const match = /^data:([^;,]+);base64,(.+)$/.exec(body.image);
  if (!match) return res.status(400).json({ ok: false, error: 'image must be a base64 data URL' });

  const mime = match[1].toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) {
    return res.status(415).json({ ok: false, error: 'only JPEG or PNG' });
  }

  let bytes;
  try {
    bytes = Buffer.from(match[2], 'base64');
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'could not read image' });
  }
  if (!bytes.length) return res.status(400).json({ ok: false, error: 'empty image' });
  if (bytes.length > MAX_BYTES) {
    return res.status(413).json({ ok: false, error: 'image too large' });
  }

  try {
    const form = new FormData();
    form.append(
      'injuryImage',
      new Blob([bytes], { type: mime }),
      mime === 'image/png' ? 'upload.png' : 'upload.jpg'
    );

    // The classifier cold-starts a Keras model, so allow a generous window,
    // but never hang forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(base.replace(/\/$/, '') + '/predict', {
      method: 'POST',
      body: form,
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    if (!upstream.ok) {
      // Status only. The response body may quote the request.
      console.error('[wound] classifier returned HTTP ' + upstream.status);
      return res.status(502).json({ ok: false, error: 'classifier unavailable' });
    }

    const data = await upstream.json();
    return res.status(200).json({
      ok: true,
      label: data.label,
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      best_guess: data.best_guess,
      tips: data.tips,
      disclaimer: data.disclaimer
    });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timed out' : err.message;
    console.error('[wound] ' + reason);
    return res.status(502).json({ ok: false, error: reason === 'timed out' ? 'timed out' : 'classifier unreachable' });
  }
}
