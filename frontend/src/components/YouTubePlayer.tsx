import { Linking, Platform, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";

import { BACKEND_URL } from "@/src/api";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "./Icon";

export function YouTubePlayer({ videoId, openLabel }: { videoId: string; openLabel: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  if (Platform.OS === "web") {
    return (
      <Pressable testID="youtube-player-web" style={s.frame} onPress={() => Linking.openURL(watchUrl)}>
        <Image source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }} style={s.fill} contentFit="cover" />
        <View style={s.play}>
          <Icon name="play" size={34} color={colors.onBrandSecondary} />
        </View>
        <Text style={s.hint}>{openLabel}</Text>
      </Pressable>
    );
  }
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style></head><body><iframe src="https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></body></html>`;
  return (
    <View style={s.frame} testID="youtube-player">
      <WebView
        source={{ html, baseUrl: BACKEND_URL }}
        style={s.fill}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith("https://www.youtube.com/watch") || req.url.includes("youtube.com/redirect")) {
            Linking.openURL(req.url);
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  hint: { position: "absolute", bottom: spacing.sm, color: c.onSurface, fontFamily: fonts.text, fontSize: 12, backgroundColor: c.scrim, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
}));
