import fs from 'fs';

function findLines(fileName, pattern) {
    const code = fs.readFileSync(fileName, 'utf8');
    const lines = code.split('\n');
    console.log(`\n=== Matches for ${pattern} in ${fileName} ===`);
    lines.forEach((line, idx) => {
        if (pattern.test(line)) {
            console.log(`Line ${idx+1}: ${line.trim()}`);
        }
    });
}

findLines('backend/api/serializers.py', /\.shelf\.name/);
findLines('backend/api/views.py', /\.shelf\.name/);

findLines('backend/api/serializers.py', /\.carrier\.name/);
findLines('backend/api/serializers.py', /\.flat\.tower/);
findLines('backend/api/serializers.py', /\.resident_profile\./);
findLines('backend/api/serializers.py', /\.inspection\./);

findLines('backend/api/views.py', /\.flat\.tower/);
findLines('backend/api/views.py', /\.resident_profile\./);
findLines('backend/api/views.py', /\.carrier\.name/);

