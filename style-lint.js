'use strict';

// 洛谷排版规范检查（v1.2.2）
// 规则集：洛谷社区通行的《洛谷 Markdown 排版规范》核心条目，全部为提示级（Hint），
// 与 lint.js 的语法 Error/Warning 区分开。以下区域豁免检查：
//   围栏代码块、行内代码 `...`、数学公式 $...$ / $$...$$、裸 URL / 尖括号自动链接、
//   链接与图片的 (url) 目标部分、反斜杠转义对。

// 是否是汉字（CJK 统一表意文字 + 兼容区）
function isCJK(ch) {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF) || (c >= 0xF900 && c <= 0xFAFF);
}

// 是否是 ASCII 字母或数字（盘古之白判定对象）
function isAsciiAlnum(ch) {
  return !!ch && /[A-Za-z0-9]/.test(ch);
}

// 全角中文标点集合
const FULL_PUNCT = '。，！？；：、（）《》「」『』【】“”‘’…—·';
function isFullPunct(ch) {
  return !!ch && FULL_PUNCT.indexOf(ch) >= 0;
}

// 半角标点 → 对应全角（用于提示文案）
const HALF_TO_FULL = { ',': '，', '.': '。', ';': '；', ':': '：', '!': '！', '?': '？' };

// 将豁免区域替换为空格（保留换行与列位），其余原样保留。
function maskExemptRegions(text) {
  const chars = text.split('');
  const lines = text.split('\n');
  let offset = 0;
  let inFence = false;
  let inMathBlock = false;

  const blank = (from, to) => {
    for (let i = from; i < to; i++) if (chars[i] !== '\n') chars[i] = ' ';
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) { inFence = !inFence; blank(offset, offset + line.length); offset += line.length + 1; continue; }
    if (inFence) { blank(offset, offset + line.length); offset += line.length + 1; continue; }
    if (/^\$\$/.test(trimmed)) { inMathBlock = !inMathBlock; blank(offset, offset + line.length); offset += line.length + 1; continue; }
    if (inMathBlock) { blank(offset, offset + line.length); offset += line.length + 1; continue; }

    // 行内逐字符扫描
    let i = 0;
    const start = offset;
    while (i < line.length) {
      const global = start + i;
      const ch = line[i];
      // 反斜杠转义对
      if (ch === '\\' && i + 1 < line.length) { blank(global, global + 2); i += 2; continue; }
      // 行内代码 `...`
      if (ch === '`') {
        const close = line.indexOf('`', i + 1);
        if (close > i) { blank(global, start + close + 1); i = close + 1; continue; }
        i++;
        continue;
      }
      // 行内数学 $...$
      if (ch === '$') {
        const rest = line.slice(i + 1);
        const m = rest.match(/([^\\$]|^)\$/);
        if (m) {
          const close = i + 1 + (m.index || 0) + m[0].length - 1;
          blank(global, start + close + 1); i = close + 1; continue;
        }
        i++;
        continue;
      }
      // 尖括号自动链接 <https://...>
      if (ch === '<') {
        const m = line.slice(i).match(/^<\w+:[^>\s]*>/);
        if (m) { blank(global, global + m[0].length); i += m[0].length; continue; }
        i++;
        continue;
      }
      // 裸 URL
      if (ch === 'h' || ch === 'H') {
        const m = line.slice(i).match(/^https?:\/\/\S+/i);
        if (m) { blank(global, global + m[0].length); i += m[0].length; continue; }
        i++;
        continue;
      }
      // 链接/图片目标 ](...)
      if (ch === ']' && line[i + 1] === '(') {
        let depth = 1, j = i + 2;
        while (j < line.length && depth > 0) {
          if (line[j] === '(') depth++;
          else if (line[j] === ')') depth--;
          if (depth === 0) break;
          j++;
        }
        if (depth === 0) { blank(global, start + j + 1); i = j + 1; continue; }
        i++;
        continue;
      }
      i++;
    }
    offset += line.length + 1;
  }
  return chars.join('');
}

