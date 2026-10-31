const fs = require('fs');

const reportsPy = fs.readFileSync('backend/api/reports.py', 'utf8');

// Check for any other canvas or reportlab references outside guards
const lines = reportsPy.split('\n');
console.log('Total lines in reports.py:', lines.length);

// Check if NumberedCanvas is defined safely
const numberedCanvasMatches = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('NumberedCanvas')) {
    numberedCanvasMatches.push((i+1) + ': ' + lines[i]);
  }
}
console.log('NumberedCanvas occurrences:');
numberedCanvasMatches.forEach(m => console.log('  ', m));

// Check if openpyxl or reportlab are referenced directly without checks
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('openpyxl.') && !line.includes('import openpyxl')) {
    console.log('openpyxl reference at line', i+1, ':', line.trim());
  }
}

