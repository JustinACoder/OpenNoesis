"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedElements = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

interface DebateMarkdownProps {
  children: string;
}

export function DebateMarkdown({ children }: DebateMarkdownProps) {
  return (
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      allowedElements={allowedElements}
      unwrapDisallowed
      urlTransform={(url) => defaultUrlTransform(url)}
      components={{
        p: ({ children }) => (
          <p className="break-words leading-7 text-muted-foreground text-pretty">
            {children}
          </p>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-xl border border-border/60 bg-secondary/45 px-4 py-3 text-sm leading-6 text-foreground">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const codeText = Array.isArray(children) ? children.join("") : String(children);
          const isBlock = Boolean(className) || codeText.includes("\n");

          if (isBlock) {
            return <code className={className}>{children}</code>;
          }

          return (
            <code className="break-words rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              {children}
            </code>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
        a: ({ href, children }) => {
          const isExternal = Boolean(href?.startsWith("http://") || href?.startsWith("https://"));

          return (
            <a
              href={href}
              className="break-words font-medium text-primary underline underline-offset-4"
              rel={isExternal ? "noopener noreferrer nofollow" : undefined}
              target={isExternal ? "_blank" : undefined}
            >
              {children}
            </a>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="min-w-full border-collapse text-sm text-muted-foreground">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-secondary/45">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-t border-border/60">{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-foreground">{children}</th>
        ),
        td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
        ul: ({ children }) => (
          <ul className="list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal space-y-2 pl-5 leading-7 text-muted-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="break-words pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="break-words border-l-2 border-border/80 pl-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
