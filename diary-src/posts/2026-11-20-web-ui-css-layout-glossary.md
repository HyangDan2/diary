---
title: "화면이 어긋날 때 쓰는 말: 웹 UI·CSS·레이아웃 완전 정리"
date: 2026-11-20T12:40:00+09:00
category: Notes
summary: "화면이 밑에서 잘리고, 가로로 삐져나오고, 모달 뒤가 스크롤될 때 우리는 증상을 정확히 부르지 못해 같은 수정을 반복합니다. 뷰포트·간격·구역·조작 요소·레이어·타이포·모바일 제약까지 여덟 묶음으로 나누어, 지시와 수정에 바로 쓰는 용어와 CSS 핵심을 정리했습니다."
tags: [css, ui, layout, frontend, responsive, mobile, notes]
layout: post
translationKey: notes-web-ui-css-layout-glossary
---

화면을 고치는 일은 대개 말에서 시작합니다. "밑에가 잘려요", "옆으로 넘어가요", "버튼이 이상한 데 떠 있어요". 이 말들은 틀리지 않았습니다. 다만 너무 넓습니다. 같은 말로 서로 다른 버그 열 개를 가리킬 수 있고, 그래서 고칠 때마다 다른 곳을 건드리게 됩니다.

웹앱을 만들다 보면 결국 같은 자리에서 반복해서 막힙니다. 높이 계산, 안전 영역, 가로 넘침, 겹치는 레이어의 순서, 터치 영역의 크기, 한국어 줄바꿈. 이름을 알고 있으면 검색이 되고, 검색이 되면 원인이 좁혀지고, 원인이 좁혀지면 수정이 한 번에 끝납니다. 이름을 모르면 그냥 `overflow: hidden`을 붙이고 다음 화면에서 같은 문제를 다시 만납니다.

이 글은 그 이름들을 정리한 노트입니다. 여덟 개의 묶음으로 나누었고, 각 묶음마다 **용어 → 실제로 깨지는 모습 → CSS 핵심 → 비교표** 순서로 적었습니다. Shutterplate의 프레임 편집 화면, Nordlys의 영상 작업 화면, TechnicalHub의 문서 화면을 고치면서 실제로 반복해서 만난 것들입니다.

## 여덟 개의 묶음

| 묶음 | 다루는 것 | 자주 나오는 증상 |
| --- | --- | --- |
| 1. 화면 틀 | 뷰포트 높이, 안전 영역, 넘침, 브레이크포인트 | 밑이 잘림, 가로로 삐져나옴 |
| 2. 배치 | Flex·Grid, Margin·Padding·Gap, Position, Z-index | 정렬이 안 맞음, 요소가 겹침 |
| 3. 구역 | Topbar·Hero·Rail·Stage·Utility Bar·Drawer | 헤더에 콘텐츠가 가림, 스크롤이 두 개 |
| 4. 조작 요소 | Badge·Tag·Chip·Pill, Toggle·Checkbox·Radio, FAB | 버튼이 안 눌림, 무엇을 눌러야 할지 모름 |
| 5. 레이어 | Modal·Sheet·Overlay·Popover·Toast | 모달 뒤가 스크롤됨, 토스트가 가려짐 |
| 6. 글꼴·테마 | 토큰, keep-all, 말줄임, radius·shadow | 단어 중간에서 줄바꿈, 배포 후 옛 화면 |
| 7. 모바일 | 16px 입력, touch-action, 인앱 브라우저 | 입력하면 화면이 확대됨, 카톡에서 저장 안 됨 |
| 8. 치트시트 | 증상 → 용어 → 첫 점검 | — |

## 1. 화면 틀 · 뷰포트 · 반응형

### 100vh는 화면 높이가 아닙니다

모바일 브라우저의 주소창과 하단 툴바는 스크롤에 따라 접히고 펴집니다. 그래서 "화면 높이"가 하나가 아닙니다. CSS는 이걸 세 가지로 나누어 부릅니다.

| 단위 | 뜻 | 값이 변하는가 | 쓰는 자리 |
| --- | --- | --- | --- |
| `100vh` | 뷰포트 높이. 모바일에서는 사실상 `lvh` | 아니오 (초기 계산값 고정) | 예전 코드, 데스크톱 전용 |
| `100lvh` | 툴바가 **접힌** 상태의 큰 뷰포트 | 아니오 | 배경 이미지, 풀블리드 히어로 |
| `100svh` | 툴바가 **펼쳐진** 상태의 작은 뷰포트 | 아니오 | 항상 보여야 하는 앱 틀 |
| `100dvh` | 지금 이 순간의 뷰포트 | 예 (스크롤할 때마다) | 화면을 꽉 채우는 앱 셸 |

`100vh`로 앱 틀을 잡으면 툴바가 펼쳐진 상태에서 아래쪽이 툴바 뒤로 들어갑니다. 사용자에게는 "밑에가 잘린다"로 보이고, 개발자에게는 "스크롤이 끝까지 안 간다"로 보입니다. 반대로 `100dvh`는 스크롤할 때마다 값이 바뀌므로, 안쪽에 캔버스나 지도를 그린 화면에서는 레이아웃이 한 프레임씩 흔들립니다.

실무에서는 이렇게 나눕니다. 앱 전체를 감싸는 틀은 `100dvh`, 높이가 변하면 안 되는 요소(하단 고정 바, 캔버스 래퍼)는 `100svh` 또는 고정 `px`을 씁니다.

