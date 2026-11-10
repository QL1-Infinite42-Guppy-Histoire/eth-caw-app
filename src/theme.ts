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
