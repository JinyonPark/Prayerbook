export type PrayerSentence = {
  id: string;
  text: string;
  empty: boolean;
};

export type PrayerSection = {
  id: string;
  sectionNumber: string | null;
  sentences: PrayerSentence[];
};

function canUseSegmenter(): boolean {
  return typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";
}

function splitBySegmenter(text: string): string[] {
  const segmenter = new Intl.Segmenter("ko", { granularity: "sentence" });
  return [...segmenter.segment(text)].map((part) => part.segment);
}

function splitByPunctuation(text: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    buffer += char;
    const isEnd = /[.!?。！？]/.test(char);
    if (!isEnd) continue;
    if (char === "." && /\d$/.test(buffer.slice(0, -1)) && /^\d/.test(text[index + 1] ?? "")) continue;
    if (char === "." && text[index + 1] === ".") continue;
    let rest = index + 1;
    while (rest < text.length && /[)'"”’\s]/.test(text[rest] ?? "")) {
      buffer += text[rest];
      rest += 1;
    }
    index = rest - 1;
    parts.push(buffer);
    buffer = "";
  }
  if (buffer) parts.push(buffer);
  return parts.length > 0 ? parts : [text];
}

export function splitSentences(text: string): string[] {
  if (!text) return [];
  const source = text.replace(/\r\n/g, "\n");
  const chunks = canUseSegmenter() ? splitBySegmenter(source) : splitByPunctuation(source);
  return chunks.length > 0 ? chunks : [source];
}

export function parsePrayerSections(markdown: string, prayerId: string): PrayerSection[] {
  const source = markdown.replace(/\r\n/g, "\n");
  const texts = splitSentences(source);
  const sections: PrayerSection[] = [];
  let current: PrayerSection | null = null;

  for (const text of texts) {
    const trimmedStart = text.trimStart();
    const sectionMatch = trimmedStart.match(/^(\d+(?:-\d+)?)\)\s*/);
    if (sectionMatch) {
      current = {
        id: `prayer-${prayerId}-section-${sectionMatch[1]}`,
        sectionNumber: sectionMatch[1],
        sentences: [],
      };
      sections.push(current);
    } else if (!current) {
      current = {
        id: `prayer-${prayerId}-section-intro`,
        sectionNumber: null,
        sentences: [],
      };
      sections.push(current);
    }
    if (!current) continue;
    current.sentences.push({
      id: `prayer-${prayerId}-section-${current.sectionNumber ?? "intro"}-sentence-${current.sentences.length}`,
      text,
      empty: text.trim() === "",
    });
  }

  return sections;
}

export function reconstructPrayerText(sections: PrayerSection[]): string {
  return sections.flatMap((section) => section.sentences.map((sentence) => sentence.text)).join("");
}

export function reconstructFromMarkdown(markdown: string, prayerId = "test"): string {
  return reconstructPrayerText(parsePrayerSections(markdown, prayerId));
}
