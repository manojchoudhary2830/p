module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts/'],
  dependencies: {
    // Force manual linking for modules that have issues with auto-linking
    'react-native-razorpay': {
      platforms: {
        android: null, // auto-link
        ios: null,     // auto-link
      },
    },
  },
};
