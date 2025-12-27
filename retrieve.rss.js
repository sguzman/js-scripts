(async () => {
  const roots = [];
  try { roots.push(globalThis); } catch {}
  try { roots.push(window); } catch {}
  try { roots.push(window.top); } catch {}

  const writeAll = (key, val) => {
    for (const r of roots) {
      try { r[key] = val; } catch {}
    }
  };

  const readAny = (key) => {
    for (const r of roots) {
      try { if (r && r[key] != null) return r[key]; } catch {}
    }
    return undefined;
  };

  const urls = readAny("bigList");
  if (!Array.isArray(urls) || urls.length === 0) {
    console.log("ERROR: bigList not found. Expected globalThis.bigList or window.bigList.");
    return;
  }

  // Immediately create state so you can see it's alive
  writeAll("__podcastMeta", { status: "started", at: new Date().toISOString(), inputUrls: urls.length });
  writeAll("__podcastFeeds", []);
  console.log("Started. inputUrls =", urls.length);

  const extractId = (u) => (String(u).match(/\/id(\d+)/) || [])[1] || null;

  const idToUrl = new Map();
  for (const u of urls) {
    const id = extractId(u);
    if (id && !idToUrl.has(id)) idToUrl.set(id, u);
  }
  const ids = [...idToUrl.keys()];
  writeAll("__podcastMeta", { status: "running", at: new Date().toISOString(), inputUrls: urls.length, uniqueIds: ids.length });
  console.log("Unique show IDs:", ids.length);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function jsonp(url, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const cb = "__itunes_cb_" + Math.random().toString(16).slice(2);
      const script = document.createElement("script");

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("JSONP timeout"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        try { delete globalThis[cb]; } catch {}
        script.remove();
      }

      globalThis[cb] = (data) => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error("JSONP script error")); };

      const sep = url.includes("?") ? "&" : "?";
      script.src = `${url}${sep}callback=${cb}`;
      document.head.appendChild(script);
    });
  }

  const CHUNK_SIZE = 200;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const resultsById = new Map();

  for (let c = 0; c < chunks.length; c++) {
    const chunkIds = chunks[c];
    console.log(`Chunk ${c + 1}/${chunks.length}: ${c * CHUNK_SIZE}/${ids.length}`);

    let data;
    try {
      data = await jsonp(`https://itunes.apple.com/lookup?id=${chunkIds.join(",")}&country=US`);
    } catch (e) {
      console.log("Chunk failed:", c + 1, String(e));
      await sleep(3500);
      continue;
    }

    for (const item of (data?.results || [])) {
      const id = String(item.collectionId ?? "");
      if (!id) continue;
      resultsById.set(id, {
        id,
        appleUrl: idToUrl.get(id) || null,
        collectionName: item.collectionName ?? null,
        artistName: item.artistName ?? null,
        feedUrl: item.feedUrl ?? null,
      });
    }

    // write partial after each chunk
    const partial = ids.map(id => resultsById.get(id) || ({
      id,
      appleUrl: idToUrl.get(id) || null,
      collectionName: null,
      artistName: null,
      feedUrl: null
    }));

    writeAll("__podcastFeeds", partial);
    writeAll("__podcastMeta", {
      status: "running",
      at: new Date().toISOString(),
      uniqueIds: ids.length,
      chunk: { index: c + 1, total: chunks.length },
      feedsFoundSoFar: partial.filter(x => x.feedUrl).length
    });

    await sleep(3500);
  }

  const out = readAny("__podcastFeeds") || [];
  const found = out.filter(x => x && x.feedUrl);
  const missing = out.filter(x => !x || !x.feedUrl);

  // Build TSV string and store it
  const tsv =
    ["collectionName", "artistName", "feedUrl", "appleUrl", "id"].join("\t") + "\n" +
    found.map(x => [
      x.collectionName ?? "",
      x.artistName ?? "",
      x.feedUrl ?? "",
      x.appleUrl ?? "",
      x.id ?? ""
    ].map(v => String(v).replaceAll("\t", " ").replaceAll("\n", " ")).join("\t")).join("\n");

  writeAll("__podcastFeedsTSV", tsv);
  writeAll("__podcastMeta", {
    status: "done",
    at: new Date().toISOString(),
    total: out.length,
    found: found.length,
    missing: missing.length
  });

  // Persist to localStorage so it can't "disappear"
  try { localStorage.setItem("__podcastFeedsJSON", JSON.stringify(out)); } catch (e) { console.log("localStorage JSON failed:", String(e)); }
  try { localStorage.setItem("__podcastFeedsTSV", tsv); } catch (e) { console.log("localStorage TSV failed:", String(e)); }

  console.log("DONE:", { total: out.length, found: found.length, missing: missing.length });
  console.log("Use:");
  console.log("  globalThis.__podcastFeeds (array)");
  console.log("  globalThis.__podcastFeedsTSV (string)");
  console.log('  JSON.parse(localStorage.getItem("__podcastFeedsJSON"))');
  console.log('  localStorage.getItem("__podcastFeedsTSV")');
})();
