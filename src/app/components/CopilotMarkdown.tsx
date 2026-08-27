/**
 * Turns the AI Copilot's Markdown-ish replies into real formatting instead of
 * showing literal ** and ### characters. Used by the AI Copilot module.
 */
import React from "react";

function renderCopilotInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${idx}`} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={`${keyPrefix}-${idx}`} className="px-1 py-0.5 rounded bg-black/20 font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function CopilotMessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer.map(r => r.trim()).filter(r => r.includes("|"));
    tableBuffer = [];
    if (rows.length < 2) return;
    const cells = (r: string) =>
      r.split("|").map(c => c.trim()).filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));
    const header = cells(rows[0]);
    const body = rows.slice(1).filter(r => !/^[\s|:-]+$/.test(r)).map(cells);
    if (header.length === 0 || body.length === 0) return;
    elements.push(
      <div key={key} className="my-2 overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="w-full text-left text-xs border-collapse min-w-[420px]">
          <thead className="bg-white/[0.04]">
            <tr>{header.map((h, i) => <th key={i} className="py-1.5 px-2.5 font-semibold text-[#e2e8f7] whitespace-nowrap">{renderCopilotInline(h, `th-${i}`)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {body.map((row, ri) => (
              <tr key={ri}>{row.map((c, ci) => <td key={ci} className="py-1.5 px-2.5 text-[#c5d0ea] whitespace-nowrap">{renderCopilotInline(c, `td-${ri}-${ci}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableBuffer.push(line);
      return;
    }
    flushTable(`table-${index}`);

    if (/^#{1,4}\s/.test(trimmed)) {
      const text = trimmed.replace(/^#{1,4}\s/, "");
      elements.push(<p key={index} className="text-[13px] font-bold text-white mt-2 mb-0.5">{renderCopilotInline(text, `h-${index}`)}</p>);
    } else if (/^([-*•]|\d+\.)\s/.test(trimmed)) {
      const bulletText = trimmed.replace(/^([-*•]|\d+\.)\s/, "");
      elements.push(
        <div key={index} className="flex items-start gap-1.5 my-0.5 ml-0.5">
          <span className="text-indigo-400 mt-0.5 text-[10px]">&bull;</span>
          <span className="flex-1 leading-relaxed">{renderCopilotInline(bulletText, `li-${index}`)}</span>
        </div>
      );
    } else if (trimmed.length > 0) {
      elements.push(<p key={index} className="leading-relaxed my-0.5">{renderCopilotInline(trimmed, `p-${index}`)}</p>);
    }
  });

  flushTable("table-end");
  return <div className="text-[15px] font-['Plus_Jakarta_Sans'] text-[#e2e8f7]">{elements}</div>;
}
