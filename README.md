# luxuryRental — Premium Mobile Commerce + ERP Demo

**모바일 퍼스트 명품 구매·렌탈 콘셉트 웹앱**. 브랜드 전용 LR 모노그램 로고와 스플래시, Tailwind CSS v4, React, Motion, Node.js, SQLite 기반 ERP형 운영 대시보드가 포함된 **실행용 MVP 스타터**입니다.

> **중요:** 모든 브랜드명, 제품 및 핸드백 SVG는 개발 데모를 위한 창작 콘셉트입니다. 실재하는 명품 제품·정품 인증·보험·배송·금전 결제·환불을 제공하지 않습니다. 주문 및 렌탈 신청은 **DB에 기록되지만 실제 금액이 청구되지 않습니다**. 운영용 출시 전 아래의 추가 개발이 필수입니다.

## 실행 환경

- Node.js 22.13+ / npm 10+ 필요 (서버에서 `node:sqlite` 사용; Node 22 계열에서는 ExperimentalWarning이 발생할 수 있습니다)
- 단일 저장소 npm workspaces 구조
- 프론트: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + Motion + Lucide
- 서버: Node.js 내장 HTTP + SQLite (`node:sqlite`), 외부 npm 서버 의존성 없음
- 데이터 파일: 서버 첫 실행 시 자동 생성 `server/luxuryrental.db`; 6개 가상 제품 / 13개 개별 실물 시드

## 개발 서버 시작

```bash
cd luxuryRental-starter
npm install
npm run dev
```

- 고객용 웹: http://localhost:5173
- 백엔드 API: http://localhost:4100/api/health
- Vite 개발 서버가 `/api`를 Node.js 백엔드로 프록시합니다.

## 관리자 로그인 설정

직접 환경변수를 설정한 후 `npm run dev`를 시작합니다.

Windows PowerShell:

```powershell
$env:ADMIN_PASSWORD = "your-unique-long-random-password"
npm run dev
```

macOS / Linux:

```bash
ADMIN_PASSWORD='your-unique-long-random-password' npm run dev
```

웹에서 마이 → **ERP 관리자** → 동일 비밀번호로 로그인합니다. 브라우저의 `HttpOnly`, `SameSite=Strict` 쿠키를 통해 한 시간 동안 세션을 관리합니다. 서버 재시작 시 세션이 초기화됩니다. `.env.example`은 **예시 문서로 자동으로 로드되지 않습니다**.

## 포함 기능

| 고객 화면 | 관리자 / 백엔드 |
|---|---|
| 스플래시 및 모노그램 브랜딩 | 관리자 비밀번호 로그인 / 세션 |
| 편집숍형 메인, 에디토리얼 히어로 | KPI 카드, 매출 신청액(가상), 렌탈 및 주문 테이블 |
| 렌탈/구매 상품 리스트, 필터, 정렬 | 개별 실물(Unit) ID, 재고 상태, 상태 변경 |
| 검색, 위시리스트(localStorage) | 대여 상태: confirmed → shipped → returned / cancelled |
| 상품 상세 및 렌탈 날짜 선택 | 반납 후 cleaning 처리, ready 복구 |
| 렌탈 일수·요금·보증금 계산 | 날짜 중복 확인 / 트랜잭션 기반 예약 |
| 데모 렌탈 및 데모 구매 신청 | 주문 데이터 SQLite 저장 |
| 알림 토스트, 입장 모션, 탭 애니메이션 | 서버 자동 시드 및 테스트 |
| PWA manifest + 192·512px 아이콘 | 재고 이벤트 로그 테이블 |

### 이미지 출처 및 라이선스

`client/public/products/*.svg`, `splash.svg`, `favicon.svg`, `icon-*.png`은 이 프로젝트를 위해 직접 만든 오리지널 벡터 그래픽입니다. 실제 브랜드 제품 사진이 아니며 고유 상표를 표기하지 않습니다. 구글 폰트를 네트워크로 로드하며 연결되지 않을 때 시스템 대체 폰트가 적용됩니다.

### 개발/검수 명령어

```bash
npm run test:api  # Node.js 기본 test runner: 데이터베이스 단위 테스트
npm run build     # 프런트 프로덕션 빌드
npm start         # 빌드된 client/dist + 서버 API, PORT 기본값 4100
```

프로젝트 생성 환경에서 npm 레지스트리 연결이 제한되어 **npm install / Vite 프로덕션 빌드 / 브라우저 시각 QA는 수행하지 못했습니다**. Node.js 단위 테스트 4개 및 API 헬스·카탈로그·로그인 스모크 테스트는 통과했습니다. 패키지 설치 후 `npm run build`와 Playwright 시각 검수를 진행하세요.

## API 주요 엔드포인트

```
GET    /api/health
GET    /api/products
GET    /api/products/:productId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /api/rentals                       {productId, customer, startDate, endDate}
POST   /api/orders                        {productId, customer}
POST   /api/admin/login                   {password}
POST   /api/admin/logout
GET    /api/admin/me
GET    /api/admin/dashboard               [admin]
PATCH  /api/admin/rentals/:rentalId       {status} [admin]
PATCH  /api/admin/units/:unitId           {state} [admin]
```

## 파일 구성

```
luxuryRental-starter/
├── client/
│   ├── public/
│   │   ├── products/             # 오리지널 6개 제품 SVG 일러스트
│   │   ├── splash.svg            # 390 x 844 모바일 전용 브랜디드 스플래시
│   │   ├── favicon.svg           # LR 모노그램 각인 로고
│   │   ├── icon-192.png, icon-512.png
│   │   └── manifest.webmanifest
│   ├── src/App.tsx               # 고객 + 관리자 통합 UI
│   ├── src/styles.css            # Tailwind v4 테마 / 접근성
│   └── vite.config.ts            # API 프록시
├── server/
│   ├── db.mjs                    # SQLite ERP 스키마, 상품/실물/예약/주문
│   ├── index.mjs                 # Node HTTP REST API 및 관리자 세션
│   ├── test.mjs                  # 예약 충돌/가격/재고 테스트
│   └── .env.example
├── docs/ARCHITECTURE.md
└── docs/ANTIGRAVITY_PROMPT.md
```

## 제품 완성도를 위해 필요한 다음 작업

1. **실거래**: 결제 PG(토스페이먼츠 등) 서버 승인, 금액·주문번호 검증, 보증금 사전 승인/반환·환불 원장, 결제 멱등성; 데모 주문은 실제 결제 완료와 무관하므로 현 방식으로 실거래 불가.
2. **운영형 ERP**: PostgreSQL + Prisma로 전환, 판매 재고 홀드/만료 TTL, 출고/반납/검수/세탁/수선/정산의 독립 워크플로, 원장과 감사 로그, 배송 API.
3. **인증 및 보안**: 실제 회원 계정, RBAC, 관리자 MFA, 로그인 시도 제한, 지속형 세션 저장소, CSRF 보호, 개인정보 수집·보관·파기 정책, HTTPS 보안.
4. **자산·CMS**: 에디토리얼 콘텐츠 관리, 실물 고유번호와 정품 감정 기록/촬영 사진, 업로드·저장소, 사용자 후기, 고객센터.
5. **품질**: 실제 기기 QA, Playwright 모바일 E2E, Lighthouse, 폰트/이미지 최적화, `prefers-reduced-motion` 확인, WCAG 2.2 검사.
6. **정책**: 전자상거래 정보제공, 약관/대여 파손 및 연체 규칙/환불·구매 전환 조건을 사업 운영 기준에 맞게 법률 검토.

자세한 구조와 실행 지시는 `docs` 폴더에서 확인하세요.