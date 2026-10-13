/**
 * Normalizes assistant text for natural, safe speech synthesis without mutating
 * canonical persisted responses.
 *
 * Rules:
 * 1. Fenced code blocks (```...```) are replaced with speech-friendly placeholder:
 *    "I have provided a code example on screen."
 * 2. Inline code backticks (`...`) are stripped to leave speakable content.
 * 3. Markdown emphasis (**bold**, *italic*, __bold__, _italic_, ~~strike~~) is stripped.
 * 4. Markdown headers (#, ##, etc.), list bullets (*, -, +), and blockquotes (>) are stripped.
 * 5. Markdown links [text](url) become "text".
 * 6. Excessive whitespace and blank lines are collapsed.
 * 7. International text (Thai, English) and numbers (e.g. 3.14) are preserved without distortion.
 */
export function normalizeTextForSpeech(text: string): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  let normalized = text;

  // 1. Replace fenced code blocks
  normalized = normalized.replace(/```[a-zA-Z0-9_-]*\n?[\s\S]*?```/g, () => {
    return "I have provided a code example on screen.";
  });

  // 2. Strip inline code backticks
  normalized = normalized.replace(/`([^`]+)`/g, '$1');

  // 3. Strip bold & italic markers
  normalized = normalized.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  normalized = normalized.replace(/\*\*([^*]+)\*\*/g, '$1');
  normalized = normalized.replace(/\*([^*]+)\*/g, '$1');
  normalized = normalized.replace(/___([^_]+)___/g, '$1');
  normalized = normalized.replace(/__([^_]+)__/g, '$1');
  normalized = normalized.replace(/_([^_]+)_/g, '$1');
  normalized = normalized.replace(/~~([^~]+)~~/g, '$1');

  // 4. Strip markdown links [label](url) -> label
  normalized = normalized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 5. Strip heading markers at start of line
  normalized = normalized.replace(/^[ \t]*#{1,6}\s+/gm, '');

  // 6. Strip bullet list markers at start of line
  normalized = normalized.replace(/^[ \t]*[\*\-\+]\s+/gm, '');

  // 7. Strip numbered list markers at start of line (e.g., "1. ")
  normalized = normalized.replace(/^[ \t]*\d+\.\s+/gm, '');

  // 8. Strip blockquote markers at start of line
  normalized = normalized.replace(/^[ \t]*>\s+/gm, '');

  // 9. Collapse multiple horizontal spaces/tabs to single space
  normalized = normalized.replace(/[ \t]+/g, ' ');

  // 10. Collapse 3+ newlines to 2 newlines
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized.trim();
}
