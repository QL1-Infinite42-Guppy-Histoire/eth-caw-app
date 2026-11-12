import React from 'react';
import { Image, Text, View } from 'react-native';

// Shared generated avatar. This protocol carries no profile photos of its
// own: when the node payload happens to carry an avatarUrl we show it,
// otherwise a deterministic colored circle with the name's initial — the
// same fallback the app has always used (never a fabricated photo).

const AVATAR_COLORS = ['#1d9bf0', '#794bc4', '#f91880', '#00ba7c', '#ff7a00', '#0f7b6c'];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface Props {
  /** Display name / handle used for the initial letter. */
  label: string;
  /** Stable seed for the background color (address, username or token id). */
  seed: string;
  size?: number;
  avatarUrl?: string | null;
}

export default function UserAvatar({ label, seed, size = 48, avatarUrl }: Props) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const initial = (label.replace(/^@/, '').charAt(0) || 'C').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(seed || label),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: Math.round(size * 0.42) }}>
        {initial}
      </Text>
    </View>
  );
}
