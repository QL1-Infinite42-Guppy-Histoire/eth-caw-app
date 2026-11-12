import { StyleSheet } from 'react-native';

// Light theme matching the UI concept image (white default, per the
// Guppy's Guide tool-site convention).
export const colors = {
  bg: '#f7f9fb',
  card: '#ffffff',
  ink: '#0f172a',
  sub: '#64748b',
  faint: '#94a3b8',
  accent: '#0e7490',
  accentDark: '#164e63',
  danger: '#dc2626',
  line: '#e2e8f0',
};

// X (Twitter)-style design tokens for the v0.2.0 reskin of the social
// surfaces (app chrome, Home, Compose). The legacy tokens above are kept
// untouched so the tool screens (Mint / Swap / Send / Node / Settings)
// keep their current look until their own reskin.
export const xColors = {
  bg: '#ffffff',
  text: '#0f1419',
  sub: '#536471',
  accent: '#1d9bf0',
  border: '#eff3f4',
  divider: '#cfd9de',
  like: '#f91880',
  recaw: '#00ba7c',
  danger: '#dc2626',
};

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 6 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.ink },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.sub, lineHeight: 17 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  ghostButton: {
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  ghostText: { color: colors.accentDark, fontSize: 15, fontWeight: '600' },
  dangerText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