```css
/* 순서가 중요합니다. 지원하지 않는 브라우저는 앞의 줄을 무시합니다. */
.app-shell {
  height: 100vh;   /* 아주 오래된 브라우저용 */
  height: 100dvh;  /* 최신 브라우저 */
  min-height: 100svh;
}
```

주의할 점이 하나 있습니다. iOS에서 소프트 키보드가 올라오면 `dvh`는 거의 변하지 않습니다. 키보드는 브라우저 UI가 아니라 OS가 그리는 레이어이기 때문입니다. 채팅처럼 키보드에 붙는 입력창이 필요하면 `visualViewport`를 직접 읽어야 합니다.

```js
const vv = window.visualViewport;
const stick = () => {
  document.documentElement.style.setProperty('--kb', `${window.innerHeight - vv.height}px`);
};
vv?.addEventListener('resize', stick);
vv?.addEventListener('scroll', stick);
```

### 안전 영역(Safe Area) — 노치와 홈 바

`viewport-fit=cover`를 선언하면 화면이 노치와 홈 인디케이터 영역까지 확장됩니다. 대신 그 영역을 비워 두는 책임이 우리에게 넘어옵니다. 이때 쓰는 값이 `env(safe-area-inset-top·right·bottom·left)`입니다.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
/* 하단 고정 바: 안전 영역과 최소 여백 중 큰 쪽 */
.utility-bar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  padding-top: 12px;
}
```

`max()`가 핵심입니다. `env()`만 쓰면 홈 바가 없는 기기에서 여백이 0이 되어 버튼이 화면 끝에 붙습니다. `env()`를 지원하지 않는 브라우저를 함께 보려면 `max(12px, env(safe-area-inset-bottom, 0px))`처럼 폴백 값을 넣습니다.

[![100vh·100dvh·100svh의 차이와 안전 영역 인셋](/diary/assets/images/2026-11-20-ui-viewport-safe-area.png)](/diary/assets/images/2026-11-20-ui-viewport-safe-area.png)

### 넘침(Overflow) — 가로로 삐져나오는 가장 흔한 이유 네 가지

가로 스크롤은 거의 항상 이 네 가지 중 하나입니다.

1. **고정 폭**이 화면보다 큽니다. `width: 420px`인 카드가 390px 화면에 들어가면 그대로 넘칩니다. `max-width: 100%`를 같이 씁니다.
2. **Flex·Grid 자식이 줄어들지 않습니다.** Flex item의 기본 `min-width`는 `auto`라서 내용보다 작아지지 않습니다. `min-width: 0`을 명시해야 줄어듭니다. Grid도 `minmax(0, 1fr)`이 필요합니다.
3. **`100vw`가 스크롤바 폭을 포함합니다.** 데스크톱에서 세로 스크롤바가 있으면 `100vw`는 실제 본문 폭보다 큽니다. `width: 100%`를 쓰거나 `scrollbar-gutter: stable`을 씁니다.
4. **음수 마진·절대 배치**가 부모 밖으로 나갑니다. 부모에 `position: relative`와 `overflow: clip`을 함께 둡니다.

원인을 찾을 때는 `body`에 `overflow-x: hidden`을 먼저 붙이지 않습니다. 그러면 증상만 사라지고 넘치는 요소는 그대로 남습니다. 대신 폭을 재서 범인을 찾습니다.

```js
const wide = [...document.querySelectorAll('*')]
  .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1);
console.table(wide.map((el) => ({ tag: el.tagName, cls: el.className })));
```

`document.documentElement.scrollWidth > window.innerWidth`가 참이면 가로 넘침이 있다는 뜻입니다. 자동 검증 스크립트에 이 한 줄을 넣어 두면 배포 전에 걸러집니다.

### 브레이크포인트 · 미디어 쿼리 · 컨테이너 쿼리

미디어 쿼리는 **화면**(뷰포트)을 봅니다. 컨테이너 쿼리는 **부모 상자**를 봅니다. 같은 카드 컴포넌트를 사이드바에 넣을 때와 본문에 넣을 때 다르게 그리고 싶다면, 미디어 쿼리로는 화면 폭을 기준으로밖에 못 나눕니다. 컨테이너 쿼리는 카드가 놓인 자리의 폭을 기준으로 나눕니다.

```css
.card-host { container-type: inline-size; container-name: card; }

