import fs from 'fs';
let c = fs.readFileSync('main.js', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('main.js', c, 'utf8');
