import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { NewsArticle } from '@/features/market/schemas';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeTime } from '@/lib/format';

type NewsRowProps = {
  article: NewsArticle;
  /** Show which ticker the article belongs to - needed in the combined feed. */
  showSymbol?: boolean;
};

export function NewsRow({ article, showSymbol = false }: NewsRowProps) {
  const theme = useTheme();

  async function open() {
    await WebBrowser.openBrowserAsync(article.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    });
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={article.headline}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={styles.text}>
        <ThemedText type="caption" themeColor="textMuted">
          {showSymbol ? `${article.symbol} - ` : ''}
          {article.source ?? 'News'} - {formatRelativeTime(article.publishedAt)}
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={3}>
          {article.headline}
        </ThemedText>
      </View>

      {article.imageUrl ? (
        <Image
          source={{ uri: article.imageUrl }}
          style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three - 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
  },
});
