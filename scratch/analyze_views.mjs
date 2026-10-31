import fs from 'fs';

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');

// Find all view classes
const lines = viewsCode.split('\n');
const views = [];
let currentView = null;

lines.forEach((l, idx) => {
    const classMatch = l.match(/^class\s+([A-Za-z0-9_]+)\s*\(([^)]+)\):/);
    if (classMatch) {
        if (currentView) views.push(currentView);
        currentView = {
            name: classMatch[1],
            base: classMatch[2],
            startLine: idx + 1,
            methods: []
        };
    } else if (currentView) {
        const methodMatch = l.match(/^\s+def\s+([A-Za-z0-9_]+)\s*\(/);
        if (methodMatch) {
            currentView.methods.push({ name: methodMatch[1], line: idx + 1 });
        }
    }
});
if (currentView) views.push(currentView);

console.log(`Found ${views.length} views in views.py.`);

// Check for any methods without return statements
views.forEach(v => {
    // console.log(`View: ${v.name} (${v.base}) -> methods: ${v.methods.map(m => m.name).join(', ')}`);
});

