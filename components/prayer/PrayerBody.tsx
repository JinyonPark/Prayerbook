"use client";

import { parsePrayerSections } from "@/lib/prayers/sentences";

export function PrayerBody({
  prayerId,
  markdown,
}: {
  prayerId: string;
  markdown: string;
}) {
  const sections = parsePrayerSections(markdown, prayerId);
  return (
    <article className="reader-article rounded-none bg-[var(--card)] px-3.5 py-5 sm:rounded-2xl sm:px-8 sm:py-6">
      {sections.length === 0 ? <p>기도문 데이터가 없습니다.</p> : null}
      {sections.map((section) => (
        <section key={section.id} className="prayer-section" data-prayer-section={section.sectionNumber ?? "intro"}>
          {section.sentences.map((sentence) =>
            sentence.empty ? null : (
              <p
                key={sentence.id}
                id={sentence.id}
                data-prayer-anchor={sentence.id}
                className="prayer-sentence"
              >
                {sentence.text.trim()}
              </p>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
