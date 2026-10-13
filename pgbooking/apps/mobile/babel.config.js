module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@screens': './src/screens',
          '@components': './src/components',
          '@store': './src/store',
          '@api': './src/api',
          '@theme': './src/theme',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@navigation': './src/navigation',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