@container card (min-width: 420px) {
  .card { grid-template-columns: 96px 1fr; }
}
@container card (max-width: 419px) {
  .card { grid-template-columns: 1fr; }
}
```

브레이크포인트는 기기 이름이 아니라 **레이아웃이 깨지는 폭**에 맞춥니다. 우리 앱들에서는 대체로 세 개면 충분했습니다. 640px(한 줄), 1024px(레일이 사이드바로), 1440px(작업 영역이 넓어짐). 기기 이름(`iPhone`, `iPad`)으로 나누면 새 기기가 나올 때마다 규칙이 늘어납니다.

### 스크롤 잠금(Scroll Lock)과 오버스크롤

모달을 띄울 때 뒤 화면이 스크롤되면 사용자는 모달이 아니라 뒤 페이지를 조작하고 있다고 느낍니다. `body { overflow: hidden }`은 iOS에서 잘 듣지 않습니다. 가장 확실한 방법은 현재 스크롤 위치를 고정하는 것입니다.

```js
function lockScroll() {
  const y = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.width = '100%';
  document.body.dataset.lockY = String(y);
}
function unlockScroll() {
  const y = Number(document.body.dataset.lockY || 0);
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, y);
}
```

`overscroll-behavior: contain`은 안쪽 스크롤 영역이 끝에 닿았을 때 바깥으로 스크롤이 번지는 것을 막습니다. 바텀시트, 드로어, 코드 블록에 특히 필요합니다. iOS의 고무줄 튕김은 `overscroll-behavior-y: none`으로 줄입니다.

## 2. 배치 · 간격 · 정렬

### Flexbox와 Grid — 무엇을 고를까요

둘 다 정렬 도구지만 축이 다릅니다. Flexbox는 **한 방향**으로 흐르고, Grid는 **가로와 세로를 동시에** 정합니다.

| 기준 | Flexbox | Grid |
| --- | --- | --- |
| 방향 | 1차원 (행 또는 열) | 2차원 (행과 열) |
| 크기 결정 | 내용과 `flex` 비율 | 트랙 정의(`fr`, `minmax`) |
| 대표 용도 | 툴바, 버튼 줄, 카드 안쪽 | 페이지 골격, 카드 목록, 대시보드 |
| 넘칠 때 | `min-width: 0` 필요 | `minmax(0, 1fr)` 필요 |
| 간격 | `gap` | `gap`, `row-gap`, `column-gap` |

기준이 애매할 때는 이렇게 판단합니다. "자식들이 한 줄로 늘어서고 남는 공간을 나눠 갖는가"면 Flex, "자식들이 정해진 칸에 놓이는가"면 Grid입니다.

```css
/* 남는 공간을 나눠 갖는 툴바 */
.topbar { display: flex; align-items: center; gap: 12px; }
.topbar .spacer { flex: 1 1 auto; min-width: 0; }

/* 폭에 따라 칸 수가 바뀌는 카드 목록 */
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
```

`justify-content`는 **주축**, `align-items`는 **교차축**입니다. `flex-direction: column`이 되는 순간 두 축의 방향이 바뀝니다. 세로 정렬이 안 먹을 때 `justify-content: center`를 넣고 있는 경우가 많은데, 그건 주축이 세로일 때만 맞습니다.

### Margin · Padding · Gap

| 속성 | 위치 | 성질 | 주의 |
| --- | --- | --- | --- |
| `margin` | 요소 **바깥** | 이웃과의 거리. 세로 마진은 겹칩니다(마진 상쇄) | 배경색이 칠해지지 않음 |
| `padding` | 요소 **안쪽** | 테두리와 내용 사이. 배경이 칠해짐 | `box-sizing: border-box` 필요 |
| `gap` | 자식 **사이** | 마지막 요소 뒤에는 생기지 않음 | Flex·Grid에서만 동작 |

리스트를 만들 때 `li { margin-bottom: 12px }`을 쓰면 마지막 항목에도 여백이 남아 컨테이너가 들떠 보입니다. `gap`을 쓰면 그 문제가 사라집니다. 마진 상쇄는 세로에서만 일어나고, Flex·Grid 자식에게는 일어나지 않습니다.

```css
* , *::before, *::after { box-sizing: border-box; }

.stack > * + * { margin-top: 16px; }      /* 마진 상쇄 없는 세로 리듬 */
.row { display: flex; gap: 8px; flex-wrap: wrap; }
```

### Position 다섯 가지

| 값 | 기준 | 문서 흐름 | 쓰는 자리 |
| --- | --- | --- | --- |
| `static` | 기본값 | 차지함 | 대부분 |
| `relative` | 자기 원래 자리 | 차지함 | 자식 absolute의 기준, 미세 조정 |
| `absolute` | 가장 가까운 positioned 조상 | 빠짐 | 뱃지, 닫기 버튼, 장식 |
| `fixed` | 뷰포트 | 빠짐 | 상단 바, FAB, 토스트 |
| `sticky` | 스크롤 컨테이너 | 차지함 | 표 헤더, 섹션 제목 |

`sticky`가 안 먹는 경우는 거의 항상 조상에 `overflow: hidden`이나 `overflow: auto`가 있어서입니다. 그 조상이 스크롤 컨테이너가 되고, 스크롤이 없으니 붙을 일도 없습니다. `top` 값도 반드시 있어야 합니다.

```css
.panel { overflow: clip; }              /* sticky를 죽이지 않는 자르기 */
.panel-head { position: sticky; top: 0; z-index: 2; background: var(--surface); }
```

### Z-index와 쌓임 맥락(Stacking Context)

`z-index`는 숫자가 클수록 위라는 단순 규칙이 아닙니다. **쌓임 맥락**이 같을 때만 비교됩니다. 새 맥락을 만드는 것들은 생각보다 많습니다. `position` + `z-index`, `transform`, `filter`, `opacity < 1`, `will-change`, `isolation: isolate`, `contain: paint`.

그래서 `z-index: 9999`를 넣어도 안 올라오는 일이 생깁니다. 부모가 이미 낮은 맥락 안에 갇혀 있으면, 그 안의 9999는 부모의 순서를 넘지 못합니다. 해결은 숫자를 키우는 것이 아니라 맥락을 정리하는 것입니다. 겹침 순서를 국소화하려면 `isolation: isolate`를 씁니다.

```css
.app { --z-topbar: 100; --z-drawer: 300; --z-modal: 400; --z-toast: 500; }

