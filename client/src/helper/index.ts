export const compileMarkdown = (md = '') => {
  if (!md) return '';

  // Escape HTML to prevent XSS
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*?)$/gm, '<h3 class="preview-h3">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 class="preview-h2">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 class="preview-h1">$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Checkbox lists
  html = html.replace(/^\s*-\s+\[ \]\s+(.*?)$/gm, '<li class="preview-li-checkbox"><input type="checkbox" disabled /> $1</li>');
  html = html.replace(/^\s*-\s+\[[xX]\]\s+(.*?)$/gm, '<li class="preview-li-checkbox"><input type="checkbox" checked disabled /> $1</li>');

  // Regular bullet lists
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');

  // Inline Code & Code Blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="preview-pre"><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code class="preview-code">$1</code>');

  // Linebreaks (only outside lists and code blocks to avoid extra breaks)
  html = html.replace(/\n/g, '<br />');

  return html;
};