import React, { useMemo } from 'react';
import { marked, type Token, type Tokens } from 'marked';

export interface MaveMarkdownRendererProps {
  markdown: string;
  onOpenLink?: (url: string) => void;
  className?: string;
}

/**
 * Validates whether a URL has a safe web scheme (http: or https:).
 * Rejects javascript:, file:, data:, and custom dangerous schemes.
 */
export function isSafeWebUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * MaveMarkdownRenderer
 *
 * Production, sanitized, streaming-resilient Markdown renderer.
 * Maps marked tokens directly to pure React elements with zero dangerouslySetInnerHTML usage.
 * 
 * Security Invariants:
 * 1. Raw HTML in assistant markdown is never executed; it is escaped as literal text nodes.
 * 2. Unsafe URL schemes (javascript:, file:, data:) are disarmed into inert text.
 * 3. Safe links emit the onOpenLink callback, routing to Electron shell.openExternal().
 * 4. Image tokens render as accessible textual captions, preventing remote tracking pixels.
 */
export const MaveMarkdownRenderer: React.FC<MaveMarkdownRendererProps> = ({
  markdown,
  onOpenLink,
  className = ''
}) => {
  const tokens = useMemo(() => {
    if (!markdown) return [];
    try {
      return marked.lexer(markdown);
    } catch {
      return [];
    }
  }, [markdown]);

  const renderInline = (inlineTokens?: Token[]): React.ReactNode => {
    if (!inlineTokens || inlineTokens.length === 0) return null;

    return inlineTokens.map((token, idx) => {
      const key = `inline-${idx}-${token.type}`;

      switch (token.type) {
        case 'text':
          return (token as Tokens.Text).text;

        case 'strong':
          return (
            <strong key={key} className="mave-md-strong">
              {renderInline((token as Tokens.Strong).tokens)}
            </strong>
          );

        case 'em':
          return (
            <em key={key} className="mave-md-em">
              {renderInline((token as Tokens.Em).tokens)}
            </em>
          );

        case 'codespan':
          return (
            <code key={key} className="mave-md-codespan">
              {(token as Tokens.Codespan).text}
            </code>
          );

        case 'del':
          return (
            <del key={key} className="mave-md-del">
              {renderInline((token as Tokens.Del).tokens)}
            </del>
          );

        case 'link': {
          const linkToken = token as Tokens.Link;
          const isSafe = isSafeWebUrl(linkToken.href);

          if (!isSafe) {
            return (
              <span
                key={key}
                className="mave-md-link-disabled"
                title="Untrusted link disarmed"
              >
                {renderInline(linkToken.tokens)}
              </span>
            );
          }

          return (
            <a
              key={key}
              href={linkToken.href}
              className="mave-md-link"
              title={linkToken.title || linkToken.href}
              onClick={(e) => {
                e.preventDefault();
                onOpenLink?.(linkToken.href);
              }}
            >
              {renderInline(linkToken.tokens)}
            </a>
          );
        }

        case 'image': {
          const imgToken = token as Tokens.Image;
          return (
            <span key={key} className="mave-md-image-caption">
              [{imgToken.text || imgToken.title || 'Image'}]
            </span>
          );
        }

        case 'br':
          return <br key={key} />;

        case 'escape':
          return (token as Tokens.Escape).text;

        default:
          return 'raw' in token ? (token as any).raw : null;
      }
    });
  };

  const renderBlock = (token: Token, index: number): React.ReactNode => {
    const key = `block-${index}-${token.type}`;

    switch (token.type) {
      case 'space':
        return null;

      case 'paragraph': {
        const pToken = token as Tokens.Paragraph;
        return (
          <p key={key} className="mave-md-p">
            {renderInline(pToken.tokens)}
          </p>
        );
      }

      case 'heading': {
        const hToken = token as Tokens.Heading;
        const HeadingTag = `h${Math.min(Math.max(hToken.depth, 1), 6)}` as keyof JSX.IntrinsicElements;
        return (
          <HeadingTag key={key} className={`mave-md-heading mave-md-h${hToken.depth}`}>
            {renderInline(hToken.tokens)}
          </HeadingTag>
        );
      }

      case 'code': {
        const codeToken = token as Tokens.Code;
        return (
          <div key={key} className="mave-md-code-block" data-testid="mave-code-block">
            {codeToken.lang && (
              <div className="mave-md-code-header">
                <span className="mave-md-code-lang">{codeToken.lang}</span>
              </div>
            )}
            <pre className="mave-md-code-pre">
              <code className="mave-md-code-text">{codeToken.text}</code>
            </pre>
          </div>
        );
      }

      case 'table': {
        const tableToken = token as Tokens.Table;
        return (
          <div key={key} className="mave-md-table-wrapper" data-testid="mave-table-wrapper">
            <table className="mave-md-table">
              <thead>
                <tr>
                  {tableToken.header.map((cell, cIdx) => (
                    <th
                      key={`th-${cIdx}`}
                      style={{ textAlign: (tableToken.align[cIdx] as any) || 'left' }}
                    >
                      {renderInline(cell.tokens)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableToken.rows.map((row, rIdx) => (
                  <tr key={`tr-${rIdx}`}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={`td-${rIdx}-${cIdx}`}
                        style={{ textAlign: (tableToken.align[cIdx] as any) || 'left' }}
                      >
                        {renderInline(cell.tokens)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'list': {
        const listToken = token as Tokens.List;
        const ListTag = listToken.ordered ? 'ol' : 'ul';
        return (
          <ListTag
            key={key}
            start={listToken.ordered && typeof listToken.start === 'number' ? listToken.start : undefined}
            className={`mave-md-list ${listToken.ordered ? 'mave-md-ol' : 'mave-md-ul'}`}
          >
            {listToken.items.map((item, iIdx) => (
              <li key={`li-${iIdx}`} className="mave-md-li">
                {renderInline(item.tokens)}
              </li>
            ))}
          </ListTag>
        );
      }

      case 'blockquote': {
        const bqToken = token as Tokens.Blockquote;
        return (
          <blockquote key={key} className="mave-md-blockquote">
            {bqToken.tokens ? bqToken.tokens.map((t, i) => renderBlock(t, i)) : bqToken.text}
          </blockquote>
        );
      }

      case 'hr':
        return <hr key={key} className="mave-md-hr" />;

      case 'html': {
        // Strict security: Never evaluate HTML. Render as safe literal text.
        const htmlToken = token as Tokens.HTML;
        return (
          <div key={key} className="mave-md-escaped-html">
            {htmlToken.text}
          </div>
        );
      }

      default:
        return 'text' in token ? (
          <p key={key} className="mave-md-p">
            {(token as any).text}
          </p>
        ) : null;
    }
  };

  return (
    <div
      className={`mave-markdown-content ${className}`.trim()}
      data-testid="mave-markdown-content"
    >
      {tokens.map((token, idx) => renderBlock(token, idx))}
    </div>
  );
};
