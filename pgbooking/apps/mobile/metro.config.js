const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    assetExts: defaultConfig.resolver.assetExts.filter((ext) => ext !== 'svg'),
  },
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
};

module.exports = mergeConfig(defaultConfig, config);
