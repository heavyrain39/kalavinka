import {copyFileSync} from 'node:fs';
copyFileSync('LICENSE', 'public/LICENSE.txt');
copyFileSync('THIRD_PARTY_NOTICES.md', 'public/THIRD_PARTY_NOTICES.txt');
