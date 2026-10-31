const fs = require('fs');

let content = fs.readFileSync('backend/api/views.py', 'utf8').replace(/\r\n/g, '\n');

const feature11Header = '# ==============================================================================\n# FEATURE 11: REPORTS EXPORT & AUTOMATED DATABASE BACKUP MANAGEMENT\n# ==============================================================================';

// We want to find the header
const headerPos = content.indexOf(feature11Header);
if (headerPos === -1) {
    console.error('Header not found!');
    process.exit(1);
}

// Any occurrence of "class AdminReportsSummaryView" before headerPos indicates an accidental duplicate insertion
let beforeHeader = content.substring(0, headerPos);
let afterHeader = content.substring(headerPos);

// Count how many times AdminReportsSummaryView is before header
const summaryMarker = 'class AdminReportsSummaryView';
const endMarker = 'return Response({"error": f"Failed to read backup file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)';

while (beforeHeader.includes(summaryMarker)) {
    const startIdx = beforeHeader.indexOf(summaryMarker);
    const endIdx = beforeHeader.indexOf(endMarker, startIdx);
    if (endIdx === -1) {
        console.error('End marker not found in beforeHeader');
        break;
    }
    const cutEnd = endIdx + endMarker.length;
    beforeHeader = beforeHeader.substring(0, startIdx) + beforeHeader.substring(cutEnd);
    console.log('Removed one duplicate before header');
}

const cleaned = beforeHeader + afterHeader;
fs.writeFileSync('backend/api/views.py', cleaned, 'utf8');
console.log('Successfully written cleaned views.py');

