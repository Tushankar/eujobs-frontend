/*
 * The browser, OS and device type of a User-Agent header, for the device list (owner 2026-11-18). First match wins, so
 * browsers that also say "Chrome" or "Safari" (Edge, Opera, Samsung) come first.
 */
const BROWSERS = [
  ['Edge', /Edg(?:e|A|iOS)?\/([\d]+)/],
  ['Opera', /(?:OPR|OPiOS)\/([\d]+)/],
  ['Samsung Internet', /SamsungBrowser\/([\d]+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/([\d]+)/],
  ['Chrome', /(?:Chrome|CriOS)\/([\d]+)/],
  ['Safari', /Version\/([\d]+).*Safari\//],
]

const SYSTEMS = [
  ['iPadOS', /iPad/],
  ['iOS', /iPhone|iPod/],
  ['Android', /Android/],
  ['ChromeOS', /CrOS/],
  ['Windows', /Windows/],
  ['macOS', /Macintosh|Mac OS X/],
  ['Linux', /Linux/],
]

/** { browser, browserVersion, os, deviceType: 'mobile' | 'tablet' | 'desktop' }; unknown parts are null. */
export function parseUserAgent(ua = '') {
  const [browser, version] = BROWSERS.map(([name, pattern]) => [name, ua.match(pattern)?.[1]]).find(([, found]) => found) ?? [null, null]
  const os = SYSTEMS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null
  const tablet = os === 'iPadOS' || (os === 'Android' && !/Mobile/.test(ua)) || /Tablet/.test(ua)
  const mobile = !tablet && (os === 'iOS' || /Mobile/.test(ua))
  return { browser, browserVersion: version ?? null, os, deviceType: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop' }
}