.modal { position: fixed; z-index: var(--z-modal); }
.toast { position: fixed; z-index: var(--z-toast); }
.card-stage { isolation: isolate; }   /* 카드 내부 z-index를 카드 안에 가둠 */
```

### 비율(Aspect Ratio)과 object-fit

```css
.thumb { aspect-ratio: 4 / 3; width: 100%; overflow: hidden; border-radius: 12px; }
.thumb img { width: 100%; height: 100%; object-fit: cover; object-position: center; }
```

`cover`는 상자를 꽉 채우고 넘치는 부분을 자릅니다. `contain`은 전체를 보여 주고 남는 곳을 비웁니다. 사진 목록은 `cover`, 원본 확인·편집 화면은 `contain`입니다. Shutterplate처럼 프레임 안에 사진을 넣는 화면은 둘을 섞습니다. 바깥 상자는 `cover`로 채우고, 사용자가 자르는 위치를 정하는 단계에서는 `contain`으로 전체를 보여 줍니다.

[![Margin·Padding·Gap의 차이와 Position·Z-index 쌓임 구조](/diary/assets/images/2026-11-20-ui-spacing-position.png)](/diary/assets/images/2026-11-20-ui-spacing-position.png)

## 3. 화면 구역 · 내비게이션

웹앱 화면은 대개 같은 구역의 조합입니다. 이름을 붙여 두면 "히어로를 줄이고 스테이지를 키워 달라" 같은 지시가 한 줄로 끝납니다.

| 구역 | 역할 | 구현 메모 |
| --- | --- | --- |
| Topbar / Header | 앱 이름, 주요 내비, 계정 | `position: sticky; top: 0`, 높이만큼 본문 보정 |
| Hero | 첫 화면의 소개·행동 유도 | `min-height: 60svh`, 배경 이미지는 `object-fit: cover` |
| Sidebar / Rail | 섹션 이동. Rail은 아이콘만 남긴 좁은 사이드바 | 1024px 아래에서는 Drawer로 전환 |
| Stage / Canvas | 실제 작업 영역 | Flex 열 안에서 `min-height: 0` 필수 |
| Utility Bar / Status Bar | 하단 상태·도구 | `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| Footer | 저작권, 링크 | 모바일에서는 접거나 줄임 |
| Drawer | 화면 밖에서 밀려 나오는 패널 | 스크림 + 포커스 트랩 + Esc 닫기 |

[![웹앱 화면 구역 구조도: Topbar·Hero·Rail·Stage·Utility Bar·Drawer·FAB](/diary/assets/images/2026-11-20-ui-page-anatomy.png)](/diary/assets/images/2026-11-20-ui-page-anatomy.png)

### Topbar가 콘텐츠를 가리는 문제

`position: fixed` 상단 바는 문서 흐름에서 빠지므로 본문이 그 아래로 들어갑니다. 흔한 처방이 `padding-top: 64px`인데, 바 높이가 바뀌면 같이 틀어집니다. 높이를 변수로 두고 같이 움직이는 편이 안전합니다.

```css
:root { --topbar-h: 60px; }
.topbar { position: sticky; top: 0; height: var(--topbar-h); z-index: var(--z-topbar); }
main { padding-top: var(--topbar-h); }
:target, .anchor { scroll-margin-top: calc(var(--topbar-h) + 16px); }
```

`scroll-margin-top`은 앵커로 이동했을 때 제목이 바 아래에 숨는 문제를 막습니다. 목차가 있는 TechnicalHub 같은 문서 화면에서 특히 체감이 큽니다.

### Flex 열에서 Stage가 넘치는 문제

```css
.app { display: flex; flex-direction: column; height: 100dvh; }
.stage { flex: 1 1 auto; min-height: 0; overflow: auto; }
```

`min-height: 0`이 없으면 Stage는 내용 높이를 유지하려 하고, 결과적으로 페이지 전체가 스크롤됩니다. 상단 바는 같이 올라가고, 하단 바는 화면 밖으로 밀립니다. "스크롤이 두 개 생겼다"는 증상의 정체가 대개 이것입니다.

### Drawer · Accordion · Tab · Segmented Control · Breadcrumb

| 패턴 | 하는 일 | 접근성 | 헷갈리는 짝 |
| --- | --- | --- | --- |
| Drawer | 화면 밖 패널을 밀어 넣음 | `aria-modal`, 포커스 트랩, Esc | Modal (배경을 완전히 가리는가) |
| Accordion | 제목을 눌러 내용을 펼침 | `aria-expanded`, 패널 `hidden` | Tab (여러 개를 동시에 열 수 있는가) |
| Tab | 같은 영역의 내용을 교체 | `role="tablist"`, `aria-selected` | Segmented Control |
| Segmented Control | 배타적 선택을 한 줄에 나열 | `role="radiogroup"` | Tab |
| Breadcrumb | 현재 위치의 경로 | `aria-label="Breadcrumb"`, `aria-current="page"` | 내비게이션 메뉴 |

Tab과 Segmented Control은 생김새가 비슷하지만 역할이 다릅니다. Tab은 **아래 내용을 바꾸는 장치**이고, Segmented Control은 **하나를 고르는 입력**입니다. 그래서 Tab에는 `role="tab"`과 화살표 키 이동을 주고, Segmented Control에는 라디오처럼 동작하게 합니다. 스크린리더 사용자에게 이 차이는 꽤 큽니다.

### 아이콘 이름: 케밥·미트볼·햄버거

| 글리프 | 이름 | 뜻 |
| --- | --- | --- |
| `⋮` | 케밥(kebab) | 세로 점 세 개 = 더 보기 메뉴 |
| `⋯` | 미트볼(meatball) | 가로 점 세 개 = 더 보기 메뉴 |
| `☰` | 햄버거(hamburger) | 전체 메뉴 열기 |
| `⋯` 안의 점 4개 | 그냥 "점 네 개" | 쓰지 않습니다 |

