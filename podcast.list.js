(async () => {
  const sel =
    'a[href^="/us/podcast/"],' +
    'a[href^="https://podcasts.apple.com/us/podcast/"],' +
    'a[href*="c://podcasts.apple.com/"][href*="/podcast/"],' +
    'a[href^="/"][href*="/podcast/"]';

  const scrollEl = document.querySelector('#scrollable-page') || document.scrollingElement;

  let last = 0;
  let stable = 0;

  while (stable < 5) {
    const hrefs = [...document.querySelectorAll(sel)].map(a => {
      const raw = a.getAttribute('href') || '';
      return raw.startsWith('http') ? raw : new URL(raw, location.href).href;
    });
    const uniq = new Set(hrefs);

    if (uniq.size === last) stable++;
    else { stable = 0; last = uniq.size; }

    scrollEl.scrollTo(0, scrollEl.scrollHeight);
    await new Promise(r => setTimeout(r, 800));
  }

  const out = [...new Set(
    [...document.querySelectorAll(sel)].map(a => {
      const raw = a.getAttribute('href') || '';
      return raw.startsWith('http') ? raw : new URL(raw, location.href).href;
    })
  )];

  // Expose results for later use in the console or other scripts.
  window.bigList = out;
  console.log(out);
  // In Chrome/Edge DevTools:
  copy(out.join('\n'));
})();
