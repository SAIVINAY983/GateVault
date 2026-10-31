import fs from 'fs';

const files = ['backend/api/views.py', 'backend/api/serializers.py', 'backend/api/models.py'];

files.forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');
    lines.forEach((l, idx) => {
        if (l.includes('.inspection') || l.includes('inspection')) {
            if (l.includes('.inspection')) {
                console.log(`${file}:${idx+1}: ${l.trim()}`);
            }
        }
    });
});