"오른쪽 위 점 세 개"라고 말하면 가로인지 세로인지 매번 다시 물어야 합니다. 케밥과 미트볼로 부르면 한 번에 끝납니다. 참고로 세로 케밥은 카드·행 단위 메뉴에, 가로 미트볼은 툴바에 주로 씁니다.

## 4. 버튼 · 조작 요소

### Badge · Tag · Chip · Pill

모양이 아니라 **역할**로 구분합니다. 네 가지 모두 작은 알약 모양으로 만들 수 있어서, 이름을 모르면 전부 "뱃지"가 됩니다.

| 이름 | 역할 | 누를 수 있는가 | 예 |
| --- | --- | --- | --- |
| Badge | 수량·상태 표시 | 아니오 | 장바구니 `3`, `NEW` |
| Tag | 분류 라벨 | 보통 아니오 (있으면 삭제만) | `#css`, `#notes` |
| Chip | 필터·선택 | 예 | `전체` `사진` `영상` |
| Pill | 모양 설명 (알약형) | 역할 아님 | Pill 모양 버튼, Pill 모양 탭 |

Pill은 모양의 이름이고 나머지 셋은 역할의 이름입니다. 그래서 "Pill 형태의 Chip"이라는 말이 성립합니다. 지시할 때는 역할로 부르고, 모양은 필요할 때만 덧붙입니다.

### Toggle · Checkbox · Radio

| 컨트롤 | 선택 수 | 적용 시점 | 쓰는 자리 |
| --- | --- | --- | --- |
| Toggle / Switch | 하나의 켜짐·꺼짐 | **즉시** 적용 | 설정, 다크 모드 |
| Checkbox | 여러 개 | 폼 제출 때 | 목록 선택, 약관 동의 |
| Radio | 하나 | 폼 제출 때 | 배송 방식, 정렬 기준 |

Toggle은 저장 버튼이 없어야 합니다. 누르는 순간 반영되고, 실패하면 되돌리며 토스트로 알립니다. 반대로 Checkbox·Radio는 폼의 일부이므로 "저장"이 있어야 합니다. 이 둘을 섞으면 사용자는 무엇이 이미 적용되었는지 알 수 없습니다.

