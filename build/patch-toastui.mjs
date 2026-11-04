// TOAST UI Editor 3.2.2 esm 빌드 보정. 여러 번 실행해도 안전하다.
// 1) 내장 DOMPurify 2.3.3 을 제거하고 npm 의 dompurify(2.5.9, 보안 패치 버전)를 쓴다
// 2) 툴바 항목을 '더보기'로 숨기지 않고, 공간이 모자라면 CSS 로 줄바꿈한다
import fs from 'node:fs';
const file = 'node_modules/@toast-ui/editor/dist/esm/index.js';
let src = fs.readFileSync(file, 'utf8');
if (!src.includes('__asciisoftPurify')) {
  const start = src.indexOf('/*! @license DOMPurify 2.3.3');
  const endMarker = 'var purify = createDOMPurify();';
  const end = src.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) { console.error('DOMPurify patch target not found'); process.exit(1); }
  src = src.slice(0, start) + "import __asciisoftPurify from 'dompurify';\nvar purify = __asciisoftPurify;" + src.slice(end + endMarker.length);
  console.log('patched: DOMPurify');
}
if (src.includes('var INLINE_PADDING = 50;')) {
  src = src.replace('var INLINE_PADDING = 50;', 'var INLINE_PADDING = -1e9; /* asciisoft: no overflow menu, toolbar wraps */');
  console.log('patched: toolbar overflow');
}
fs.writeFileSync(file, src);
