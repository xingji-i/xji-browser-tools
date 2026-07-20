/**
 * AutoTranslate - 智能内容提取器
 * 从网页中提取主要内容段落，支持文章、博客、新闻、PDF等场景
 */

window.AutoTranslate = window.AutoTranslate || {};

window.AutoTranslate.Extractor = (function() {
  'use strict';

  // 需要忽略的标签
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS',
    'NAV', 'FOOTER', 'HEADER', 'ASIDE',
    'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM'
  ]);

  // 负面 class/id 关键词（通常是广告、导航、侧边栏等）
  const NEGATIVE_PATTERNS = /nav|menu|sidebar|widget|ad[s\-_]?|banner|footer|header|comment|social|share|related|recommend|breadcrumb|pagination|cookie|popup|modal|overlay/i;

  // 正面 class/id 关键词（通常是文章内容区域）
  const POSITIVE_PATTERNS = /article|post|content|entry|story|body|text|blog|page|main|reading|prose/i;

  /**
   * 检查元素是否应该被忽略
   */
  function shouldSkipElement(el) {
    if (SKIP_TAGS.has(el.tagName)) return true;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    if (style.opacity === '0') return true;

    // 检查 offsetParent，不可见元素跳过
    if (el.offsetParent === null && el.tagName !== 'BODY') return true;

    const className = el.className || '';
    const id = el.id || '';
    const combined = className + ' ' + id;

    // 负面模式匹配（但正面模式优先级更高）
    if (NEGATIVE_PATTERNS.test(combined) && !POSITIVE_PATTERNS.test(combined)) {
      return true;
    }

    return false;
  }

  /**
   * 获取元素的文本内容（清理过的）
   */
  function getCleanText(el) {
    // clone 节点以避免修改原 DOM
    const clone = el.cloneNode(true);
    // 移除子级中的脚本和样式
    clone.querySelectorAll('script, style, noscript').forEach(n => n.remove());
    let text = clone.textContent || clone.innerText || '';
    // 合并多个空白为单个空格
    text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return text;
  }

  /**
   * 对候选容器评分，找出最佳内容区域
   */
  function findContentRoot() {
    const candidates = document.querySelectorAll(
      'article, main, [role="main"], section, div'
    );

    let bestRoot = document.body;
    let bestScore = 0;

    candidates.forEach(el => {
      if (shouldSkipElement(el)) return;

      const text = getCleanText(el);
      if (text.length < 200) return;

      let score = 0;

      // 语义标签加分
      if (el.tagName === 'ARTICLE') score += 80;
      else if (el.tagName === 'MAIN') score += 60;
      else if (el.getAttribute('role') === 'main') score += 50;

      // class/id 正面模式加分
      const combined = (el.className || '') + ' ' + (el.id || '');
      if (POSITIVE_PATTERNS.test(combined)) score += 40;
      if (NEGATIVE_PATTERNS.test(combined)) score -= 30;

      // 段落数量加分
      const paragraphs = el.querySelectorAll('p');
      score += Math.min(paragraphs.length * 8, 80);

      // 文本长度加分（但有上限）
      score += Math.min(text.length / 50, 40);

      // 文本密度（相对于元素大小的文本量）
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const density = text.length / (rect.width * rect.height / 10000);
        score += Math.min(density * 5, 20);
      }

      // 链接密度惩罚（导航区域链接密度高）
      const links = el.querySelectorAll('a');
      let linkTextLen = 0;
      links.forEach(a => { linkTextLen += (a.textContent || '').length; });
      if (text.length > 0) {
        const linkDensity = linkTextLen / text.length;
        if (linkDensity > 0.5) score -= 40;
        else if (linkDensity > 0.3) score -= 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestRoot = el;
      }
    });

    return bestRoot;
  }

  /**
   * 从指定根元素中提取内容块
   */
  function extractFromRoot(root) {
    const blocks = [];
    let blockIndex = 0;

    function walk(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      if (shouldSkipElement(node)) return;

      const tag = node.tagName;

      // 处理标题
      if (/^H[1-6]$/.test(tag)) {
        const text = getCleanText(node);
        if (text.length >= 2) {
          blocks.push({
            id: 'block-' + (blockIndex++),
            text: text,
            html: node.innerHTML.trim(),
            element: node,
            type: 'heading',
            level: parseInt(tag[1])
          });
        }
        return; // 标题内部不再遍历
      }

      // 处理段落
      if (tag === 'P') {
        const text = getCleanText(node);
        if (text.length >= 8) {
          blocks.push({
            id: 'block-' + (blockIndex++),
            text: text,
            html: node.innerHTML.trim(),
            element: node,
            type: 'paragraph'
          });
        }
        return;
      }

      // 处理列表
      if (tag === 'LI') {
        const text = getCleanText(node);
        if (text.length >= 8) {
          blocks.push({
            id: 'block-' + (blockIndex++),
            text: text,
            html: node.innerHTML.trim(),
            element: node,
            type: 'list-item'
          });
        }
        return;
      }

      // 处理 blockquote
      if (tag === 'BLOCKQUOTE') {
        const text = getCleanText(node);
        if (text.length >= 10) {
          blocks.push({
            id: 'block-' + (blockIndex++),
            text: text,
            html: node.innerHTML.trim(),
            element: node,
            type: 'quote'
          });
        }
        return;
      }

      // 处理 pre > code（代码块）
      if (tag === 'PRE') {
        const text = getCleanText(node);
        if (text.length >= 10) {
          blocks.push({
            id: 'block-' + (blockIndex++),
            text: text,
            html: node.innerHTML.trim(),
            element: node,
            type: 'code-block'
          });
        }
        return;
      }

      // 递归子元素
      for (const child of node.children) {
        walk(child);
      }
    }

    walk(root);
    return blocks;
  }

  /**
   * 合并相邻的短段落（避免过多碎片）
   */
  function mergeBlocks(blocks) {
    const merged = [];
    let i = 0;

    while (i < blocks.length) {
      const block = blocks[i];

      // 标题和代码块不合并
      if (block.type === 'heading' || block.type === 'code-block') {
        merged.push(block);
        i++;
        continue;
      }

      // 合并相邻的短列表项
      if (block.type === 'list-item') {
        const group = [block];
        while (i + 1 < blocks.length && blocks[i + 1].type === 'list-item' && group.length < 5) {
          i++;
          group.push(blocks[i]);
        }
        if (group.length > 1) {
          merged.push({
            id: group[0].id,
            text: group.map(b => b.text).join('\n'),
            html: group.map(b => b.html).join('<br>'),
            element: group[0].element,
            type: 'list-group',
            children: group
          });
        } else {
          merged.push(block);
        }
        i++;
        continue;
      }

      merged.push(block);
      i++;
    }

    return merged;
  }

  /**
   * 检测页面内容的主要语言
   */
  function detectPageLanguage(blocks) {
    const sampleText = blocks.slice(0, 10).map(b => b.text).join('');
    const chineseChars = (sampleText.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const totalAlpha = (sampleText.match(/[a-zA-Z\u4e00-\u9fff\u3400-\u4dbf\u0400-\u04ff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;

    if (totalAlpha === 0) return 'unknown';
    const ratio = chineseChars / totalAlpha;
    if (ratio > 0.3) return 'ZH';
    if (ratio < 0.05) return 'EN';
    return 'unknown';
  }

  /**
   * 提取页面元信息
   */
  function getPageMetadata() {
    const title = document.title || '';
    const lang = document.documentElement.lang || '';
    const charset = document.characterSet || 'UTF-8';

    return {
      title: title.trim(),
      lang: lang.toLowerCase(),
      charset: charset,
      url: window.location.href
    };
  }

  /**
   * 主入口：提取页面内容
   */
  function extract() {
    const metadata = getPageMetadata();
    const root = findContentRoot();
    let blocks = extractFromRoot(root);
    blocks = mergeBlocks(blocks);

    const detectedLang = detectPageLanguage(blocks);

    return {
      metadata: metadata,
      blocks: blocks,
      detectedLang: detectedLang,
      contentRoot: root,
      totalCount: blocks.length,
      totalChars: blocks.reduce((sum, b) => sum + b.text.length, 0)
    };
  }

  return {
    extract: extract,
    detectPageLanguage: detectPageLanguage,
    getCleanText: getCleanText
  };
})();
