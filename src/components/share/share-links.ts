export function buildShareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    reddit: `https://www.reddit.com/submit?url=${u}&title=${t}`,
  };
}
