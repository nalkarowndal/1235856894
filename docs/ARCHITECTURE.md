# luxuryRental 기술·ERP 설계

## 1. 방향
- 브랜드: luxurious yet modern, restrained editorial layout
- 고객: 모바일 360~430 우선, 태블릿/데스크톱 반응형
- 색: Ink #181a16, Cream #f9f7f2, Champagne #baa27a, Moss #424b3d
- 글꼴: Cormorant Garamond(영문 디스플레이), Noto Sans KR(한글), DM Sans(UI)
- 로고: 금속 음각을 연상시키는 **LR** 모노그램을 직접 제작, 스플래시와 PWA 아이콘에 적용
- UX: 고급 편집숍 탐색 + 대여 요금/날짜 투명성 + 운영 데이터 정확성

## 2. 화면 설계
- `/` (현재 구현: 단일 페이지 상태 라우팅): 스플래시, 에디토리얼 히어로, 브랜드·카테고리, 구매/대여 선택
- Shop: 필터/정렬, 구매 가격, 상세 모달, 데모 주문
- Rent: 렌탈 일별 요금, 시작/종료일, 보증금, 중복 예약 조회, 데모 신청
- Wishlist: 로컬 위시리스트; 로그인 후 서버 연동 예정
- My: 관리자 접근 등 개략 안내; 고객 회원 기능 차기 버전
- ERP Studio: 로그인, KPI, 실물/대여/주문 상세 테이블, 재고상태 처리

## 3. 운영 도메인

```
Product (공통 상품: 브랜드, 디자인, 판매가, 대여일가)
  └─ Unit (실물별 시리얼, 등급, 준비/세탁/수선/판매완료)
       ├─ Rental (실물 ID + 예약 날짜 구간 + 대여 상태)
       ├─ Order  (실물 ID + 구매 요청 기록)
       └─ InventoryEvent (변경 이벤트 이력)
```

**핵심 불변식:** 특정 실물에 `[start_date,end_date]`가 겹치는 활성 `confirmed/shipped` 렌탈 2건이 있으면 안 됩니다. `BEGIN IMMEDIATE` 내부에서 중복 조회→실물 배정→INSERT→COMMIT 합니다. 날짜는 현재 양 끝을 포함해서 계산하므로 실제 출고/반납 버퍼는 별도 추가해야 합니다. 현 데모는 렌탈료 `일수 × day_price`, 보증금 별도 표시입니다.

**개선:** 실거래에서는 상품별 선택 가능 실물을 기준으로 `InventoryHold` 테이블과 만료시간 및 금액 서버 검증을 구현하고, PostgreSQL의 배타 제약 또는 직렬화 트랜잭션과 재시도 정책으로 다중 서버 동시성을 보장해야 합니다. 현재 SQLite 사용은 실행이 쉬운 단일 프로세스 MVP 목적이며 완성형 ERP가 아닙니다.

## 4. 데이터 스키마
- `products` : 브랜드, 상품명, 카테고리, 가격, 보증금, 아트
- `units` : 상품 외래키, 유일 시리얼, 상태 등급, 운영 상태
- `rentals` : 구간, 단가 합산, 보증금, 고객명, 상태
- `orders` : 상품/실물, 고객, 가상 신청 금액, 미결제 상태
- `inventory_events` : 실물 관리 이력

### 실제 운영 시 확장 테이블
`users`, `roles`, `permissions`, `addresses`, `payment_intents`, `payments`, `refunds`, `deposit_holds`, `shipments`, `returns`, `inspection_reports`, `maintenance_jobs`, `stock_transfers`, `settlement_ledger`, `audit_logs`, `editorial_posts`, `media_assets`.

## 5. 모션·접근성 가이드
- 최초 세션 스플래시: 1.6초 표시 후 0.5초 페이드, 스플래시 이미지 편집 가능 SVG
- 히어로: 0.7초 `opacity + y` 등장, 상품 이미지 1.25초 scale/fade
- 모달: 0.25초 y transition, 토스트: 3.5초 자동 제거, `role=status` / `aria-live=polite`
- 하단 탭: 터치 영역 최소 44px, 선택 탭 하단 바는 텍스트와 겹치지 않음
- `prefers-reduced-motion: reduce`일 때 CSS 애니메이션 축소; 운영 버전에선 JS Motion `useReducedMotion()` 추가 권장
- 실제 고객 가격/날짜/보증금 텍스트는 그래픽 애니메이션보다 가독성과 서버 검증이 우선

## 6. QA 수용 기준 (다음 단계)
1. iPhone SE / 390 / 430 / 768 / 1280px에서 수평 오버플로우 없음
2. 홈→상품→날짜→렌탈 신청 후 관리자 화면에서 동일 ID 확인
3. 실물 2개인 제품의 같은 날짜 예약 3회 시 마지막이 HTTP 409
4. 예약상품과 구매상품의 실물 중복 할당 없음
5. 관리자 무인증 상태에서 보호된 API HTTP 401
6. `returned` 전환 시 `cleaning`, 이후 `ready` 복귀 가능
7. 빈 결과·실패·로딩·취소·이탈 모두 명확한 메시지 제공
8. 스플래시·버튼·모달 애니메이션에서 저감 모션 설정 준수
9. 주문 금액은 반드시 서버에서 재계산
10. 실제 결제·정산·고객정보 처리 기능은 명시적으로 데모와 분리

## 7. 참고 사례
- Rent the Runway: 대여/반납/교환 전환 흐름 https://www.renttherunway.com/how_renting_works
- BAG IT Milano: 제품→렌탈 기간→체크아웃 https://bagitmilano.com/pages/how-to-rent
- FASHIONPHILE: 상태 공개와 정품 감정 UX https://www.fashionphile.com/pages/authenticity
- Rebag: 구매/판매/거래 통합 탐색 https://www.rebag.com/about-us/
- 온백: 국내 프리미엄 렌탈 안내와 배송 https://www.ownbag.kr/
- Tailwind v4 공식 Next.js 설치: https://tailwindcss.com/docs/installation/framework-guides/nextjs
- Motion for React: https://motion.dev/docs/react-animation
- 토스페이먼츠 결제 승인 검증: https://docs.tosspayments.com/guides/v2/get-started/payment-flow
- W3C WCAG 2.2 모션 접근성: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions
