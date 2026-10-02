/**
 * 轻量且安全的 Markdown 渲染器
 * 防御 XSS，支持标题、加粗、斜体、代码块、行内代码、列表、引用块、链接与换行
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text: string): string {
  let res = text;

  // 1. 行内代码: `code`
  res = res.replace(/`([^`\n]+)`/g, (_m, code) => `<code class="md-inline-code">${code}</code>`);

  // 2. 加粗: **bold** 或 __bold__
  res = res.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // 3. 斜体: *italic* 或 _italic_
  res = res.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  res = res.replace(/(^|\s)_([^_\n]+?)_($|\s)/g, '$1<em>$2</em>$3');

  // 4. 删除线: ~~del~~
  res = res.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 5. 链接: [text](url) - 仅允许 http/https/mailto 协议
  res = res.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

  return res;
}

export function renderMarkdown(raw: string | null | undefined): string {
  if (!raw) return '';

  // 第一步：先对所有字符做严格 HTML 转义，杜绝 XSS
  const escaped = escapeHtml(raw.trim());

  // 第二步：抽取代码块 ```lang ... ``` 占位保存，避免代码内容被后续规则误匹配
  const codeBlocks: string[] = [];
  const withCodePlaceholders = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length;
    const langAttr = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre class="md-code-block"><code${langAttr}>${code.trim()}</code></pre>`);
    return `__CODE_BLOCK_${idx}__`;
  });

  // 第三步：预处理连续行中的内联列表标记（有些模型会把 "- a: 1 - b: 2" 写在同一行）
  // 如果行中存在 " - " 且前面有文字，切分为换行
  const normalizedText = withCodePlaceholders.replace(/([^\n])\s+-\s+/g, '$1\n- ');

  const lines = normalizedText.split(/\r?\n/);
  const output: string[] = [];

  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) {
      output.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      output.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // 占位代码块直接输出
    if (/^__CODE_BLOCK_\d+__$/.test(trimmed)) {
      closeList();
      const idx = parseInt(trimmed.replace('__CODE_BLOCK_', '').replace('__', ''), 10);
      output.push(codeBlocks[idx] ?? '');
      continue;
    }

    // 空行
    if (!trimmed) {
      closeList();
      continue;
    }

    // 标题: # ~ ####
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      closeList();
      const level = headerMatch[1]?.length ?? 1;
      const titleContent = headerMatch[2] ?? '';
      output.push(`<h${level} class="md-h${level}">${renderInline(titleContent)}</h${level}>`);
      continue;
    }

    // 引用块: > text
    const quoteMatch = trimmed.match(/^&gt;\s*(.*)$/);
    if (quoteMatch) {
      closeList();
      output.push(`<blockquote class="md-quote">${renderInline(quoteMatch[1] ?? '')}</blockquote>`);
      continue;
    }

    // 无序列表: - text 或 * text
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        output.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        output.push('<ul class="md-ul">');
        inUl = true;
      }
      output.push(`<li class="md-li">${renderInline(ulMatch[1] ?? '')}</li>`);
      continue;
    }

    // 有序列表: 1. text
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        output.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        output.push('<ol class="md-ol">');
        inOl = true;
      }
      output.push(`<li class="md-li">${renderInline(olMatch[2] ?? '')}</li>`);
      continue;
    }

    // 普通段落行
    closeList();
    output.push(`<p class="md-p">${renderInline(trimmed)}</p>`);
  }

  closeList();

  return output.join('');
}
