import fs from 'fs';

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');

function findParcelLookups() {
    const lines = viewsCode.split('\n');
    lines.forEach((l, idx) => {
        if (l.includes('Parcel.objects.filter(') || l.includes('Parcel.objects.get(')) {
            console.log(`Line ${idx+1}: ${l.trim()}`);
        }
    });
}

findParcelLookups();

