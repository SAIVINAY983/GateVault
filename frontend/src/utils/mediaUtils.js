export const resolveMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'https://gatevault.onrender.com/api/').replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

