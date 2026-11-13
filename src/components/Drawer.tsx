import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import { STRINGS, type Lang } from '../i18n';
import { getUserProfile, type Session } from '../lib/api';
import type { OwnedName } from '../lib/mint';
import {
  BellIcon,
  BookmarkIcon,
  GearIcon,
  NameBadgeIcon,
  PersonIcon,
  ServerIcon,
  SwapIcon,
  WalletIcon,
} from './icons';
import UserAvatar from './UserAvatar';

interface Props {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  /** The acting (sender) name, or null when the wallet owns none / none is authorized. */
  name: OwnedName | null;
  session: Session | null;
  onOpenProfile: () => void;
  onOpenWallet: () => void;
  onOpenNames: () => void;
  onOpenSwap: () => void;
  onOpenBookmarks: () => void;
  onOpenNotifications: () => void;
  onOpenServer: () => void;
  onOpenSettings: () => void;
}

/**
 * The X-style left drawer — the app's menu home (v0.4.0, ported from
 * the QL1 CAW app's v0.6.2 drawer, same form and metrics): a white
 * panel sliding in from the left at ~84% of the screen width, the
 * uncovered strip dimmed by a scrim; tap the scrim (or Android back,
 * wired in App) to close. The slide is RN's built-in Animated only.
 *
 * Contents (QL1 layout):
 *  1. Profile summary — 52px avatar, display name, "@handle · #id",
 *     and the follow line from the node's own profile read (the same
 *     getUserProfile source the profile page shows). Unread renders
 *     the dash, never an invented number. Tapping the summary opens
 *     the user's OWN profile page. No name yet: the honest prompt +
 *     the Get-a-name entry.
 *  2. Menu rows (vector icon + bold label): Profile / Wallet /
 *     Names / Swap / Bookmarks / Notifications / Server. The Server
 *     row carries the node connection status on its right side —
 *     node status stays visible in this app (the header chip shows
 *     it too); Send has NO drawer row: it is consolidated into the
 *     wallet screen's action buttons, exactly as in QL1.
 *  3. A hairline, then Settings low (X places settings low).
 */
export default function Drawer({
  open,
  onClose,
  lang,
  name,
  session,
  onOpenProfile,
  onOpenWallet,
  onOpenNames,
  onOpenSwap,
  onOpenBookmarks,
  onOpenNotifications,
  onOpenServer,
  onOpenSettings,
}: Props) {
  const t = STRINGS[lang];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.round(width * 0.84);

  const [mounted, setMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  /* Follow counts — the profile page's source (getUserProfile),
   * read while the drawer is open; null (unread) renders the dash. */
  const [followers, setFollowers] = useState<number | null>(null);
  const [following, setFollowing] = useState<number | null>(null);
  const nameKey = name ? name.name : null;
  useEffect(() => {
    if (!open || !nameKey) return;
    let live = true;
    setFollowers(null);
    setFollowing(null);
    getUserProfile(session, nameKey)
      .then((p) => {
        if (!live) return;
        setFollowers(p.followerCount);
        setFollowing(p.followingCount);
      })
      .catch(() => {
        if (live) {
          setFollowers(null);
          setFollowing(null);
        }
      });
    return () => {
      live = false;
    };
  }, [open, nameKey, session]);

  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelW, 0],
  });
  const scrimOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!mounted) return null;

  const ink = xColors.text;
  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.backToTimeline}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelW,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* 1. Profile summary → the own profile page. */}
        {name ? (
          <Pressable
            onPress={go(onOpenProfile)}
            style={({ pressed }) => [styles.summary, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            {name.imageSvg ? (
              <View style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden' }}>
                <SvgXml xml={name.imageSvg} width={52} height={52} />
              </View>
            ) : (
              <UserAvatar label={name.name} seed={name.name} size={52} />
            )}
            <Text style={styles.summaryName} numberOfLines={1}>
              {name.name}
            </Text>
            <Text style={styles.small} numberOfLines={1}>
              @{name.name} · #{name.tokenId}
            </Text>
            <Text style={styles.followLine} numberOfLines={1}>
              <Text style={styles.followNum}>{following !== null ? String(following) : '—'}</Text>
              <Text style={styles.followLabel}> {t.followingLabel}</Text>
              <Text style={styles.followNum}>{'  '}{followers !== null ? String(followers) : '—'}</Text>
              <Text style={styles.followLabel}> {t.followersLabel}</Text>
            </Text>
          </Pressable>
        ) : (
          <View style={styles.summary}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 52, height: 52, borderRadius: 26 }}
            />
            <Text style={[styles.small, { marginTop: 10 }]}>{t.noNamesYet}</Text>
            <Pressable style={[styles.bigBtn, { marginTop: 12 }]} onPress={go(onOpenNames)}>
              <Text style={styles.bigBtnText}>{t.tabMint}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.hairline} />

        {/* 2. Menu rows. */}
        {name ? (
          <DrawerRow
            icon={<PersonIcon size={23} color={ink} />}
            label={t.tabProfile}
            onPress={go(onOpenProfile)}
          />
        ) : null}
        <DrawerRow
          icon={<WalletIcon size={23} color={ink} />}
          label={t.menuWallet}
          onPress={go(onOpenWallet)}
        />
        <DrawerRow
          icon={<NameBadgeIcon size={23} color={ink} />}
          label={t.menuNames}
          onPress={go(onOpenNames)}
        />
        <DrawerRow
          icon={<SwapIcon size={23} color={ink} />}
          label={t.tabSwap}
          onPress={go(onOpenSwap)}
        />
        <DrawerRow
          icon={<BookmarkIcon size={23} color={ink} />}
          label={t.bookmarksTitle}
          onPress={go(onOpenBookmarks)}
        />
        <DrawerRow
          icon={<BellIcon size={23} color={ink} />}
          label={t.notifTitle}
          onPress={go(onOpenNotifications)}
        />
        <DrawerRow
          icon={<ServerIcon size={23} color={ink} />}
          label={t.tabNode}
          onPress={go(onOpenServer)}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: session ? xColors.recaw : xColors.divider,
                }}
              />
              <Text style={{ fontSize: 11.5, color: session ? xColors.accent : xColors.sub }}>
                {session ? t.chipConnected : t.headerWaiting}
              </Text>
            </View>
          }
        />

        <View style={styles.hairline} />

        {/* 3. Settings, low (X's placement). */}
        <DrawerRow
          icon={<GearIcon size={23} color={ink} />}
          label={t.tabSettings}
          onPress={go(onOpenSettings)}
        />
      </Animated.View>
    </View>
  );
}

function DrawerRow({
  icon,
  label,
  onPress,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f7f9f9' }]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {right ? <View style={{ marginStart: 'auto' }}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 20, 25, 0.45)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    elevation: 16,
  },
  summary: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  summaryName: {
    fontSize: 19,
    fontWeight: '800',
    color: xColors.text,
    marginTop: 10,
  },
  small: { fontSize: 13, color: xColors.sub, lineHeight: 19 },
  followLine: { marginTop: 8, fontSize: 14 },
  followNum: { fontWeight: '800', color: xColors.text },
  followLabel: { color: xColors.sub },
  hairline: {
    borderBottomWidth: 1,
    borderBottomColor: xColors.border,
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  rowIcon: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: xColors.text,
    marginStart: 16,
  },
  bigBtn: {
    backgroundColor: xColors.accent,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    alignSelf: 'flex-start',
  },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
