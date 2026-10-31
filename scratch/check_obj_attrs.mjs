import fs from 'fs';

const serializersCode = fs.readFileSync('backend/api/serializers.py', 'utf8');
const lines = serializersCode.split('\n');

lines.forEach((l, idx) => {
    const matches = l.match(/obj\.([a-zA-Z0-9_]+)/g);
    if (matches) {
        matches.forEach(m => {
            const attr = m.replace('obj.', '');
            // check if attr is accessed directly without try/except or if
            if (attr === 'inspection' || attr === 'verification' || attr === 'resident_profile' || attr === 'guard_profile') {
                console.log(`Line ${idx+1}: ${l.trim()}`);
            }
        });
    }
});

