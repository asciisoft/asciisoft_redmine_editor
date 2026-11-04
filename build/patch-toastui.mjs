// TOAST UI Editor 3.2.2 의 esm 빌드에 내장된 DOMPurify 2.3.3 을 제거하고
// npm 의 dompurify(2.5.9, 보안 패치 버전)를 쓰도록 바꾼다. 여러 번 실행해도 안전하다.
import fs from 'node:fs';
const file = 'node_modules/@toast-ui/editor/dist/esm/index.js';
let src = fs.readFileSync(file, 'utf8');
if (src.includes('__asciisoftPurify')) { console.log('already patched'); process.exit(0); }
const start = src.indexOf('/*! @license DOMPurify 2.3.3');
const endMarker = 'var purify = createDOMPurify();';
const end = src.indexOf(endMarker);
if (start < 0 || end < 0 || end < start) { console.error('patch target not found'); process.exit(1); }
src = src.slice(0, start) + "import __asciisoftPurify from 'dompurify';\nvar purify = __asciisoftPurify;" + src.slice(end + endMarker.length);
fs.writeFileSync(file, src);
console.log('patched');
