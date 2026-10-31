import fs from 'fs';

const modelsCode = fs.readFileSync('backend/api/models.py', 'utf8');

// Find all properties in models.py
const lines = modelsCode.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('@property')) {
        console.log(`Property at line ${idx+1}:`);
        for (let j = idx; j < Math.min(lines.length, idx + 10); j++) {
            console.log(`  ${lines[j]}`);
            if (lines[j].trim().startsWith('return')) break;
        }
    }
});

