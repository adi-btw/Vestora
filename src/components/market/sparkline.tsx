import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
};

/**
 * Hand-rolled with `react-native-svg` rather than a chart library: a sparkline is
 * one path, and this renders identically on iOS, Android and web.
 */
export function Sparkline({
  values,
  width = 72,
  height = 28,
  color,
  strokeWidth = 1.75,
}: SparklineProps) {
  const theme = useTheme();

  const path = useMemo(() => {
    const points = values.filter((value) => Number.isFinite(value));
    if (points.length < 2) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    // A perfectly flat series would divide by zero; draw it down the middle.
    const range = max - min || 1;
    const inset = strokeWidth / 2;
    const usableHeight = height - strokeWidth;

    return points
      .map((value, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = inset + (1 - (value - min) / range) * usableHeight;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [values, width, height, strokeWidth]);

  if (!path) {
    return <View style={{ width, height }} />;
  }

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path
        d={path}
        stroke={color ?? theme.textSecondary}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
