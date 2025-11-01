import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Translation resources
import en from './locales/en.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
  fr: { translation: fr },
};

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const language = await AsyncStorage.getItem('user-language');
      callback(language || 'en');
    } catch (error) {
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem('user-language', language);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3', // For React Native compatibility
    resources,
    fallbackLng: 'en',
    debug: false, // Disable debug to avoid errors
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
  });

export default i18n;