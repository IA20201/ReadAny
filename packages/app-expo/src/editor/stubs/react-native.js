/**
 * Stub for react-native in the web (WebView) bundle.
 *
 * The tentap bridge files reference react-native for Platform checks and
 * type imports, none of which are needed inside the browser context.
 * This shim prevents esbuild from trying to bundle the real react-native
 * (which uses Flow syntax that esbuild cannot parse).
 */
module.exports = {
  Platform: { OS: "web", select: (obj) => obj.default ?? obj.web ?? undefined },
  Keyboard: { dismiss: () => {} },
  StyleSheet: { create: (s) => s },
  Animated: {},
  View: null,
  Text: null,
  TextInput: null,
  TouchableOpacity: null,
  ScrollView: null,
  FlatList: null,
  Image: null,
  Modal: null,
  Pressable: null,
  Alert: { alert: () => {} },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  useColorScheme: () => "light",
  useWindowDimensions: () => ({ width: 375, height: 812 }),
};
