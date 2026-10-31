import fs from 'fs';

['backend/api/views.py', 'backend/api/serializers.py'].forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');
    lines.forEach((l, idx) => {
        if (l.includes('getattr(')) {
            console.log(`${file}:${idx+1}: ${l.trim()}`);
        }
    });
});

