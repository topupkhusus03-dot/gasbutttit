'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders text that may contain LaTeX expressions.
 * Supports:
 *   - Display math: $$...$$ or \[...\]
 *   - Inline math: $...$ or \(...\)
 *   - Plain HTML (dangerouslySetInnerHTML)
 */
export default function LatexRenderer({ content, className, style }: LatexRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // First set raw HTML content
    ref.current.innerHTML = content;

    // Then find and render all LaTeX inside
    renderLatexInElement(ref.current);
  }, [content]);

  return <div ref={ref} className={className} style={style} />;
}

function renderLatexInElement(element: HTMLElement) {
  // Process text nodes recursively
  processNode(element);
}

function processNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!hasLatex(text)) return;

    const span = document.createElement('span');
    span.innerHTML = renderLatexString(text);
    node.parentNode?.replaceChild(span, node);
    return;
  }

  // Don't process script/style/already-processed nodes
  if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;

  // Process children (clone list to avoid mutation issues)
  const children = Array.from(node.childNodes);
  for (const child of children) {
    processNode(child);
  }
}

function hasLatex(text: string): boolean {
  return /\$/.test(text) || /\\[\[\(]/.test(text);
}

/**
 * Converts a string with LaTeX into HTML with rendered math.
 * Order: display ($$...$$, \[...\]) → inline ($...$, \(...\))
 */
function renderLatexString(text: string): string {
  // $$...$$ display
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span style="color:red">$$${math}$$</span>`;
    }
  });

  // \[...\] display
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span style="color:red">\\[${math}\\]</span>`;
    }
  });

  // $...$ inline  (not preceded by another $)
  text = text.replace(/(?<!\$)\$(?!\$)((?:[^$]|\n)+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span style="color:red">$${math}$</span>`;
    }
  });

  // \(...\) inline
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span style="color:red">\\(${math}\\)</span>`;
    }
  });

  return text;
}
