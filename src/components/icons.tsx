import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

// Stroke icon set (feather-style paths) drawn with react-native-svg.
// v0.3.0: every piece of app chrome uses these — no unicode glyph icons.
// All icons take a color and render outline style; `filled` variants fill
// the shape for active states (tab bar, liked heart, saved bookmark).

interface IconProps {
  size?: number;
  color: string;
  filled?: boolean;
}

function Base({
  size = 24,
  color,
  filled = false,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.3V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.3" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx={11} cy={11} r={7} />
      <Line x1={21} y1={21} x2={16.5} y2={16.5} />
    </Base>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Base>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5" />
    </Base>
  );
}

export function ReplyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Base>
  );
}

export function RecawIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Polyline points="17 1 21 5 17 9" />
      <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <Polyline points="7 23 3 19 7 15" />
      <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </Base>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Base>
  );
}

/** Bar-chart (views) icon — ascending bars, X-style. */
export function ViewsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Line x1={6} y1={20} x2={6} y2={13} />
      <Line x1={12} y1={20} x2={12} y2={4} />
      <Line x1={18} y1={20} x2={18} y2={9} />
    </Base>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Base>
  );
}

export function PlusIcon({ size = 24, color }: IconProps) {
  return (
    <Base size={size} color={color}>
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Line x1={18} y1={6} x2={6} y2={18} />
      <Line x1={6} y1={6} x2={18} y2={18} />
    </Base>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Line x1={19} y1={12} x2={5} y2={12} />
      <Polyline points="12 19 5 12 12 5" />
    </Base>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Polyline points="9 18 15 12 9 6" />
    </Base>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Polyline points="6 9 12 15 18 9" />
    </Base>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <Path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
      <Circle cx={16.5} cy={14} r={1.2} />
    </Base>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Line x1={4} y1={7} x2={17} y2={7} />
      <Polyline points="14 3.5 17.5 7 14 10.5" />
      <Line x1={20} y1={17} x2={7} y2={17} />
      <Polyline points="10 13.5 6.5 17 10 20.5" />
    </Base>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Line x1={22} y1={2} x2={11} y2={13} />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Base>
  );
}

export function ServerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Rect x={2} y={2} width={20} height={8} rx={2} />
      <Rect x={2} y={14} width={20} height={8} rx={2} />
      <Line x1={6} y1={6} x2={6.01} y2={6} />
      <Line x1={6} y1={18} x2={6.01} y2={18} />
    </Base>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Base>
  );
}

/** ID-card icon for the Names menu row. */
export function NameBadgeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Rect x={2} y={4} width={20} height={16} rx={2} />
      <Circle cx={8.5} cy={11} r={2.2} />
      <Path d="M5.6 16.6c.6-1.5 1.6-2.2 2.9-2.2s2.3.7 2.9 2.2" />
      <Line x1={15} y1={9.5} x2={19} y2={9.5} />
      <Line x1={15} y1={13.5} x2={19} y2={13.5} />
    </Base>
  );
}
