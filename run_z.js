import fs from 'fs';
let c = fs.readFileSync('refactor_z.js', 'utf8');
const output = c.substring(c.indexOf('`')+1, c.lastIndexOf('`'));
fs.writeFileSync('main.js', output.replace(/\\\\`/g, '`').replace(/\\\\\$/g, '$'), 'utf8');
