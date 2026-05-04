const path = require('path');

// Carga explícita del .env en la raíz del proyecto Expo (MOVIL).
// Evita que process.env quede sin EXPO_PUBLIC_* si el CLI no aplicó dotenv antes del serializer.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const appJson = require('./app.json');

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    },
  },
};
