const text = "I'm starting to get super fucking pissed off with this. Switch to the main GuardianAgent repo";
const match = text.match(/\b(?:switch|attach|change to|connect)\s+(?:to\s+)?(?:the\s+)?(.*)/i);
console.log(match ? match[1] : null);
