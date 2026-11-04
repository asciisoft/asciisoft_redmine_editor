# 편집기 번들 다시 만들기
```bash
cd build
npm ci --ignore-scripts          # package-lock.json 의 고정 버전 설치
node patch-toastui.mjs           # 내장 DOMPurify 2.3.3 -> dompurify 2.5.9
npx esbuild entry.js --bundle --minify --format=iife --target=es2019 --legal-comments=eof \
  --outfile=../assets/javascripts/toastui-editor-bundle.min.js
cp node_modules/@toast-ui/editor/dist/toastui-editor.css ../assets/stylesheets/
```
