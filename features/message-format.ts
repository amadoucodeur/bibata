export interface MessageTextPart {
  text: string;
  bold: boolean;
}

export function parseMessageText(value: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;

  for (const match of value.matchAll(boldPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: value.slice(cursor, index).replaceAll("**", ""), bold: false });
    parts.push({ text: match[1], bold: true });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) parts.push({ text: value.slice(cursor).replaceAll("**", ""), bold: false });
  return parts.length ? parts : [{ text: value.replaceAll("**", ""), bold: false }];
}
