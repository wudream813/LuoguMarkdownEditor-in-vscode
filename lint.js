/**
 * Luogu Markdown 语法检查（v1.1.1）
 *
 * 纯 Node 模块（无 vscode 依赖），供 extension.js 的诊断引擎调用。
 * 规则镜像 media/luogu-parser.js 的真实解析语义（容器按「同冒号数纯冒号行」
 * 顺序闭合、围栏按「同字符且长度≥起始且无信息串」闭合），但 parser 本身被设计为
 * 永不报错（宽容吞掉一切），所以结构性错误只能在 lint 层提示。
 *
 * 返回 [{ line, severity: 'error'|'warning', message }]
 */
'use strict';

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const CONTAINER_OPEN_RE = /^(:{3,})([a-zA-Z0-9_\-]+)(?:\[(.*?)\])?(?:\{(.*)\})?\s*$/;
const COLON_CLOSE_RE = /^(:{3,})\s*$/;
const LOOKS_LIKE_CONTAINER_RE = /^:{3,}[a-zA-Z0-9_\-]/;
const BILIBILI_IMG_RE = /!\[[^\]]*\]\(\s*bilibili:\s*([^)\s]*)\s*\)/g;
const BV_RE = /^[Bb][Vv][0-9A-Za-z]{10}$/;
const AV_RE = /^([Aa][Vv])?\d+$/;

function lintLuoguMarkdown(text) {
  const issues = [];
  const lines = String(text).split(/\r?\n/);

  let fence = null;          // { char, len, line } — 当前所在代码围栏
  const containers = [];     // [{ len, type, line }] — 打开的容器栈
  let mathBlockLine = -1;    // 未闭合的 $$ 所在行（-1 = 不在行间公式内）

  const err = (line, message) => issues.push({ line, severity: 'error', message });
  const warn = (line, message) => issues.push({ line, severity: 'warning', message });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── 围栏内：只关心收口 ──
    if (fence) {
      const m = line.match(FENCE_RE);
      if (m && m[1][0] === fence.char && m[1].length >= fence.len) {
        if (m[2].trim() === '') {
          fence = null; // 正常闭合
        } else {
          // ```cpp 在围栏内不会闭合（parser 把它当内容吞掉），几乎总是用户笔误
          warn(i, `代码块结束围栏应为纯 ${fence.char.repeat(fence.len)}（当前带信息串，不会闭合，下方内容会被吞入代码块）`);
          // parser 语义：该行只是内容，围栏保持打开 —— 镜像之
        }
      }
      continue;
    }

    // ── 围栏开启 ──
    const fm = line.match(FENCE_RE);
    if (fm) {
      fence = { char: fm[1][0], len: fm[1].length, line: i };
      continue;
    }

    // ── 行间公式 $$ 状态机 ──
    const noEsc = line.replace(/\\\$/g, '');
    const ddCount = (noEsc.match(/\$\$/g) || []).length;
    if (mathBlockLine >= 0) {
      if (ddCount % 2 === 1) mathBlockLine = -1; // 闭合
      continue; // 公式内部不做其它检查
    }
    if (ddCount % 2 === 1) {
      mathBlockLine = i; // 进入行间公式
      continue;
    }

    // ── 容器块 ──
    const co = line.match(CONTAINER_OPEN_RE);
    if (co) {
      containers.push({ len: co[1].length, type: co[2], line: i });
      continue;
    }
    const cc = line.match(COLON_CLOSE_RE);
    if (cc) {
      const len = cc[1].length;
      let idx = -1;
      for (let k = containers.length - 1; k >= 0; k--) {
        if (containers[k].len === len) { idx = k; break; }
      }
      if (idx >= 0) {
        containers.splice(idx, 1); // 镜像 parser：闭合最近的同冒号数容器
      } else if (containers.length > 0) {
        const top = containers[containers.length - 1];
        warn(i, `容器结束标记（${len} 个冒号）与第 ${top.line + 1} 行打开的「${top.type}」（${top.len} 个冒号）不匹配，该容器可能一直吞到文末`);
      } else {
        err(i, '多余的容器结束标记：没有正在打开的容器块');
      }
      continue;
    }
    if (LOOKS_LIKE_CONTAINER_RE.test(line)) {
      // 形如容器但完整语法不匹配（最常见：标题方括号 [ 没闭合）
      warn(i, '容器标记格式不完整（形如 :::type[标题]{open}，疑似缺少 ] 或 }），此行将按普通文本渲染');
      continue;
    }

    // ── Bilibili 视频 ID ──
    BILIBILI_IMG_RE.lastIndex = 0;
    let bm;
    while ((bm = BILIBILI_IMG_RE.exec(line)) !== null) {
      const spec = (bm[1] || '').split('?')[0];
      if (!spec) {
        err(i, 'Bilibili 视频缺少 ID：应为 ![](bilibili:BVxxxx) 或 ![](bilibili:av123456)');
      } else if (!BV_RE.test(spec) && !AV_RE.test(spec)) {
        warn(i, `Bilibili 视频 ID「${spec}」格式可疑：BV 号为 BV+10 位字符，av 号为 av+数字`);
      }
    }

    // ── 行内公式 $ 配对（排除行内代码与成对的 $$…$$）──
    const stripped = noEsc
      .replace(/`[^`]*`/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '');
    if (stripped.includes('$')) {
      const singleCount = (stripped.match(/\$/g) || []).length;
      if (singleCount % 2 === 1) {
        warn(i, '行内公式 $ 未配对（该行含有奇数个 $），公式可能无法渲染');
      }
    }
  }

  // ── EOF 收口 ──
  if (fence) {
    err(fence.line, '代码块围栏未闭合：以下内容都会被当作代码渲染');
  }
  if (mathBlockLine >= 0) {
    err(mathBlockLine, '行间公式 $$ 未闭合：以下内容都会被当作公式处理');
  }
  for (const c of containers) {
    err(c.line, `容器块「${c.type}」未闭合：缺少对应的 ${c.len} 个冒号的结束行，以下内容都会被吞入该容器`);
  }

  issues.sort((a, b) => a.line - b.line);
  return issues;
}

module.exports = { lintLuoguMarkdown };
