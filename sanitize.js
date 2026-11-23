// 본문 HTML 정리 (sanitize)
// 에디터에서 온 HTML을 그대로 저장하면 다른 사람이 악성 스크립트를 심을 수 있습니다.
// 여기서 허용한 태그·속성만 남기고 나머지는 모두 지웁니다.

const sanitizeHtml = require('sanitize-html');

// 연출 이름: 기본 연출 + 직접 넣은 효과음(snd-...)
const BUILTIN_FX = ['fade', 'blackout', 'knock', 'shake', 'vanish', 'scream', 'flash', 'jump', 'type'];
const isValidUpload = (src) => /^\/uploads\/[0-9a-f-]{36}\.(jpg|png)$/.test(String(src || ''));
const isValidFx = (v) => BUILTIN_FX.includes(v) || /^snd-[a-z0-9_-]{1,40}$/.test(v);

const OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'strike', 'h2', 'h3', 'hr', 'blockquote', 'span', 'div', 'figure', 'figcaption', 'img'],
  allowedAttributes: {
    '*': ['class', 'data-fx', 'data-fx-tier', 'data-fx-label'],
    span: ['class', 'title', 'tabindex'],
    figure: ['class', 'data-fx', 'data-fx-tier', 'data-fx-label', 'data-blur'],
    img: ['src', 'alt']
  },
  // 사진은 우리 서버에 올린 것(/uploads/...)만 허용
  exclusiveFilter: (frame) => frame.tag === 'img' && !isValidUpload(frame.attribs.src),
  allowedClasses: {
    '*': ['spoiler', 'hud-line', 'hud-line--alert', 'sfx-line', 'blood', 'strong', 'story-end', 'evidence-photo']
  },
  // 버튼·그림 안의 글자는 본문으로 남기지 않음
  nonTextTags: ['script', 'style', 'textarea', 'option', 'button', 'svg', 'noscript'],
  transformTags: {
    // 브라우저가 Enter로 만드는 div는 문단(p)으로 통일
    div: (tagName, attribs) => ({ tagName: 'p', attribs }),
    '*': (tagName, attribs) => {
      const a = Object.assign({}, attribs);
      if (a['data-fx'] && !isValidFx(a['data-fx'])) {
        delete a['data-fx']; delete a['data-fx-tier']; delete a['data-fx-label'];
      }
      if (a['data-fx-tier'] && !['free', 'paid'].includes(a['data-fx-tier'])) delete a['data-fx-tier'];
      if (a['data-fx-label']) a['data-fx-label'] = String(a['data-fx-label']).slice(0, 40);
      if (a.tabindex && a.tabindex !== '0') delete a.tabindex;
      if (a['data-blur'] && a['data-blur'] !== '1') delete a['data-blur'];
      if (a.alt) a.alt = String(a.alt).slice(0, 120);
      return { tagName, attribs: a };
    }
  }
};

function cleanContent(html) {
  return sanitizeHtml(String(html || ''), OPTIONS).trim();
}

// 태그를 모두 지운 순수 글자 (요약, 빈 글 검사용)
function plainText(html) {
  const spaced = String(html || '').replace(/<\/(p|h2|h3|blockquote|div)>|<br\s*\/?>/gi, ' ');   // 문단 사이 띄어쓰기
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// 본문에 쓰인 연출 목록 (통계용)
function extractEffects(html) {
  const out = [];
  const re = /<[^>]*\sdata-fx="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tier = (m[0].match(/data-fx-tier="(free|paid)"/) || [])[1] || (['shake', 'vanish', 'scream', 'flash', 'jump', 'type'].includes(m[1]) || m[1].startsWith('snd-') ? 'paid' : 'free');
    out.push({ type: m[1], tier });
  }
  return out;
}

module.exports = { cleanContent, plainText, extractEffects };