```css
.switch { appearance: none; width: 44px; height: 26px; border-radius: 999px; background: var(--track); }
.switch:checked { background: var(--accent); }
.switch::after { content: ""; display: block; width: 20px; height: 20px; margin: 3px; border-radius: 50%; background: #fff; transition: translate .18s; }
.switch:checked::after { translate: 18px 0; }
.switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### 아이콘 버튼의 최소 터치 영역

아이콘은 20px짜리여도 괜찮습니다. **누를 수 있는 영역**이 44×44px 이상이어야 합니다(Apple HIG 기준, Material은 48dp). 아이콘 자체를 키우면 디자인이 무너지므로, 투명 여백으로 영역을 넓힙니다.

```css
.icon-btn {
  display: inline-grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;          /* 최소 터치 영역 */
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.icon-btn svg { inline-size: 20px; block-size: 20px; }
```

행 높이가 44px보다 작은 목록에서 아이콘 버튼을 쓰면 옆 항목을 누르게 됩니다. 이때는 `padding`으로 행 자체를 키우거나, 버튼을 행 전체 클릭 영역과 분리합니다.

### FAB — 우하단에 떠 있는 버튼

```css
.fab {
  position: fixed;
  inset-inline-end: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  inline-size: 56px;
  block-size: 56px;
  border-radius: 18px;
  box-shadow: 0 8px 24px rgb(18 18 58 / .28);
  z-index: var(--z-toast);
}
```

FAB는 화면당 하나입니다. 하단 바가 있는 화면에서는 `bottom`을 바 높이만큼 더해야 합니다. 그렇지 않으면 FAB가 바 위에 겹칩니다. Shutterplate 모바일 화면에서 "우하단 버튼이 바와 겹친다"는 지적이 나왔던 자리가 정확히 이 계산입니다.

[![Badge·Tag·Chip·Pill과 Toggle·Icon Button·FAB 등 조작 요소 비교](/diary/assets/images/2026-11-20-ui-controls-comparison.png)](/diary/assets/images/2026-11-20-ui-controls-comparison.png)

### Slider · Stepper · Dropdown

| 요소 | 쓰는 자리 | 주의 |
| --- | --- | --- |
| Slider (`input[type=range]`) | 연속 값(밝기, 필터 강도) | 값 표시를 함께, `accent-color`로 색 통일 |
| Stepper (`−` `+`) | 정수 값(수량, 프레임 수) | 길게 누르면 연속 변경, 경계에서 비활성 |
| Dropdown / Select | 항목이 5개 이상 | 모바일에서는 네이티브 `select`가 가장 안전 |

## 5. 겹치는 레이어 · 피드백

| 레이어 | 위치·크기 | 닫는 방법 | 쓰는 자리 |
| --- | --- | --- | --- |
| Modal / Dialog | 화면 중앙, 고정 폭 | 버튼, Esc, 바깥 클릭 | 결정이 필요한 확인 |
| Bottom Sheet | 하단에서 올라옴, 폭 100% | 드래그, 바깥 클릭 | 모바일 선택·옵션 |
| Overlay | 화면 전체, 투명 | 바깥 클릭 | 클릭 감지, 로딩 차단 |
| Popover | 기준 요소 옆 | 바깥 클릭, Esc | 작은 메뉴·설명 |
| Tooltip | 기준 요소 위 | 마우스 이탈 | 짧은 보조 설명 |
| Toast / Snackbar | 하단(또는 상단), 짧게 | 시간 경과, 스와이프 | 결과 알림 |
| Skeleton | 콘텐츠 자리 | 데이터 도착 | 첫 로딩 |
| Spinner | 콘텐츠 중앙 | 완료 | 짧은 대기·재시도 |

[![Modal·Bottom Sheet·Overlay·Popover·Toast의 층 구조](/diary/assets/images/2026-11-20-ui-overlays-comparison.png)](/diary/assets/images/2026-11-20-ui-overlays-comparison.png)

### Modal + Backdrop/Scrim

`<dialog>` 요소를 쓰면 스크림(`::backdrop`)과 포커스 이동을 브라우저가 상당 부분 처리합니다.

```html
<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">프레임을 삭제할까요?</h2>
  <p>삭제한 프레임은 되돌릴 수 없습니다.</p>
  <form method="dialog">
    <button value="cancel">취소</button>
    <button value="ok" class="primary">삭제</button>
  </form>
</dialog>
```

```js
const dlg = document.getElementById('confirm');
dlg.showModal();              // 배경 비활성 + ::backdrop
dlg.addEventListener('close', () => restoreFocus());
```

`showModal()`은 배경 요소를 조작할 수 없게 만들지만, 문서 스크롤을 항상 막아 주지는 않습니다. 모달을 열 때 위의 `lockScroll()`을 함께 호출하고, 닫을 때 원래 포커스로 돌려놓습니다. 이 두 가지를 빼먹으면 "모달 뒤가 스크롤된다", "닫아도 키보드 포커스가 사라진다"는 문제가 남습니다.

### Bottom Sheet

```css
.sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  max-height: 90dvh;
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 20px 20px 0 0;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  translate: 0 100%;
  transition: translate .24s ease;
}
.sheet[data-open="true"] { translate: 0 0; }
```

바텀시트 안에 또 스크롤이 있으면, 시트 자체를 끌어 닫는 제스처와 내용 스크롤이 충돌합니다. 손잡이(드래그 핸들) 근처에서만 닫기 제스처를 받도록 나누는 편이 안정적입니다.

### Overlay · Popover · Tooltip

Overlay는 **투명**한 층입니다. 뒤를 어둡게 덮는 Scrim과 다릅니다. 사이드 메뉴를 열었을 때 바깥을 눌러 닫히게 하려면 스크림을, 로딩 중 클릭만 막으려면 투명 오버레이를 씁니다. 팝오버는 브라우저 기본 `popover` 속성으로 스크림과 닫기 동작을 얻을 수 있습니다.

툴팁은 마우스가 있는 환경의 보조 수단입니다. 터치에서는 뜨지 않거나, 떠도 닫기 어렵습니다. 툴팁에만 담긴 정보는 터치 사용자에게 없는 정보입니다.

### Toast · Snackbar · Skeleton · Spinner

```css
.toast {
  position: fixed;
  inset-inline: 0;
  bottom: calc(72px + env(safe-area-inset-bottom));
  margin-inline: auto;
  inline-size: max-content;
  max-inline-size: calc(100% - 32px);
  z-index: var(--z-toast);
}
```

토스트는 3~5초 뒤 사라지고, 사라진 뒤에는 되돌릴 방법이 없습니다. 되돌리기가 필요한 작업이면 Snackbar에 **실행 취소** 버튼을 둡니다. 로딩은 두 가지로 나눕니다. 300ms 안에 끝날 것 같으면 아무것도 보여 주지 않고, 자리가 정해진 화면이면 Spinner 대신 Skeleton을 씁니다. Skeleton은 레이아웃을 미리 잡아 두므로 데이터가 도착할 때 화면이 튀지 않습니다.

## 6. 글꼴 · 테마 · 디테일

### 디자인 토큰 — 변수로 색을 부릅니다

색을 hexadecimal로 직접 쓰기 시작하면 다크 모드에서 절반을 다시 칠해야 합니다. 이름을 붙여 두고 테마에서는 값만 바꿉니다.

```css
:root {
  --bg: #F7F6FB;
  --surface: #FFFFFF;
  --surface-2: #EFECFA;
  --text: #1B1B2F;
  --text-body: #3F3950;
  --muted: #6B6880;
  --accent: #7C5CF0;
  --accent-hover: #6446D8;
  --border: #E2DDF0;
  --radius: 16px;
  --shadow-1: 0 1px 2px rgb(24 20 48 / .06);
  --shadow-2: 0 10px 30px rgb(24 20 48 / .12);
}
[data-theme="dark"] {
  --bg: #0E1020;
  --surface: #171A2E;
  --surface-2: #232741;
  --text: #F2F1FA;
  --text-body: #C6C9DC;
  --muted: #8E93AE;
  --accent: #A48CFF;
  --border: #2E3350;
}
```

토큰 이름은 역할로 짓습니다. `--purple-500`보다 `--accent`가 오래 갑니다. `--bg`, `--surface`, `--accent` 세 개만 잡아도 대부분의 화면이 정리됩니다.

### word-break: keep-all

한국어는 단어 중간에서 줄이 바뀌면 읽기 어렵습니다. 기본값(`normal`)은 한글을 글자 단위로 끊습니다. `keep-all`은 단어를 유지하고, 공백에서 줄을 바꿉니다.

```css
body { word-break: keep-all; overflow-wrap: break-word; }
.url, .code { word-break: break-all; }   /* 긴 영문·URL은 예외 */
```

`keep-all`만 쓰면 공백이 없는 긴 영문·URL이 컨테이너를 뚫습니다. 그래서 `overflow-wrap: break-word`를 함께 두고, 정말 끊어야 하는 곳에만 `break-all`이나 `overflow-wrap: anywhere`를 씁니다. `line-break: strict`를 더하면 한글의 금칙 문자 처리도 조금 나아집니다.

### 말줄임(Ellipsis)

```css
/* 한 줄 */
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 여러 줄 */
.clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

