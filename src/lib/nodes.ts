import { INSTALL_SCRIPT_URL, NODE_LIST_URL, REGISTRY_URL, type NetworkPreset } from '../config';

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

async function fetchListUrls(source: string): Promise<RegistryEntry[]> {
  try {
    const sep = source.includes('?') ? '&' : '?';
    const res = await fetchWithTimeout(`${source}${sep}t=${Date.now()}`, 8000);
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.nodes) ? body.nodes : [];
  } catch {
    return [];
  }
}

/** Static list (intro site) merged with the dynamic registry (worker). */
export async function fetchRegistryUrls(preset: NetworkPreset): Promise<string[]> {
  const [staticEntries, dynamicEntries] = await Promise.all([
    fetchListUrls(NODE_LIST_URL),
    fetchListUrls(`${REGISTRY_URL}/nodes?preset=${preset.id}`),
  ]);
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const e of [...staticEntries, ...dynamicEntries]) {
    if (!e || typeof e.url !== 'string') continue;
    if (e.preset && e.preset !== preset.id) continue;
    const url = e.url.replace(/\/+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export async function probeNode(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${url}/`, 6000);
    return res.ok;
  } catch {
    return false;
  }
}

export interface NodeInfo {
  ok: boolean;
  /** Network id reported by the node root endpoint, when it answers JSON. */
  networkId: number | null;
}

/** Probe a node and read which network it serves (root endpoint reports it). */
export async function probeNodeInfo(url: string): Promise<NodeInfo> {
  try {
    const res = await fetchWithTimeout(`${url.replace(/\/+$/, '')}/`, 8000);
    if (!res.ok) return { ok: false, networkId: null };
    let networkId: number | null = null;
    try {
      const body = await res.json();
      const n = body?.networkId ?? body?.networkID ?? body?.network?.id;
      if (typeof n === 'number') networkId = n;
    } catch {
      // A 200 with a non-JSON body still proves reachability.
    }
    return { ok: true, networkId };
  } catch {
    return { ok: false, networkId: null };
  }
}

/** First reachable registry node for this preset, or null. */
export async function pickRegistryNode(preset: NetworkPreset): Promise<string | null> {
  const urls = await fetchRegistryUrls(preset);
  const probed = await Promise.all(
    urls.map(async (url) => ({ url, ok: await probeNode(url) })),
  );
  const first = probed.find((p) => p.ok);
  return first ? first.url : null;
}

/** The one-touch installer script text (for the in-app copy button). */
export async function fetchInstallScript(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(INSTALL_SCRIPT_URL, 10000);
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes('caw-node') ? text : null;
  } catch {
    return null;
  }
}