// 返回 [{line, col, length, message, severity:'hint'}]
function lintLuoguStyle(text) {
  const issues = [];
  const MAX = 200;
  const push = (line, col, length, message) => {
    if (issues.length < MAX) issues.push({ line, col, length, severity: 'hint', source: 'style', message });
  };

  const masked = maskExemptRegions(text);
  const maskedLines = masked.split('\n');
  const origLines = text.split('\n');

  // 规则：标题层级跳跃 / 连续空行 / 行尾多余空格（跟踪状态）
  let prevHeadingLevel = 0;
  let blankRun = 0;
  let inFence = false;
  let inMathBlock = false;

  for (let ln = 0; ln < maskedLines.length; ln++) {
    const mline = maskedLines[ln];
    const oline = origLines[ln];
    const trimmed = oline.trim();

    // 区域状态（与原行比对，围栏/数学块内只判空行，不判其余）
    if (/^(```|~~~)/.test(trimmed)) { inFence = !inFence; blankRun = 0; continue; }
    if (!inFence && /^\$\$/.test(trimmed)) { inMathBlock = !inMathBlock; blankRun = 0; continue; }
    if (inFence || inMathBlock) { blankRun = 0; continue; } // 代码/数学块内不做任何检查

    // 规则 6：连续 3+ 空行
    if (trimmed === '') {
      blankRun++;
      if (blankRun >= 3) push(ln, 0, 1, '多余空行：建议最多保留一个空行');
      continue;
    }
    blankRun = 0;

    // 规则 5：行尾空格
    const trail = oline.match(/[ \t]+$/);
    if (trail) {
      if (!/ {2}$/.test(oline) || / {2} $/.test(oline) || /\t/.test(trail[0])) {
        push(ln, oline.length - trail[0].length, trail[0].length,
          '行尾有多余空格：洛谷上的硬换行需恰好两个空格，其余数量建议删除');
      }
    }

    // 规则 7：标题层级跳跃
    const hm = oline.match(/^(#{1,6})\s/);
    if (hm) {
      const level = hm[1].length;
      if (prevHeadingLevel > 0 && level > prevHeadingLevel + 1) {
        push(ln, 0, level, '标题层级跳跃：建议按 # → ## → ### 逐层递进，不要跨级');
      }
      prevHeadingLevel = level;
    }

    // ↓ 以下逐字符规则都在遮罩文本上执行
    const len = mline.length;
    for (let i = 0; i < len; i++) {
      const ch = mline[i];
      const prev = i > 0 ? mline[i - 1] : '';
      const next = i + 1 < len ? mline[i + 1] : '';

      // 规则 1：盘古之白（中英文/中数字之间需要空格）
      if (isCJK(ch) && isAsciiAlnum(next)) {
        push(ln, i, 1, '中英文、中文与数字之间建议加一个空格（盘古之白）');
        continue;
      }
      if (isAsciiAlnum(ch) && isCJK(next)) {
        push(ln, i, 1, '中英文、中文与数字之间建议加一个空格（盘古之白）');
        continue;
      }

      // 规则 2：中文语境下的半角标点 → 建议全角
      if (HALF_TO_FULL[ch]) {
        const leftOK = isCJK(prev) || isFullPunct(prev);
        const rightOK = isCJK(next) || isFullPunct(next) || next === '' || next === ' ';
        if (leftOK && rightOK) {
          push(ln, i, 1, `中文语境下建议使用全角标点「${HALF_TO_FULL[ch]}」代替「${ch}」`);
        }
        continue;
      }
      // 半角括号：与中文直接相邻时建议全角
      if (ch === '(' && isCJK(next)) {
        push(ln, i, 1, '中文语境下的括号建议使用全角「（）」');
        continue;
      }
      if (ch === ')' && isCJK(prev)) {
        push(ln, i, 1, '中文语境下的括号建议使用全角「（）」');
        continue;
      }

      // 规则 3：全角标点两侧不应有空格
      if (isFullPunct(ch)) {
        if (prev === ' ' || next === ' ') {
          push(ln, i, 1, '全角标点两侧不需要空格');
        }
        continue;
      }
    }
  }
  return issues;
}

module.exports = { lintLuoguStyle };