한 줄 말줄임은 **폭이 정해져 있어야** 동작합니다. Flex item 안에서 쓰면 `min-width: 0`을 함께 넣어야 합니다. 이걸 빼먹으면 말줄임이 안 되고 카드가 옆으로 늘어납니다.

### line-height · letter-spacing

| 대상 | line-height | letter-spacing |
| --- | --- | --- |
| 본문 (한국어) | 1.75~1.9 | `-0.01em` |
| 제목 | 1.25~1.35 | `-0.03em` |
| 작은 라벨(eyebrow) | 1.2 | `0.12em` + 대문자 |
| 코드 | 1.7 | `0` |

한국어 본문에 영어 기준(1.5)을 그대로 쓰면 답답해 보입니다. 반대로 제목에 1.9를 쓰면 덩어리가 흩어집니다. 자간은 한글에서 음수, 작은 대문자 라벨에서 양수가 자연스럽습니다.

### border-radius · box-shadow · backdrop-filter

```css
.card { border-radius: var(--radius); box-shadow: var(--shadow-1); }
.card:hover { box-shadow: var(--shadow-2); }

.glass {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2); /* Safari */
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
```

그림자는 한 겹보다 두 겹이 자연스럽습니다. 가까운 곳은 좁고 진하게, 먼 곳은 넓고 옅게. `backdrop-filter`는 스크롤하는 큰 영역에 쓰면 성능이 눈에 띄게 떨어집니다. 상단 바처럼 작고 고정된 면에만 쓰고, 지원하지 않는 브라우저를 위해 반투명 배경을 먼저 깔아 둡니다.

### 캐시 무효화(Cache Busting)

CSS를 고쳤는데 사용자 화면이 그대로라면, 대개 캐시입니다. GitHub Pages는 파일명이 같으면 브라우저가 예전 파일을 씁니다.

```html
<link rel="stylesheet" href="/diary/assets/diary.css?v=20261120-ui">
<script src="/diary/assets/diary-search.js?v=20261120-ui" defer></script>
```

배포할 때마다 `?v=` 값을 바꿉니다. 이 다이어리의 검색 스크립트도 같은 방식으로 버전을 올리고 있습니다.

### 파비콘과 OG 이미지

| 자산 | 크기 | 비고 |
| --- | --- | --- |
| `favicon.ico` | 32×32, 48×48 포함 | 루트에 둡니다 |
| `favicon.svg` | 벡터 | 최신 브라우저 우선 |
| `apple-touch-icon.png` | 180×180 | 모서리는 브라우저가 둥글게 |
| OG 이미지 | 1200×630 | `og:image`는 **절대 URL** |
| Twitter 카드 | 1200×600 또는 1200×630 | `summary_large_image` |

OG 이미지에는 여백을 넉넉히 두고, 로고와 제목을 중앙에서 조금 위에 놓습니다. 카카오톡·슬랙 미리보기에서 잘리는 영역이 늘 다르기 때문입니다.

[![keep-all과 break-all, 말줄임, cover와 contain의 차이](/diary/assets/images/2026-11-20-ui-typo-aspect.png)](/diary/assets/images/2026-11-20-ui-typo-aspect.png)

## 7. 모바일 · 인앱 브라우저 특이사항

### iOS Safari 입력창 자동 확대

`input`, `textarea`, `select`의 `font-size`가 16px보다 작으면 iOS Safari가 포커스 시 화면을 확대합니다. 확대된 화면은 사용자가 직접 줄여야 하고, 레이아웃이 옆으로 밀립니다.

```css
input, textarea, select, button { font-size: max(16px, 1rem); }
```

`maximum-scale=1`로 막는 방법은 접근성을 해치고, 최신 iOS에서는 무시되는 경우도 있습니다. 글자 크기를 16px 이상으로 두는 것이 정답입니다.

### 핀치 줌과 터치 제어

```css
button, a, [role="button"] {
  touch-action: manipulation;          /* 더블탭 확대 지연 제거 */
  -webkit-tap-highlight-color: transparent;
}
.canvas-wrap { touch-action: none; }   /* 직접 제스처를 처리하는 캔버스 */
.no-select { user-select: none; -webkit-user-select: none; }
```

`touch-action: manipulation`은 더블탭 확대를 끄고 300ms 지연을 없앱니다. 캔버스나 지도처럼 포인터 이벤트로 직접 확대·이동을 구현하는 곳은 `none`으로 두고, 그 대신 두 손가락 확대를 직접 만들어야 합니다. 페이지 전체의 확대를 막는 것은 접근성 위반입니다.

### 카카오톡 인앱 브라우저(WebView)

카카오톡으로 링크를 열면 안드로이드는 Chrome 기반 WebView, iOS는 `WKWebView`에서 열립니다. 일반 Safari와 다르게 동작하는 것들이 있습니다.

