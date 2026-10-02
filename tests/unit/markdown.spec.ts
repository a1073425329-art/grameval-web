import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@/utils/markdown';

describe('renderMarkdown', () => {
  it('应当正确处理空或 null 输入', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });

  it('应当正确转义 HTML 避免 XSS', () => {
    const raw = '<script>alert("xss")</script> & <b>test</b>';
    const result = renderMarkdown(raw);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&amp;');
  });

  it('应当正确渲染标题、加粗和列表（匹配用户截图场景）', () => {
    const raw = `## 1 + 1 = **2**
在英语中，数字 **2** 可以这样表达：
- **two**: 二
- 例句: **One plus one equals two.**
意思是：一加一等于二。`;

    const result = renderMarkdown(raw);
    expect(result).toContain('<h2 class="md-h2">1 + 1 = <strong>2</strong></h2>');
    expect(result).toContain('<strong>two</strong>');
    expect(result).toContain('<ul class="md-ul">');
    expect(result).toContain('<li class="md-li"><strong>two</strong>: 二</li>');
    expect(result).toContain('<strong>One plus one equals two.</strong>');
  });

  it('应当支持同一行内连续列出的列表标记', () => {
    const raw = '关于你的问题： - **one**: 一 - **two**: 二';
    const result = renderMarkdown(raw);
    expect(result).toContain('<li class="md-li"><strong>one</strong>: 一</li>');
    expect(result).toContain('<li class="md-li"><strong>two</strong>: 二</li>');
  });

  it('应当正确解析代码块与行内代码', () => {
    const raw = '这是 `inline code`。\n```ts\nconst a: number = 1;\n```';
    const result = renderMarkdown(raw);
    expect(result).toContain('<code class="md-inline-code">inline code</code>');
    expect(result).toContain('<pre class="md-code-block"><code class="language-ts">const a: number = 1;</code></pre>');
  });

  it('应当正确解析有序列表和引用块', () => {
    const raw = '> 提示：这是语法提示\n1. 第一步\n2. 第二步';
    const result = renderMarkdown(raw);
    expect(result).toContain('<blockquote class="md-quote">提示：这是语法提示</blockquote>');
    expect(result).toContain('<ol class="md-ol">');
    expect(result).toContain('<li class="md-li">第一步</li>');
    expect(result).toContain('<li class="md-li">第二步</li>');
  });
});
