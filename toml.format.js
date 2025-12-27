function tomlFormat(cat) {
    const string = globalThis.__podcastFeeds.map(a => `[[feeds]]\nid = "podcasts-${cat}-${a.id}"\nurl = "${a.feedUrl}"\nbase_poll_seconds = 1000\n`);

    console.log(string.join('\n'))
}