| 항목 | 증상 | 대응 |
| --- | --- | --- |
| 파일 다운로드 | `<a download>`가 무시되거나 새 창이 빈 채로 뜸 | 새 창 없이 Blob/data URL로 저장 시도, 안 되면 "브라우저에서 열기" 안내 |
| `window.open` | 팝업이 차단되거나 같은 탭에서 열림 | 인앱에서는 모달로 대체 |
| 주소창 높이 | `100vh`가 실제보다 큼 | `100dvh` + `env()` |
| `localStorage` | 앱이 종료되면 비워지는 경우가 있음 | 중요한 상태는 서버나 URL에 |
| 클립보드 | `navigator.clipboard` 권한 거부 | `execCommand` 폴백, 실패 시 직접 선택 안내 |
| 서비스 워커·PWA 설치 | 지원하지 않거나 제한 | "브라우저에서 열기" 배너 |
| 하단 고정 바 | 스크롤 시 위치가 튐 | `position: sticky` 또는 `100dvh` 그리드 |

Shutterplate에서 겪은 것이 파일 다운로드입니다. 안드로이드 카카오톡 인앱 브라우저에서 `<a download>`와 Blob 저장이 막혀, `data:` URL로 우회한 뒤에야 저장이 되었습니다. 그래서 지금은 내보내기 화면에 "인앱 브라우저에서는 저장이 제한될 수 있습니다. 브라우저에서 열어 주세요"라는 안내를 함께 둡니다.

### iOS 시각 뷰포트와 키보드

키보드가 올라오면 `window.innerHeight`는 그대로인데 `visualViewport.height`만 줄어듭니다. 그래서 `position: fixed; bottom: 0`인 하단 바가 키보드 위로 떠오르거나, 반대로 키보드 뒤에 숨습니다. 채팅형 입력창은 `visualViewport`를 기준으로 위치를 잡습니다.

```js
vv?.addEventListener('resize', () => {
  bar.style.transform = `translateY(${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px)`;
});
```

## 8. 수정 지시 실전 치트시트

증상을 정확한 용어로 바꾸는 표입니다. 지시를 받았을 때, 또는 지시를 쓸 때 첫 점검 자리로 쓰면 됩니다.

| 증상 | 정확한 용어 | 첫 점검 |
| --- | --- | --- |
| "화면 밑에 잘림" | 뷰포트 높이 오계산, 안전 영역 미적용 | `100dvh`, `env(safe-area-inset-bottom)`, `min-height: 0` |
| "가로로 삐져나옴" | 가로 넘침(horizontal overflow) | 고정 폭, Flex 자식 `min-width: 0`, `100vw` |
| "우하단 떠 있는 버튼 위치" | FAB 오프셋 | `bottom: calc(16px + env(...))`, 하단 바 높이 |
| "모달 뒤가 스크롤됨" | 스크롤 잠금 실패 | `position: fixed` 잠금, `overscroll-behavior` |
| "헤더에 내용이 가려짐" | 고정 헤더 오프셋 | `--topbar-h`, `padding-top`, `scroll-margin-top` |
| "이미지가 찌그러짐" | 종횡비 왜곡 | `aspect-ratio`, `object-fit: cover/contain` |
| "글자가 단어 중간에서 끊김" | 한글 줄바꿈 | `word-break: keep-all` |
| "입력하면 화면이 확대됨" | iOS 자동 확대 | 입력 `font-size: 16px` 이상 |
| "스크롤이 튕김" | 오버스크롤 | `overscroll-behavior: contain/none` |
| "드롭다운이 다른 요소 뒤로 숨음" | 쌓임 맥락 | `z-index` 토큰, `isolation: isolate`, 조상 `overflow` |
| "버튼이 안 눌림" | 터치 영역·가림 | 투명 오버레이, `pointer-events`, 44×44 |
| "배포했는데 예전 화면" | 캐시 | `?v=` 갱신, 강력 새로고침 |
| "레이아웃이 한 프레임 흔들림" | 리플로우 | `dvh` 대신 `svh`, 폰트 `font-display` |
| "스크롤이 두 개" | 중첩 스크롤 컨테이너 | Flex 열 `min-height: 0`, `overflow: auto` 위치 |
| "탭을 눌러도 내용이 안 바뀜" | Tab 역할 혼동 | `role="tab"`·`aria-selected`·패널 연결 |

이 표의 왼쪽 열은 사용자의 말이고, 가운데 열은 코드의 말입니다. 고칠 때는 가운데 열로 검색하고, 보고할 때는 왼쪽 열로 다시 옮겨 적습니다. 사용자는 "쌓임 맥락이 꼬였다"를 이해할 필요가 없고, 우리는 "점 세 개 메뉴가 이상해요"로는 원인을 찾을 수 없습니다.

## 마무리

이 글에 적은 것들은 대부분 한 줄짜리 수정입니다. `min-height: 0` 한 줄, `max(12px, env(safe-area-inset-bottom))` 한 줄, `word-break: keep-all` 한 줄. 그런데 그 한 줄을 찾아가는 데 걸리는 시간이 대부분의 작업 시간이었습니다.

그래서 이름이 중요합니다. 이름이 있으면 검색이 되고, 검색이 되면 원인이 좁혀집니다. 그리고 다음에 같은 증상이 나왔을 때, 처음부터 다시 헤매지 않습니다. 화면을 고치는 일의 절반은 화면이 어긋난 자리를 정확히 부르는 일입니다.
