# asciisoft_redmine_editor (v1.1.0)
Redmine 7.0 의 Markdown(CommonMark) 편집 칸을 WYSIWYG 편집기로 대체하는 플러그인입니다.
기존 편집 칸은 숨긴 채로 두고, 편집 내용을 Markdown 으로 바꿔 넣습니다(입력 중 실시간, 저장 시 한 번 더).

## 기능
- WYSIWYG 편집 (TOAST UI Editor 3.2.2, 플러그인 안에 포함, 외부 CDN 없음, 편집 칸이 있는 화면에서만 로드)
- 툴바 맨 앞: 글꼴, 글자 크기(7~48px), 줄간격 → `<span style="…">` 로 저장
- `#123`, `[[위키]]`, `{{toc}}`, `@사용자` 등 Redmine 문법 원형 유지, 일감/위키 링크 버튼
- `@` 입력 시 사용자 선택 팝업 (Redmine 기본 멘션 검색 주소 사용, 일감·위키 편집 화면)
- 클립보드 이미지 붙여넣기, 끌어다 놓기 → Redmine 첨부로 업로드 후 본문에 삽입
- 엑셀 표 → Markdown 표, 워드 굵게/기울임/번호 목록 유지
- 불러오지 못한 이미지는 "이미지: 파일명" 자리 표시 상자로 표시 (저장 내용에는 영향 없음)
- 원문 보호: WYSIWYG 변환 시 내용이 달라질 수 있는 글은 Markdown 모드로 열고 안내 표시. 수정하지 않으면 원문 그대로 저장

## 요구 사항
Redmine 7.0 이상, 관리 > 설정 > 일반 > 텍스트 서식 = Markdown(CommonMark)

## 설치 (Docker)
```bash
cp -r asciisoft_redmine_editor /srv/redmine/plugins/
cd /srv/redmine && docker compose restart redmine
```
관리 > 플러그인에서 "ASCII SOFT WYSIWYG 편집기" 확인 → 설정에서 사용 여부를 켜고 끌 수 있습니다.
삭제: 폴더를 지우고 재시작 (저장된 글은 그대로 Markdown 이라 영향 없음).

## 보안
- 편집기 내장 DOMPurify 2.3.3 을 제거하고 DOMPurify 2.5.9 로 교체 (build/patch-toastui.mjs)
- style 속성은 글꼴/크기/줄간격(span), 표 칸 정렬(td/th), 이미지 크기(img)만 허용하고 값도 형식 검사 (url(), 배경 등 차단)
- 붙여넣은 HTML 은 실행되지 않는 별도 문서에서 정리 후 다시 정화
- 멘션 팝업은 같은 사이트 주소만 호출하고, 이름은 글자로만 표시(HTML 해석 안 함)
- 서버 측에서도 Redmine 이 저장된 HTML 을 다시 정화합니다

## 알려진 한계
- 문단 정렬(좌/가운데/우)은 미지원 (편집기 엔진이 정렬 블록을 편집 불가로 다룸)
- 첨부 목록이 없는 화면(위키 편집 등)에서는 기존 이미지가 자리 표시 상자로 보임
- 서식 HTML 은 CSV 내보내기, 텍스트 메일에 태그 그대로 보임
- 뉴스/게시판 편집에는 Redmine 이 멘션 검색 주소를 제공하지 않아 팝업 없음

## 번들 다시 만들기
build/BUILD.md 참고. 의존성 버전은 build/package-lock.json 에 고정.

라이선스: GPL-2.0-or-later (LICENSE). 포함된 외부 라이브러리는 THIRD_PARTY_NOTICES.md 참고.
