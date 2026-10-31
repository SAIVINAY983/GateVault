import fs from 'fs';

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');
const lines = viewsCode.split('\n');

const lineNumbers = [77, 618, 634, 654, 895, 932, 1025, 1060, 1126, 1177, 1691, 1756];

lineNumbers.forEach(ln => {
    console.log(`\n--- Context around line ${ln} ---`);
    for (let i = Math.max(0, ln - 5); i < Math.min(lines.length, ln + 6); i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
});

