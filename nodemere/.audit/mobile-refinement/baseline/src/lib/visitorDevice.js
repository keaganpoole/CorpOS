export function visitorDevice(win) {
  const nav = win.navigator;
  const ua = nav.userAgent || '';
  let browser = 'unknown';
  let browserVersion = null;
  for (const [name, pattern] of [['edge', /Edg(?:e|A|iOS)?\/([\d.]+)/], ['opera', /(?:OPR|Opera)\/([\d.]+)/], ['firefox', /(?:Firefox|FxiOS)\/([\d.]+)/], ['chrome', /(?:Chrome|CriOS)\/([\d.]+)/], ['safari', /Version\/([\d.]+).*Safari/]]) {
    const match = ua.match(pattern);
    if (match) { browser = name; browserVersion = match[1].slice(0, 24); break; }
  }
  let os = 'unknown';
  let osVersion = null;
  for (const [name, pattern] of [['android', /Android ([\d.]+)/], ['ios', /(?:iPhone OS|CPU OS) ([\d_]+)/], ['windows', /Windows NT ([\d.]+)/], ['macos', /Mac OS X ([\d_]+)/], ['linux', /Linux/]]) {
    const match = ua.match(pattern);
    if (match) { os = name; osVersion = match[1]?.replaceAll('_', '.').slice(0, 24) || null; break; }
  }
  const ipad = /iPad/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (ipad) {
    // Desktop-mode iPad Safari advertises a macOS version, not its iPadOS version.
    if (os !== 'ios') osVersion = null;
    os = 'ios';
  }
  const deviceType = ipad || /Tablet|Android(?!.*Mobile)/.test(ua) ? 'tablet' : /Mobile|iPhone|iPod/.test(ua) ? 'mobile' : 'desktop';
  const dimension = value => Number.isFinite(value) ? Math.max(0, Math.min(16384, Math.round(value))) : 0;
  let timezone = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* Optional signal. */ }
  const locale = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,3}$/.test(nav.language || '') && nav.language.length <= 35 ? nav.language : null;
  const version = value => /^[0-9]{1,4}(?:\.[0-9]{1,4}){0,3}$/.test(value || '') ? value : null;
  if (!/^(?:UTC|GMT|[A-Za-z_+-]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?)$/.test(timezone || '') || timezone.length > 64) timezone = null;
  return {
    browser, browser_version: version(browserVersion), os, os_version: version(osVersion), device_type: deviceType,
    screen_width: dimension(win.screen?.width), screen_height: dimension(win.screen?.height),
    viewport_width: dimension(win.innerWidth), viewport_height: dimension(win.innerHeight),
    pixel_ratio: Math.min(8, Math.max(0.1, Number(win.devicePixelRatio) || 1)),
    timezone, language: locale?.split('-')[0] || null, locale,
    touch_support: (nav.maxTouchPoints || 0) > 0,
  };
}
