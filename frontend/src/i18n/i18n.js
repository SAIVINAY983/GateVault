import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import enTranslation from './locales/en/translation.json';
import hiTranslation from './locales/hi/translation.json';
import teTranslation from './locales/te/translation.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
    { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' }
];

export const STORAGE_KEY = 'gatevault_language';
export const DEFAULT_LANGUAGE = 'en';

const resources = {
    en: enTranslation,
    hi: hiTranslation,
    te: teTranslation
};

// Retrieve stored language or fallback to English
export const getStoredLanguage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && resources[stored]) {
            return stored;
        }
    } catch (e) {
        console.warn('Could not read language from localStorage', e);
    }
    return DEFAULT_LANGUAGE;
};

// Global language state and subscription bus
class I18nManager {
    constructor() {
        this.language = getStoredLanguage();
        this.listeners = new Set();
        this.updateDocumentLang(this.language);
    }

    updateDocumentLang(lang) {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = lang;
            document.documentElement.setAttribute('dir', 'ltr');
        }
    }

    changeLanguage(newLang) {
        if (!resources[newLang]) {
            console.warn(`Language '${newLang}' is not supported. Falling back to '${DEFAULT_LANGUAGE}'.`);
            newLang = DEFAULT_LANGUAGE;
        }

        if (this.language === newLang) return;

        this.language = newLang;
        try {
            localStorage.setItem(STORAGE_KEY, newLang);
        } catch (e) {
            console.warn('Could not save language to localStorage', e);
        }

        this.updateDocumentLang(newLang);
        this.notifyListeners();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try {
                cb(this.language);
            } catch (err) {
                console.error('Error in i18n subscriber', err);
            }
        });
    }

    // Resolve nested object path e.g. "auth.login_title"
    resolvePath(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
    }

    // Main translation function
    t(key, optionsOrFallback) {
        if (!key) return '';

        let fallbackText = '';
        let interpolation = {};

        if (typeof optionsOrFallback === 'string') {
            fallbackText = optionsOrFallback;
        } else if (typeof optionsOrFallback === 'object' && optionsOrFallback !== null) {
            interpolation = optionsOrFallback;
            if (optionsOrFallback.defaultValue) {
                fallbackText = optionsOrFallback.defaultValue;
            }
        }

        // 1. Try active language
        let value = this.resolvePath(resources[this.language], key);

        // 2. Fallback to English if missing
        if (value === undefined && this.language !== DEFAULT_LANGUAGE) {
            value = this.resolvePath(resources[DEFAULT_LANGUAGE], key);
        }

        // 3. Fallback to common or provided fallback
        if (value === undefined) {
            value = fallbackText || key;
        }

        // 4. Handle string interpolation: {{name}} or {name}
        if (typeof value === 'string' && Object.keys(interpolation).length > 0) {
            return value.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (_, k1, k2) => {
                const k = k1 || k2;
                return interpolation[k] !== undefined ? interpolation[k] : `{{${k}}}`;
            });
        }

        return value;
    }

    // Date & Time formatting tailored to current locale
    formatDate(date, options = {}) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const localeMap = {
            en: 'en-IN',
            hi: 'hi-IN',
            te: 'te-IN'
        };
        const locale = localeMap[this.language] || 'en-IN';
        return new Intl.DateTimeFormat(locale, options).format(d);
    }

    formatTime(date, options = { hour: '2-digit', minute: '2-digit' }) {
        return this.formatDate(date, options);
    }
}

export const i18n = new I18nManager();

// React Hook for functional components
export const useTranslation = () => {
    const [currentLang, setCurrentLang] = useState(i18n.language);

    useEffect(() => {
        const unsubscribe = i18n.subscribe((newLang) => {
            setCurrentLang(newLang);
        });
        return unsubscribe;
    }, []);

    const t = useCallback((key, optionsOrFallback) => {
        return i18n.t(key, optionsOrFallback);
    }, [currentLang]);

    const changeLanguage = useCallback((lang) => {
        i18n.changeLanguage(lang);
    }, []);

    const formatDate = useCallback((date, options) => {
        return i18n.formatDate(date, options);
    }, [currentLang]);

    const formatTime = useCallback((date, options) => {
        return i18n.formatTime(date, options);
    }, [currentLang]);

    return {
        t,
        i18n: {
            language: currentLang,
            changeLanguage,
            languages: SUPPORTED_LANGUAGES,
            formatDate,
            formatTime
        }
    };
};

export default i18n;

