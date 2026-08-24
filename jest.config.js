module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-firebase|@react-navigation|@op-engineering|react-native-url-polyfill|react-native-image-picker)/)',
  ],
  moduleNameMapper: {
    '^@op-engineering/op-sqlite$': '<rootDir>/__mocks__/@op-engineering/op-sqlite.js',
    '^@react-native-community/netinfo$': '@react-native-community/netinfo/jest/netinfo-mock.js',
    '^@react-native-firebase/messaging$': '<rootDir>/__mocks__/@react-native-firebase/messaging.js',
    '^@notifee/react-native$': '<rootDir>/__mocks__/@notifee/react-native.js',
  },
};






