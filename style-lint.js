'use strict';

// 洛谷排版规范检查（v1.2.3）
// 规则集：《洛谷主题库题解规范》与《专栏推荐规范》中可机器判定的条目，
// 全部以最轻量 Hint 级呈现（与 lint.js 的语法 Error/Warning 区分开）。
// 豁免区域：围栏代码块、行内代码 `...`、数学公式 $...$ / $$...$$（其内容
// 由专门的「公式内规则」单独检查）、裸 URL / 尖括号自动链接、链接与图片的
// (url) 目标部分、反斜杠转义对。
//
// 覆盖条目对照：
//   §1.1 全角中文标点 / 句末必须有标点
//   §1.2 中文 ↔ 英文单词/数字/LaTeX 公式 之间半角空格（盘古之白）
//   §1.3 中文标点 与 英文/数字/公式 之间严禁空格
//   §2   公式碎拼、<=/>=/!=/==、* 充当乘号、纯文本 O(…)、5e9、裸 mod、
//        公式内混入中文/全角标点、非数学内容误用 LaTeX
//   §3   行间代码块应显式声明语言
// （§4 题解内容质量要求无法机器判定，不在本检查范围）

// ─────────────────────────────── 基础判定 ───────────────────────────────

// 是否是汉字（CJK 统一表意文字 + 扩展A + 兼容区）
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

// 句子的合法结尾字符（句末标点判定用）
const SENTENCE_END = '。！？；：，、.!?;:,）)」』》]}]*`$~-—';

// ─────────────────────────── 豁免区域遮罩 ───────────────────────────
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
      // 行内数学 $...$ / $$...$$
      if (ch === '$') {
        const dbl = line.startsWith('$$', i);
        const tok = dbl ? '$$' : '$';
        const close = line.indexOf(tok, i + tok.length);
        if (close > i) { blank(global, start + close + tok.length); i = close + tok.length; continue; }
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
        if (depth === 0) { blank(global + 1, start + j + 1); i = j + 1; continue; } // 保留 ']' 供句末判定
        i++;
        continue;
      }
      i++;
    }
    offset += line.length + 1;
  }
  return chars.join('');
}

// 在原始行中找出所有行内数学区间 [{start,end})（跳过 \转义 与代码行由调用方保证）
function findMathSpans(line) {
  const spans = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '$') {
      const dbl = line.startsWith('$$', i);
      const tok = dbl ? '$$' : '$';
      const close = line.indexOf(tok, i + tok.length);
      if (close > i + (dbl ? 1 : 0)) { spans.push({ start: i, end: close + tok.length }); i = close + tok.length; continue; }
      i++;
      continue;
    }
    i++;
  }
  return spans;
}

// 在原始行中找出所有行内代码区间 `...` [{start,end})
function findCodeSpans(line) {
  const spans = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\\') { i += 2; continue; }
    if (line[i] === '`') {
      const close = line.indexOf('`', i + 1);
      if (close > i) { spans.push({ start: i, end: close + 1 }); i = close + 1; continue; }
      i++;
      continue;
    }
    i++;
  }
  return spans;
}

