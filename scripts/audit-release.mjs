import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(pkg.license,'SEE LICENSE IN LICENSE');
assert.ok(Object.keys(pkg.dependencies).every(name=>name.startsWith('@fontsource-variable/')),'Unexpected runtime dependency');
const lock=readFileSync('package-lock.json','utf8');
assert.doesNotMatch(lock,/@strudel\/|node_modules\/fraction\.js/);
for(const name of readdirSync('dist/assets').filter(n=>n.endsWith('.js'))){
 assert.doesNotMatch(readFileSync('dist/assets/'+name,'utf8'),/strudel|cyclist|AGPL-3\.0/i);
}
assert.equal(readFileSync('dist/LICENSE.txt','utf8'),readFileSync('LICENSE','utf8'));
assert.equal(readFileSync('dist/THIRD_PARTY_NOTICES.txt','utf8'),readFileSync('THIRD_PARTY_NOTICES.md','utf8'));
for(const name of ['Inter-OFL.txt','JetBrainsMono-OFL.txt','MuseoModerno-OFL.txt','Mastermind-MIT.txt','Vite-MIT.txt'])assert.ok(existsSync('dist/licenses/'+name));
assert.ok(!existsSync('dist/licenses/AGPL-3.0.txt'));
assert.ok(!existsSync('dist/licenses/fraction.js.txt'));
console.log('Release audit: no Strudel/fraction runtime; current and third-party license texts verified.');
