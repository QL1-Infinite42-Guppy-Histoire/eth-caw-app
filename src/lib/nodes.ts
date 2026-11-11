import { NODE_LIST_URL, type NetworkPreset } from '../config';

// Automatic node discovery: community operators can list their public node
// in a small registry JSON hosted on the introduction site. The app fetches
// it, probes entries for the active preset, and connects to the first one
// that answers — so the timeline appears as soon as a node is online,
// without the user typing a URL. A manually entered URL (Settings) always
// takes priority over the registry.

interface RegistryEntry {
  url: string;
  preset?: string;
  label?: string;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchRegistryUrls(preset: NetworkPreset): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(`${NODE_LIST_URL}?t=${Date.now()}`, 8000);
    if (!res.ok) return [];
    const body = await res.json();
    const entries: RegistryEntry[] = Array.isArray(body?.nodes) ? body.nodes : [];
    return entries
      .filter((e) => e && typeof e.url === 'string' && (!e.preset || e.preset === preset.id))
      .map((e) => e.url.replace(/\/+$/, ''));
  } catch {
    return [];
  }
}

export async function probeNode(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${url}/`, 6000);
    return res.ok;
  } catch {
    return false;
  }
}

/** First reachable registry node for this preset, or null. */
export async function pickRegistryNode(preset: NetworkPreset): Promise<string | null> {
  const urls = await fetchRegistryUrls(preset);
  for (const url of urls) {
    if (await probeNode(url)) return url;
  }
  return null;
}
