import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  status: string;
  label: string;
}

function usePulseScale(duration: number, toScale: number) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: toScale, duration: duration * 0.45, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1.01, duration: duration * 0.25, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: duration * 0.30, useNativeDriver: true }),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, [anim, duration, toScale]);
  return anim;
}

function usePulseOpacity(duration: number) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration * 0.5, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: duration * 0.5, useNativeDriver: true }),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, [anim, duration]);
  return anim;
}

function useShake(duration: number) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: -1.5, duration: duration * 0.13, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1.5, duration: duration * 0.13, useNativeDriver: true }),
        Animated.timing(anim, { toValue: -1, duration: duration * 0.13, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: duration * 0.13, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: duration * 0.13, useNativeDriver: true }),
        Animated.delay(duration * 0.35),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, [anim, duration]);
  return anim;
}

function useScanTranslate(duration: number, badgeWidth: number) {
  const anim = useRef(new Animated.Value(-badgeWidth * 0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: badgeWidth * 1.1,
        duration,
        useNativeDriver: true,
      }),
    ).start();
    return () => anim.stopAnimation();
  }, [anim, duration, badgeWidth]);
  return anim;
}

// Pending: scale pulse
function PendingBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  const scale = usePulseScale(2800, 1.04);
  return (
    <Animated.View style={[badge(bg), { transform: [{ scale }] }]}>
      <Text style={badgeText(color)}>{label}</Text>
    </Animated.View>
  );
}

// In progress: opacity breath + horizontal scan shimmer
function InProgressBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  const opacity = usePulseOpacity(2400);
  const scanX = useScanTranslate(2100, 80);
  return (
    <View style={[badge(bg), { overflow: 'hidden' }]}>
      <Text style={badgeText(color)}>{label}</Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, bottom: 0, width: 24,
          transform: [{ translateX: scanX }, { skewX: '-20deg' }],
          backgroundColor: 'rgba(255,255,255,0.45)',
        }}
      />
    </View>
  );
}

// Done: static (no animation needed)
function DoneBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={badge(bg)}>
      <Text style={badgeText(color)}>{label}</Text>
    </View>
  );
}

// Done with issues: opacity pulse (orange glow)
function IssuesBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  const scale = usePulseScale(2900, 1.04);
  return (
    <Animated.View style={[badge(bg), { transform: [{ scale }] }]}>
      <Text style={badgeText(color)}>{label}</Text>
    </Animated.View>
  );
}

// Problem: horizontal shake
function ProblemBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  const translateX = useShake(1500);
  return (
    <Animated.View style={[badge(bg), { transform: [{ translateX }] }]}>
      <Text style={badgeText(color)}>{label}</Text>
    </Animated.View>
  );
}

function badge(bg: string) {
  return {
    backgroundColor: bg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start' as const,
  };
}

function badgeText(color: string) {
  return { fontSize: 12, fontWeight: '700' as const, color };
}

export default function StatusBadge({ status, label }: Props) {
  const { theme } = useTheme();

  const color = (() => {
    switch (status) {
      case 'pending':          return theme.warning;
      case 'in_progress':      return theme.primary;
      case 'done':             return theme.success;
      case 'done_with_issues': return '#ea580c';
      case 'problem':          return theme.danger;
      default:                 return theme.textMuted;
    }
  })();

  const bg = (() => {
    switch (status) {
      case 'pending':          return theme.warning + '20';
      case 'in_progress':      return theme.primary + '20';
      case 'done':             return theme.success + '20';
      case 'done_with_issues': return '#ea580c20';
      case 'problem':          return theme.danger + '20';
      default:                 return theme.elevated;
    }
  })();

  switch (status) {
    case 'pending':          return <PendingBadge label={label} color={color} bg={bg} />;
    case 'in_progress':      return <InProgressBadge label={label} color={color} bg={bg} />;
    case 'done_with_issues': return <IssuesBadge label={label} color={color} bg={bg} />;
    case 'problem':          return <ProblemBadge label={label} color={color} bg={bg} />;
    default:                 return <DoneBadge label={label} color={color} bg={bg} />;
  }
}
