// Shared guard against SSRF for every place that fetches a user-supplied URL
// server-side (image/video proxy, remote asset resolution, carousel image
// persistence). Blocks loopback, private, link-local and cloud-metadata
// ranges for both IPv4 and IPv6 — including forms that a naive check misses:
// bracketed IPv6 hostnames (WHATWG URL always returns "[::1]", never "::1"),
// IPv6 unique-local/link-local ranges, and IPv4-mapped IPv6 addresses.

function isPrivateIpv4(a: number, b: number): boolean {
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata (169.254.169.254)
  if (a === 0) return true;
  return false;
}

export function isPrivateOrLinkLocalHost(rawHostname: string): boolean {
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;
  const lower = hostname.toLowerCase();

  if (lower === "localhost" || lower === "::1" || lower === "::" || lower === "") return true;

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return isPrivateIpv4(Number(ipv4[1]), Number(ipv4[2]));

  // IPv4-mapped IPv6, dotted form: ::ffff:169.254.169.254
  const mappedDotted = lower.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mappedDotted) return isPrivateIpv4(Number(mappedDotted[1]), Number(mappedDotted[2]));

  // IPv4-mapped IPv6, hex form: ::ffff:a9fe:a9fe
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIpv4((hi >> 8) & 0xff, hi & 0xff) || isPrivateIpv4((hi >> 8) & 0xff, (lo >> 8) & 0xff);
  }

  // IPv6 unique-local (fc00::/7 — first hex group is fc00-fdff) and
  // link-local (fe80::/10 — first hex group is fe80-febf).
  if (/^f[cd][0-9a-f]{0,2}(:|$)/.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]?(:|$)/.test(lower)) return true;

  return false;
}

export function assertPublicHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Apenas URLs http/https são permitidas.");
  }
  if (isPrivateOrLinkLocalHost(parsed.hostname)) {
    throw new Error("URL aponta para um host interno/privado, não permitido.");
  }
  return parsed;
}
