import fs from 'fs';

console.log('--- Checking backend files for bugs ---');

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');
const modelsCode = fs.readFileSync('backend/api/models.py', 'utf8');
const serializersCode = fs.readFileSync('backend/api/serializers.py', 'utf8');
const urlsCode = fs.readFileSync('backend/api/urls.py', 'utf8');
const adminCode = fs.readFileSync('backend/api/admin.py', 'utf8');

// 1. Check for 'handover_timestamp' or other non-existent fields
console.log('\n1. Checking for known field anomalies:');
const checkField = (code, field, fileName) => {
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes(field)) {
            console.log(`[${fileName}:${idx+1}] ${line.trim()}`);
        }
    });
};

checkField(viewsCode, 'handover_timestamp', 'views.py');
checkField(serializersCode, 'handover_timestamp', 'serializers.py');
checkField(viewsCode, '.is_full()', 'views.py');
checkField(viewsCode, '.is_expired()', 'views.py');
checkField(serializersCode, '.is_full()', 'serializers.py');
checkField(serializersCode, '.is_expired()', 'serializers.py');

// 2. Check for unsafe navigation: .shelf.name, .carrier.name, .flat.tower
console.log('\n2. Checking unsafe navigation on potentially null foreign keys:');
const unsafePatterns = [
    { pattern: /\.shelf\.name/g, name: '.shelf.name' },
    { pattern: /\.carrier\.name/g, name: '.carrier.name' },
    { pattern: /\.flat\.tower/g, name: '.flat.tower' },
    { pattern: /\.resident_profile\./g, name: '.resident_profile.' },
    { pattern: /\.guard_profile\./g, name: '.guard_profile.' },
    { pattern: /\.inspection\./g, name: '.inspection.' }
];

for (const { pattern, name } of unsafePatterns) {
    const vMatches = [...viewsCode.matchAll(pattern)];
    const sMatches = [...serializersCode.matchAll(pattern)];
    console.log(`Unsafe pattern ${name}: ${vMatches.length} in views.py, ${sMatches.length} in serializers.py`);
}

// 3. Check for undefined imports in urls.py from views.py
console.log('\n3. Checking URL view imports:');
const viewsExported = new Set();
const classMatches = viewsCode.matchAll(/class\s+([A-Za-z0-9_]+)\s*\(/g);
for (const m of classMatches) {
    viewsExported.add(m[1]);
}
const funcMatches = viewsCode.matchAll(/def\s+([A-Za-z0-9_]+)\s*\(/g);
for (const m of funcMatches) {
    viewsExported.add(m[1]);
}

const urlImportsMatch = urlsCode.match(/from \.views import \(([\s\S]*?)\)/);
if (urlImportsMatch) {
    const imports = urlImportsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const imp of imports) {
        if (!viewsExported.has(imp)) {
            console.error(`[ERROR in urls.py] Imported view not found in views.py: "${imp}"`);
        }
    }
}

// 4. Check for undefined serializers in views.py
console.log('\n4. Checking Serializer imports in views.py:');
const serializersExported = new Set();
const sClassMatches = serializersCode.matchAll(/class\s+([A-Za-z0-9_]+)\s*\(/g);
for (const m of sClassMatches) {
    serializersExported.add(m[1]);
}

const viewsSerImportsMatch = viewsCode.match(/from \.serializers import \(([\s\S]*?)\)/);
if (viewsSerImportsMatch) {
    const imports = viewsSerImportsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const imp of imports) {
        if (!serializersExported.has(imp)) {
            console.error(`[ERROR in views.py] Imported serializer not found in serializers.py: "${imp}"`);
        }
    }
}

// 5. Check for undefined models in views.py and serializers.py
console.log('\n5. Checking Model imports:');
const modelsExported = new Set();
const mClassMatches = modelsCode.matchAll(/class\s+([A-Za-z0-9_]+)\s*\(/g);
for (const m of mClassMatches) {
    modelsExported.add(m[1]);
}

const checkModelImports = (code, fileName) => {
    const match = code.match(/from \.models import \(([\s\S]*?)\)/);
    if (match) {
        const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
        for (const imp of imports) {
            if (!modelsExported.has(imp)) {
                console.error(`[ERROR in ${fileName}] Imported model not found in models.py: "${imp}"`);
            }
        }
    }
};
checkModelImports(viewsCode, 'views.py');
checkModelImports(serializersCode, 'serializers.py');
checkModelImports(adminCode, 'admin.py');

