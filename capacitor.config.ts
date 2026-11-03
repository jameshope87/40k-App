import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jameshope.muster40k',
  appName: 'Muster & Battle',
  webDir: 'dist',
  android: {
    // Catalogue files are downloaded from GitHub at runtime.
    allowMixedContent: false,
  },
};

export default config;
