import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, SUPPORTED_LANGUAGES } from '../../i18n/i18n';

const LanguageSelector = ({ variant = 'default', size = 'sm', className = '' }) => {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelectLanguage = (code) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    // Styling variants
    const isDark = variant === 'dark';
    const isLight = variant === 'light';

    const btnClasses = isDark
        ? 'btn btn-outline-light border-opacity-25 bg-white bg-opacity-10 text-white'
        : isLight
        ? 'btn btn-light bg-light border text-dark'
        : 'btn btn-outline-secondary border-opacity-50 text-dark bg-white';

    const sizeClass = size === 'sm' ? 'btn-sm py-1 px-2' : 'py-2 px-3';

    return (
        <div className={`position-relative d-inline-block text-start ${className}`} ref={dropdownRef}>
            <button
                type="button"
                className={`d-flex align-items-center gap-2 rounded-3 shadow-sm ${btnClasses} ${sizeClass}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-label={t('common.select_language', 'Select Language')}
                style={{ fontSize: '0.84rem', fontWeight: 500 }}
            >
                <span className="d-flex align-items-center gap-1">
                    <span role="img" aria-label="globe" style={{ fontSize: '1rem' }}>🌐</span>
                    <span className="d-none d-sm-inline">{currentLanguage.nativeName}</span>
                    <span className="d-inline d-sm-none">{currentLanguage.code.toUpperCase()}</span>
                </span>
                <span style={{ fontSize: '0.65rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    ▼
                </span>
            </button>

            {isOpen && (
                <div
                    className="dropdown-menu show shadow-lg border-0 rounded-3 position-absolute end-0 mt-2 p-1 bg-white"
                    style={{ minWidth: '170px', zIndex: 1060 }}
                >
                    <div className="px-3 py-1 text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                        {t('common.select_language', 'Select Language')}
                    </div>
                    <div className="dropdown-divider my-1"></div>
                    {SUPPORTED_LANGUAGES.map((lang) => {
                        const isSelected = lang.code === i18n.language;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                className={`dropdown-item d-flex align-items-center justify-content-between rounded-2 px-3 py-2 ${
                                    isSelected ? 'bg-primary text-white fw-bold active' : 'text-dark'
                                }`}
                                onClick={() => handleSelectLanguage(lang.code)}
                                style={{ fontSize: '0.85rem' }}
                            >
                                <span className="d-flex align-items-center gap-2">
                                    <span>{lang.nativeName}</span>
                                    {lang.code !== 'en' && (
                                        <small className={isSelected ? 'text-white-50' : 'text-muted'}>
                                            ({lang.label})
                                        </small>
                                    )}
                                </span>
                                {isSelected && (
                                    <i className="bi bi-check2 fs-6"></i>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LanguageSelector;