// ─────────────────────────────── 主入口 ───────────────────────────────
// 返回 [{line, col, length, message, severity:'hint'}]
function lintLuoguStyle(text) {
  text = text.replace(/\r\n?/g, '\n'); // CRLF 归一：否则行尾 \r 使行尾空格/句末判定失效
  const issues = [];
  const MAX = 300;
  const push = (line, col, length, message) => {
    if (issues.length < MAX) issues.push({ line, col, length, severity: 'hint', source: 'style', message });
  };

  const masked = maskExemptRegions(text);
  const maskedLines = masked.split('\n');
  const origLines = text.split('\n');

  // 跨行状态
  let prevHeadingLevel = 0;
  let blankRun = 0;
  let inFence = false;
  let inMathBlock = false;

  for (let ln = 0; ln < maskedLines.length; ln++) {
    const mline = maskedLines[ln];
    const oline = origLines[ln];
    const trimmed = oline.trim();

    // ── 围栏 / 数学块状态 ──
    const fenceOpen = trimmed.match(/^(```|~~~)(.*)$/);
    if (fenceOpen) {
      // §3：行间代码块应显式声明语言
      if (!inFence && fenceOpen[1] === '```' && fenceOpen[2].trim() === '') {
        push(ln, 0, 3, '行间代码块应显式声明编程语言（如 ```cpp、```python）');
      }
      inFence = !inFence; blankRun = 0; continue;
    }
    if (!inFence && /^\$\$/.test(trimmed)) { inMathBlock = !inMathBlock; blankRun = 0; continue; }
    if (inFence || inMathBlock) { blankRun = 0; continue; } // 代码/数学块内不做任何检查

    // ── 多余空行 ──
    if (trimmed === '') {
      blankRun++;
      if (blankRun >= 3) push(ln, 0, 1, '多余空行：建议最多保留一个空行');
      continue;
    }
    blankRun = 0;

    // ── 行尾空格 ──
    const trail = oline.match(/[ \t]+$/);
    if (trail && (!/ {2}$/.test(oline) || / {2} $/.test(oline) || /\t/.test(trail[0]))) {
      push(ln, oline.length - trail[0].length, trail[0].length,
        '行尾有多余空格：洛谷上的硬换行需恰好两个空格，其余数量建议删除');
    }

    // ── 标题层级跳跃 ──
    const hm = oline.match(/^(#{1,6})\s/);
    if (hm) {
      const level = hm[1].length;
      if (prevHeadingLevel > 0 && level > prevHeadingLevel + 1) {
        push(ln, 0, level, '标题层级跳跃：建议按 # → ## → ### 逐层递进，不要跨级');
      }
      prevHeadingLevel = level;
    }

    // ── §1.1 句末必须有标点 ──
    // 逐行判定：洛谷题解常见「一句一行」，每一行都应是完整句子；以 「，、：（」
    // 等延续性标点结尾的行自然被跳过（软换行的段落不会被误伤——拦截的是无标点
    // 结尾的行）。仅跳过标题/过短行/表格/HTML/折叠头。
    if (!hm && oline.trim().length >= 4 && !/^\s*[|>]|^\s*<|^:::/.test(oline)) {
      const lastVisible = mline.replace(/\s+$/, '').slice(-1);
      const hasCJK = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(mline);
      if (hasCJK && lastVisible && SENTENCE_END.indexOf(lastVisible) < 0) {
        push(ln, mline.replace(/\s+$/, '').length - 1, 1,
          '句末建议补充标点符号（句末一般应有句号「。」——《题解规范》§1.1）');
      }
    }

    const len = mline.length;
    for (let i = 0; i < len; i++) {
      const ch = mline[i];
      const prev = i > 0 ? mline[i - 1] : '';
      const next = i + 1 < len ? mline[i + 1] : '';

      // ── §1.2 盘古之白：中文 ↔ 英文/数字 之间需要半角空格 ──
      if ((isCJK(ch) && isAsciiAlnum(next)) || (isAsciiAlnum(ch) && isCJK(next))) {
        push(ln, i, 1, '中英文、中文与数字之间需要以半角空格隔开（§1.2）');
        continue;
      }

      // ── §1.1 中文语境下的半角标点 → 建议全角 ──
      // 注：句中「.」只在两侧都是中文时才提示（排除小数/域名/版本号），
      // 句末的英文句号统一提示为全角句号。
      if (HALF_TO_FULL[ch]) {
        const leftCJK = isCJK(prev) || isFullPunct(prev);
        if (ch === '.') {
          if (leftCJK && (next === '' || next === ' ')) {
            push(ln, i, 1, '中文句末请使用全角句号「。」（§1.1）');
          } else if (leftCJK && isCJK(next)) {
            push(ln, i, 1, '中文语境下建议使用全角标点「。」代替「.」（§1.1）');
          }
        } else if (leftCJK && (isCJK(next) || isFullPunct(next) || next === '' || next === ' ')) {
          push(ln, i, 1, `中文语境下建议使用全角标点「${HALF_TO_FULL[ch]}」代替「${ch}」（§1.1）`);
        }
        continue;
      }
      // 半角括号：与中文直接相邻时建议全角
      if ((ch === '(' && isCJK(next)) || (ch === ')' && isCJK(prev))) {
        push(ln, i, 1, '中文语境下的括号建议使用全角「（）」（§1.1）');
        continue;
      }
    }

    // ── §2 正文中以 * 充当乘号（数字*数字）──
    const mulText = /(^|[^\w*`\\])\d(?:\d|\s)*\*(?!\*)\s*\d/g;
    let mm;
    while ((mm = mulText.exec(mline)) !== null) {
      push(ln, mm.index + mm[0].indexOf('*'), 1,
        '严禁用 * 代替乘号：数学乘法必须用 $\\times$ 或 $\\cdot$（§2）');
    }

    // ── §2 纯文本 O(…) 复杂度 ──
    const bareO = /(?<![A-Za-z0-9_\\])O\([^()]{1,24}\)/g;
    while ((mm = bareO.exec(mline)) !== null) {
      push(ln, mm.index, mm[0].length,
        '算法复杂度禁止写纯文本：应写为 $\\mathcal{O}(\\cdots)$（§2）');
    }

    // ── §2 大数字未用科学计数法 ──
    const sci = /(?<![A-Za-z0-9_.\\])\d+(?:\.\d+)?[eE]\+?\d+/g;
    while ((mm = sci.exec(mline)) !== null) {
      push(ln, mm.index, mm[0].length,
        '大数字建议使用科学计数法（如 $5 \\times 10^9$，不写 5e9——§2）');
    }

    // ── 公式相关规则（作用在原始行的 $...$ 区间上）──
    const spans = findMathSpans(oline);

    // ── §1.3 中文标点 与 英文/数字/公式 之间严禁空格 ──
    // 在原始行上判定（遮罩会把公式/URL 变成空格，用遮罩文本会产生"假空格"误报），
    // 跳过行内代码与公式区间内部；越过连续空格找到两侧真正的邻居字符。
    const codeSpans = findCodeSpans(oline);
    const inExempt = (idx) =>
      spans.some(sp => idx >= sp.start && idx < sp.end) ||
      codeSpans.some(sp => idx >= sp.start && idx < sp.end);
    for (let i = 0; i < oline.length; i++) {
      const ch = oline[i];
      if (!isFullPunct(ch) || inExempt(i)) continue;
      if (i > 0 && oline[i - 1] === ' ') {
        let pi = i - 1; while (pi >= 0 && oline[pi] === ' ') pi--;
        const pv = pi >= 0 ? oline[pi] : '';
        if (isCJK(pv) || isAsciiAlnum(pv) || pv === ')' || pv === ']' || pv === '$' || isFullPunct(pv)) {
          push(ln, i, 1, '中文标点与中文、英文、数字或公式之间严禁空格（§1.3，如「$n \\le 10^5$ ，」违规）');
          continue;
        }
      }
      if (i + 1 < oline.length && oline[i + 1] === ' ') {
        let ni = i + 1; while (ni < oline.length && oline[ni] === ' ') ni++;
        const nv = ni < oline.length ? oline[ni] : '';
        if (isCJK(nv) || isAsciiAlnum(nv) || nv === '$') {
          push(ln, i, 1, '中文标点与中文、英文、数字或公式之间严禁空格（§1.3，如「$n \\le 10^5$ ，」违规）');
          continue;
        }
      }
    }

    // §2 碎拼：相邻公式区间之间只隔着空格与运算/比较符 → 应合写进一个 $ 环境
    for (let k = 0; k + 1 < spans.length; k++) {
      const gap = oline.slice(spans[k].end, spans[k + 1].start);
      if (gap.length <= 6 && /^\s*[+\-=<>×÷．.,，、/]*\s*$/.test(gap) && gap.trim() !== '') {
        push(ln, spans[k].end - 1, 1,
          '同一公式必须写在同一个 $ 环境内，禁止「$a$ + $b$」式碎拼（§2）');
        break; // 每行提示一次即可
      }
    }

    for (const sp of spans) {
      const tokLen = oline.startsWith('$$', sp.start) ? 2 : 1;
      const inner = oline.slice(sp.start + tokLen, sp.end - tokLen);
      const innerBase = sp.start + tokLen; // 公式内容起始列（inner 内偏移 + innerBase = 全局列）

      // §1.2 中文与 LaTeX 公式 之间需要半角空格
      const bc = sp.start > 0 ? oline[sp.start - 1] : '';
      const ac = sp.end < oline.length ? oline[sp.end] : '';
      if (isCJK(bc)) push(ln, sp.start - 1, 1, '中文与 LaTeX 公式之间需要以半角空格隔开（§1.2）');
      if (isCJK(ac)) push(ln, sp.end, 1, '中文与 LaTeX 公式之间需要以半角空格隔开（§1.2）');

      // §2 公式内混入中文或全角标点
      let cjkIn = -1;
      for (let j = 0; j < inner.length; j++) {
        const cj = inner[j];
        if (isCJK(cj) || isFullPunct(cj)) { cjkIn = j; break; }
      }
      if (cjkIn >= 0) {
        push(ln, innerBase + cjkIn, 1, '公式内混入中文或全角标点：公式内容请使用数学语言（§2）');
      }

      // §2 数学语言：比较符号
      const cmpMap = [
        [/<=/g, '\\le'], [/>=/g, '\\ge'], [/!=/g, '\\ne'], [/==/g, '=（严格同余用 \\equiv）']
      ];
      for (const [re, sug] of cmpMap) {
        let cm;
        while ((cm = re.exec(inner)) !== null) {
          push(ln, innerBase + cm.index, cm[0].length,
            `公式中禁止使用 ${cm[0]}：比较符号必须用 ${sug}（§2）`);
        }
      }

      // §2 乘法符号 *
      const mulMath = /(?<![\\*])\*(?!\*)/g;
      let xm;
      while ((xm = mulMath.exec(inner)) !== null) {
        push(ln, innerBase + xm.index, 1,
          '公式中禁止使用 * 作乘号：必须用 \\times 或 \\cdot（§2）');
      }

      // §2 裸 mod
      const mod = /(?<![\\A-Za-z])mod(?![A-Za-z])/;
      const modM = inner.match(mod);
      if (modM) {
        push(ln, innerBase + modM.index, 3,
          '取模必须写 \\bmod（同余用 \\equiv 与 \\pmod p——§2）');
      }

      // §2 非数学内容误用 LaTeX：公式整体仅是英文单词/词组（≥3 字母，如 $DFS$、$Dijkstra$）
      // （1~2 字母是合法变量写法，含变量混排的词组不视为整块英文文本）
      if (/^[A-Za-z]{3,}( +[A-Za-z]{3,})*$/.test(inner.trim()) && !/\\/.test(inner)) {
        push(ln, innerBase, Math.max(1, inner.trim().length),
          '非数学公式内容（英文单词、算法名、题目名）不应使用 LaTeX 环境（§2）');
      }
    }
  }
  return issues;
}

// ─────────────────────────── 一键排版自动修复（v1.2.4）───────────────────────────
// 与 lintLuoguStyle 同一套区域语义（围栏代码/数学块原文保留；行内代码与行内公式
// 在文本规则执行期间用占位符保护，公式内部只应用 §2 机械替换）。
// 覆盖所有可机械判定的规则；无法安全推断的（标题层级、代码块语言、公式内混入
// 中文文字）保持原样交人工处理。

// 行内数学区间内部修复（§2 数学语言）
function fixMathInner(inner) {
  let s = inner;
  s = s.replace(/==/g, ' = ');              // 比较等号（同余需人工改 \equiv）
  s = s.replace(/<=/g, ' \\le ').replace(/>=/g, ' \\ge ').replace(/!=/g, ' \\ne ');
  s = s.replace(/(?<![\\*a-zA-Z])\*(?!\*)/g, ' \\times ');     // * 充当乘号
  s = s.replace(/(?<![\\a-zA-Z])mod(?![a-zA-Z])/g, ' \\bmod ');    // 裸 mod
  // 公式内全角标点 → 半角（混入中文文字不处理，交人工）
  s = s.replace(/，/g, ', ').replace(/；/g, '; ').replace(/：/g, ': ')
       .replace(/！/g, '!').replace(/？/g, '?').replace(/。/g, '.');
  s = s.replace(/ {2,}/g, ' ').trim();
  return s;
}

function autoFixLuoguStyle(text) {
  const IS_CN = (c) => !!c && /[一-鿿㐀-䶿豈-﫿]/.test(c);
  const IS_ALNUM = (c) => !!c && /[A-Za-z0-9]/.test(c);
  const origLines = text.split('\n');
  const out = [];
  let inFence = false, inMathBlock = false, blankRun = 0;

  for (let ln = 0; ln < origLines.length; ln++) {
    // CRLF 兼容：剥掉行尾 \r 再跑规则（否则行尾类正则全部落空），写回时补回
    const hasCR = origLines[ln].endsWith('\r');
    const oline = hasCR ? origLines[ln].slice(0, -1) : origLines[ln];
    const trimmed = oline.trim();
    const keep = hasCR ? '\r' : '';

    if (/^(```|~~~)/.test(trimmed)) { inFence = !inFence; out.push(oline + keep); blankRun = 0; continue; }
    if (!inFence && /^\$\$/.test(trimmed)) { inMathBlock = !inMathBlock; out.push(oline + keep); blankRun = 0; continue; }
    if (inFence || inMathBlock) { out.push(oline + keep); continue; }

    // 空行压缩：连续空行最多保留 1 个
    if (trimmed === '') { blankRun++; if (blankRun <= 1) out.push(keep); continue; }
    blankRun = 0;

    // 行尾空格规范化：恰好两个空格（硬换行）保留，其余剥除
    let line = oline.replace(/[ \t]+$/, (ws) => (ws === '  ' ? ws : ''));

    // ── §2 公式碎拼合并：$a$ + $b$ → $a + b$（循环至收敛）──
    let merged = line, guard = 0;
    do {
      line = merged;
      merged = line.replace(/(\$[^$\n]+\$)(\s*[+\-=<>]+\s*)(\$[^$\n]+\$)/g,
        (m, a, gap, b) => a.slice(0, -1) + gap + b.slice(1));
    } while (merged !== line && ++guard < 20);

    // ── §2 行内公式内部修复；英文单词误用 LaTeX 拆壳（$DFS$ → DFS）──
    line = line.replace(/\$\$([^$\n]+)\$\$|\$([^$\n]+)\$/g, (m, dbl, sgl) => {
      const inner = (dbl !== undefined ? dbl : sgl);
      if (/^[A-Za-z]{3,}( +[A-Za-z]{3,})*$/.test(inner.trim()) && inner.indexOf('\\') < 0) {
        return inner.trim();
      }
      const fixed = fixMathInner(inner);
      return dbl !== undefined ? `$$${fixed}$$` : `$${fixed}$`;
    });

    // ── 行内公式 / 行内代码 / 转义对 → 占位符，保护其不受文本规则影响 ──
    const tokens = [];
    line = line.replace(/\$\$[^$\n]+\$\$|\$[^$\n]+\$|`[^`\n]+`|\\[\\`*_{}\[\]()#+\-.!$~|]/g,
      (m) => { tokens.push(m); return `Z${String(tokens.length - 1).padStart(3, '0')}Z`; });

    // ── §1.3 预清理：中文语境下半角标点两侧的空格先剥落（如「中文 ，中文」）──
    line = line.replace(/([一-鿿㐀-䶿豈-﫿。，！？；：、（）《》「」]) +([,.;:!?]) *(?=[一-鿿㐀-䶿豈-﫿。，！？；：、]|$)/g, '$1$2');

    // ── §1.1 中文语境半角标点 → 全角（逐字符上下文换算）──
    {
      const HALF2FULL = { ',': '，', '.': '。', ';': '；', ':': '：', '!': '！', '?': '？' };
      const arr = line.split('');
      for (let i = 0; i < arr.length; i++) {
        const ch = arr[i], pv = arr[i - 1] || '', nx = arr[i + 1] || '';
        const leftCJK = IS_CN(pv) || FULL_PUNCT.indexOf(pv) >= 0;
        const rightOK = IS_CN(nx) || FULL_PUNCT.indexOf(nx) >= 0 || IS_ALNUM(nx) || nx === '' || nx === ' ';
        if (HALF2FULL[ch] && leftCJK && rightOK) {
          if (ch === '.' && !(IS_CN(nx) || nx === '' || nx === ' ')) continue; // 3.14 / luogu.com 之类不换算
          arr[i] = HALF2FULL[ch];
          continue;
        }
        if (ch === '(' && IS_CN(nx)) { arr[i] = '（'; continue; }
        if (ch === ')' && IS_CN(pv)) { arr[i] = '）'; continue; }
      }
      line = arr.join('');
    }

    // ── §1.3 全角标点两侧严禁空格 ──
    {
      const arr = line.split('');
      for (let i = 0; i < arr.length; i++) {
        if (FULL_PUNCT.indexOf(arr[i]) < 0) continue;
        if (arr[i - 1] === ' ') {
          let pi = i - 1; while (pi >= 0 && arr[pi] === ' ') pi--;
          const pv = pi >= 0 ? arr[pi] : '';
          if (IS_CN(pv) || IS_ALNUM(pv) || pv === ')' || pv === ']' || FULL_PUNCT.indexOf(pv) >= 0) {
            for (let d = i - 1; d > pi; d--) arr[d] = '';
          }
        }
        if (arr[i + 1] === ' ') {
          let ni = i + 1; while (ni < arr.length && arr[ni] === ' ') ni++;
          const nv = ni < arr.length ? arr[ni] : '';
          if (IS_CN(nv) || IS_ALNUM(nv)) {
            for (let d = i + 1; d < ni; d++) arr[d] = '';
          }
        }
      }
      line = arr.join('');
    }

    // ── §1.2 盘古之白：中文 ↔ 英文/数字/公式(占位符) 之间补半角空格 ──
    line = line.replace(/(?<=[一-鿿㐀-䶿豈-﫿])(?=[A-Za-z0-9])/g, ' ')
               .replace(/(?<=[A-Za-z0-9])(?=[一-鿿㐀-䶿豈-﫿])/g, ' ');

    // ── §2 纯文本 O(…)、5e9、数字*数字 ──
    line = line.replace(/(?<![A-Za-z0-9_$\\])O\(([^()]{1,24})\)/g, (m, cap) => `$\\mathcal{O}(${cap})$`);
    line = line.replace(/(?<![A-Za-z0-9_.$\\])(\d+(?:\.\d+)?)[eE]([+-]?\d+)/g,
      (m, mant, exp) => `$${mant} \\times 10^{${exp}}$`);
    line = line.replace(/(?<![\w*$\\])(\d[0-9,]*\d|\d)\s*\*(?!\*)\s*(\d[0-9,]*\d|\d)(?![\w$])/g,
      (m, a, b) => `$${a} \\times ${b}$`);
    // 新公式可能与中文紧贴，再补一轮盘古
    line = line.replace(/(?<=[一-鿿㐀-䶿豈-﫿])(?=[A-Za-z0-9])/g, ' ')
               .replace(/(?<=[A-Za-z0-9])(?=[一-鿿㐀-䶿豈-﫿])/g, ' ');

    // ── §1.1 句末补充句号（逐行判定，同 lint；硬换行两个空格保留在句号之后）──
    const hm = /^(#{1,6})\s/.test(line);
    if (!hm && trimmed.length >= 4 && !/^\s*[|>]|^\s*<|^:::/.test(line)) {
      const hardBreak = /  $/.test(line);
      const base = line.replace(/[ \t]+$/, '');
      const last = base.slice(-1);
      if (IS_CN(last) || IS_ALNUM(last) || last === ')' || last === '$' || last === '`') {
        line = base + '。' + (hardBreak ? '  ' : '');
      }
    }

    // ── 还原占位符 ──
    line = line.replace(/Z(\d{3})Z/g, (m, n) => (tokens[+n] !== undefined ? tokens[+n] : m));

    // ── §1.1 补充轮：还原后紧邻公式 `$` / 代码 `` ` `` / 右括号的半角标点再换算
    // （如「$x$，中文」的逗号、「$…$.」句末句号、链接后的标点）──
    {
      const HALF2FULL = { ',': '，', '.': '。', ';': '；', ':': '：', '!': '！', '?': '？' };
      const arr = line.split('');
      for (let i = 0; i < arr.length; i++) {
        const ch = arr[i];
        if (!HALF2FULL[ch]) continue;
        const pv = arr[i - 1] || '';
        const nx = arr[i + 1] || '';
        const leftOK = IS_CN(pv) || FULL_PUNCT.indexOf(pv) >= 0 || pv === '$' || pv === '`' || pv === ')' || pv === ']';
        if (!leftOK) continue;
        if (ch === '.') {
          if (!((IS_CN(nx) || nx === '' || nx === ' ')) || IS_ALNUM(pv)) continue;
        } else if (!(IS_CN(nx) || FULL_PUNCT.indexOf(nx) >= 0 || nx === '' || nx === ' ')) continue;
        arr[i] = HALF2FULL[ch];
      }
      line = arr.join('');
    }
    out.push(line + keep);
  }

  return out.join('\n');
}

module.exports = { lintLuoguStyle, autoFixLuoguStyle };
