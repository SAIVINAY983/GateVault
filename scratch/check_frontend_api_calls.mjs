import fs from 'fs';
import path from 'path';

function findApiEndpoints(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findApiEndpoints(fullPath, fileList);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((l, idx) => {
                const match = l.match(/axiosInstance\.(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/);
                if (match) {
                    fileList.push({
                        method: match[1].toUpperCase(),
                        url: match[2],
                        file: path.relative('frontend/src', fullPath),
                        line: idx + 1
                    });
                }
            });
        }
    }
    return fileList;
}

const frontendCalls = findApiEndpoints('frontend/src');
console.log(`Found ${frontendCalls.length} frontend API calls:`);

// Read backend/api/urls.py and parse routes
const urlsCode = fs.readFileSync('backend/api/urls.py', 'utf8');
const urlPatterns = [];
const pathMatches = urlsCode.matchAll(/path\s*\(\s*['"]([^'"]+)['"]/g);
for (const m of pathMatches) {
    urlPatterns.push(m[1]);
}

console.log(`Backend API URL patterns (${urlPatterns.length}):`, urlPatterns);

console.log('\n--- Checking Frontend Calls against Backend Routes ---');
frontendCalls.forEach(call => {
    // Check if call.url matches any backend route (handling params like ${...} or <...>)
    const cleanUrl = call.url.replace(/\$\{[^}]+\}/g, 'PARAM').replace(/\?.*/, '');
    let matched = false;

    for (const route of urlPatterns) {
        const cleanRoute = route.replace(/<[^>]+>/g, 'PARAM');
        if (cleanUrl === cleanRoute || cleanUrl + '/' === cleanRoute || cleanUrl === cleanRoute + '/') {
            matched = true;
            break;
        }
        // Check router urls e.g. 'flats/', 'towers/', 'carriers/', 'shelves/', 'expected-deliveries/'
        const routerPrefixes = ['towers', 'flats', 'carriers', 'shelves', 'expected-deliveries'];
        if (routerPrefixes.some(p => cleanUrl.startsWith(p))) {
            matched = true;
            break;
        }
    }

    if (!matched) {
        console.warn(`[POTENTIAL MISMATCH] ${call.method} "${call.url}" at ${call.file}:${call.line}`);
    }
});

