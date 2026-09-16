export type DiscordEventCandidate = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  category: "仕事" | "生活" | "予定";
  notes: string;
  sourceLine: string;
  confidence: "high" | "medium" | "low";
};

const MONTH_DAY = /(?<!\d)(\d{1,2})[月\/]\s*(\d{1,2})\s*(?:日)?/;
const TIME = /(\d{1,2})[:時](\d{2})?\s*(?:[〜~\-]\s*(\d{1,2})[:時](\d{2})?)?/;
const YEAR_MONTH = /(20\d{2})年\s*(\d{1,2})月/;

function pad(value: number) { return String(value).padStart(2, "0"); }

export function parseDiscordEventList(text: string, referenceDate = new Date()): DiscordEventCandidate[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let year = referenceDate.getFullYear();
  let monthHint: number | null = null;
  const output: DiscordEventCandidate[] = [];

  for (const original of lines) {
    const line = original.replace(/^[\s>*⭐🌟🔵🟡🟠⚪️]+/, "").trim();
    const heading = line.match(YEAR_MONTH);
    if (heading) { year = Number(heading[1]); monthHint = Number(heading[2]); continue; }
    if (/^【[^】]+】$/.test(line) || /^[-ー]+(?:\s*\(編集済\))?$/.test(line)) continue;

    const dateMatch = line.match(MONTH_DAY);
    if (!dateMatch) continue;
    const month = Number(dateMatch[1]) || monthHint;
    const day = Number(dateMatch[2]);
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const timeMatch = line.match(TIME);
    const startTime = timeMatch ? `${pad(Number(timeMatch[1]))}:${pad(Number(timeMatch[2] ?? 0))}` : "";
    const endTime = timeMatch?.[3] ? `${pad(Number(timeMatch[3]))}:${pad(Number(timeMatch[4] ?? 0))}` : "";
    const title = line
      .replace(MONTH_DAY, "")
      .replace(TIME, "")
      .replace(/^[（(]?\s*[月火水木金土日](?:曜|曜日)?\s*[）)]?\s*/, "")
      .replace(/^\s*[()（）]?[^\p{L}\p{N}]*[)）]?\s*/u, "")
      .replace(/^[〜~\-–—]\s*/, "")
      .replace(/^[-–—〜~]\s*/, "")
      .trim();
    if (!title) continue;
    const category = /オンライン|Zoom|配信/i.test(title) ? "予定" : "仕事";
    const confidence = timeMatch ? "high" : "medium";
    output.push({
      title,
      date: `${year}-${pad(month)}-${pad(day)}`,
      startTime,
      endTime,
      category,
      notes: `Discord一覧からの候補\n元の行: ${original}`,
      sourceLine: original,
      confidence,
    });
  }
  return output;
}
