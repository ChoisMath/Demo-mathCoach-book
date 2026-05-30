"use client";

import React from "react";
import katex from "katex";

interface MathViewProps {
  text: string;
}

export const MathView: React.FC<MathViewProps> = ({ text }) => {
  if (!text) return null;

  // Split text by $$ (block math) and $ (inline math)
  // The regex matches:
  // 1. $$ ... $$ (block math)
  // 2. $ ... $ (inline math) - non-greedy to avoid matching across normal text
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$(?!\$)[\s\S]*?\$)/g);

  return (
    <span className="leading-relaxed whitespace-pre-wrap text-slate-800">
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const formula = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(formula, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: html }}
                className="block my-4 overflow-x-auto py-2 px-4 bg-slate-50/50 rounded-lg border border-slate-100"
              />
            );
          } catch (e) {
            return (
              <code key={index} className="text-red-500 bg-red-50 px-1 rounded">
                {part}
              </code>
            );
          }
        } else if (part.startsWith("$") && part.endsWith("$")) {
          const formula = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(formula, {
              displayMode: false,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: html }}
                className="inline-block mx-1 overflow-x-auto align-middle"
              />
            );
          } catch (e) {
            return (
              <code key={index} className="text-red-500 bg-red-50 px-1 rounded">
                {part}
              </code>
            );
          }
        } else {
          // Standard text part, parse basic markdown elements
          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: parseBasicMarkdown(part) }}
            />
          );
        }
      })}
    </span>
  );
};

function parseBasicMarkdown(txt: string): string {
  // Escape HTML to prevent XSS while we render custom tags
  let escaped = txt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text**
  escaped = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  
  // Bullet items line by line
  const lines = escaped.split("\n");
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      return `<li class="list-disc ml-6 my-1 text-slate-700">${trimmed.substring(2)}</li>`;
    }
    if (trimmed.startsWith("* ")) {
      return `<li class="list-disc ml-6 my-1 text-slate-700">${trimmed.substring(2)}</li>`;
    }
    // Numbered lists: "1. ", "2. ", etc.
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      return `<li class="list-decimal ml-6 my-1 text-slate-700" value="${numberedMatch[1]}">${numberedMatch[2]}</li>`;
    }
    return line;
  });

  return processedLines.join("\n");
}
