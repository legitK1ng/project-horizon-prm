
const https = require('https');

const url = 'https://script.google.com/macros/s/AKfycbx6NJUYL0a1kSEgbSDfNLpbByNmcfTUc3n1xVIjbeRlCnpwhWCV2pLv4R-6VHb-NB4/exec';

console.log("Testing IPv4 connection...");
const req = https.request(url, { method: 'HEAD', family: 4 }, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.resume();
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
