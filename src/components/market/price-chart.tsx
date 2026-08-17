import { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import type { Bar } from '@/features/market/schemas';
import { useTheme } from '@/hooks/use-theme';

type PriceChartProps = {
  bars: Bar[];
  height?: number;
  /** Baseline used to color the series - normally the previous close. */
  baseline?: number | null;
  onScrub?: (bar: Bar | null) => void;
};

const VERTICAL_PADDING = 12;

/**
 * Built directly on `react-native-svg` rather than a charting library.
 *
 * A price series is one line, one filled area and a scrub indicator, and doing it
 * by hand means identical rendering on iOS, Android and web plus full control of
 * the touch behaviour - most RN chart libraries support only a subset of those.
 */
export function PriceChart({ bars, height = 220, baseline, onScrub }: PriceChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const closes = useMemo(() => bars.map((bar) => bar.c), [bars]);

  const scale = useMemo(() => {
    if (closes.length < 2 || width === 0) return null;

    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || Math.abs(max) * 0.02 || 1;
    const usableHeight = height - VERTICAL_PADDING * 2;

    return {
      x: (index: number) => (index / (closes.length - 1)) * width,
      y: (value: number) => VERTICAL_PADDING + (1 - (value - min) / range) * usableHeight,
      min,
      max,
    };
  }, [closes, width, height]);

  const paths = useMemo(() => {
    if (!scale) return null;

    const line = closes
      .map((value, index) => `${index === 0 ? 'M' : 'L'}${scale.x(index)},${scale.y(value)}`)
      .join(' ');

    return {
      line,
      area: `${line} L${width},${height} L0,${height} Z`,
    };
  }, [closes, scale, width, height]);

  const isUp = useMemo(() => {
    if (closes.length === 0) return true;
    const reference = baseline ?? closes[0];
    return closes[closes.length - 1] >= reference;
  }, [closes, baseline]);

  const seriesColor = isUp ? theme.up : theme.down;

  // The gesture handlers below are rebuilt whenever this callback changes, so
  // reading width and length directly cannot go stale.
  const updateScrub = useCallback(
    (locationX: number) => {
      if (width === 0 || bars.length === 0) return;

      const ratio = Math.min(Math.max(locationX / width, 0), 1);
      const index = Math.round(ratio * (bars.length - 1));
      setActiveIndex(index);
      onScrub?.(bars[index] ?? null);
    },
    [bars, width, onScrub],
  );

  const clearScrub = useCallback(() => {
    setActiveIndex(null);
    onScrub?.(null);
  }, [onScrub]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateScrub(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateScrub(event.nativeEvent.locationX),
        onPanResponderRelease: clearScrub,
        onPanResponderTerminate: clearScrub,
      }),
    [updateScrub, clearScrub],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}>
      {paths && scale ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="priceChartFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={seriesColor} stopOpacity={0.22} />
              <Stop offset="1" stopColor={seriesColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {baseline != null && baseline >= scale.min && baseline <= scale.max ? (
            <Line
              x1={0}
              y1={scale.y(baseline)}
              x2={width}
              y2={scale.y(baseline)}
              stroke={theme.borderStrong}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}

          <Path d={paths.area} fill="url(#priceChartFill)" />
          <Path
            d={paths.line}
            stroke={seriesColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {activeIndex != null && closes[activeIndex] != null ? (
            <>
              <Line
                x1={scale.x(activeIndex)}
                y1={0}
                x2={scale.x(activeIndex)}
                y2={height}
                stroke={theme.textMuted}
                strokeWidth={1}
              />
              <Circle
                cx={scale.x(activeIndex)}
                cy={scale.y(closes[activeIndex])}
                r={5}
                fill={seriesColor}
                stroke={theme.background}
                strokeWidth={2}
              />
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
});
