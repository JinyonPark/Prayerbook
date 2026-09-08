import {
  formatNameList,
  lastNameForParticle,
  parseNameList,
  sanitizePlainText,
  type PrayerInputRow,
  type PrayerInputValues,
} from "@/lib/prayers/inputs";
import { PERSONALIZATION_ITEM_IDS } from "@/lib/prayers/known-ids";

export type PersonalizationSlot = "name" | "intercession";

export type PersonalizationRow = {
  id: string;
  prayer_slug: string;
  slot_key: PersonalizationSlot;
  value: string;
  sort_order: number;
};

export type PersonalizationConfig = {
  slug: string;
  itemNumber: number;
  title: string;
  hasNames: boolean;
  nameLabel?: string;
  honorific?: "씨";
  maxNames?: number;
  bulkNames?: boolean;
  hasIntercession: boolean;
  intercessionLabel?: string;
};

export const CONCEIVED_GROUP_LABEL = "태신자들";

export const PERSONALIZATION_PRAYERS: PersonalizationConfig[] = [
  {
    slug: "church",
    itemNumber: 3,
    title: "교회를 위한 기도",
    hasNames: false,
    hasIntercession: true,
    intercessionLabel: "교회를 위한 중보기도",
  },
  {
    slug: "cell-group",
    itemNumber: 5,
    title: "목장과 목장원을 위한 기도",
    hasNames: false,
    hasIntercession: true,
    intercessionLabel: "목장을 위한 중보기도",
  },
  {
    slug: "conceived-believer",
    itemNumber: 6,
    title: "태신자를 위한 기도",
    hasNames: true,
    nameLabel: "태신자 이름 (여러 명)",
    honorific: "씨",
    bulkNames: true,
    hasIntercession: false,
  },
  {
    slug: "faculties",
    itemNumber: 7,
    title: "사람을 위한 기도",
    hasNames: true,
    nameLabel: "이름 (여러 명)",
    bulkNames: true,
    hasIntercession: true,
    intercessionLabel: "그 사람을 위한 중보기도",
  },
  {
    slug: "husband",
    itemNumber: 9,
    title: "남편을 위한 기도",
    hasNames: true,
    nameLabel: "남편 이름",
    maxNames: 1,
    hasIntercession: true,
    intercessionLabel: "남편을 위한 중보기도",
  },
  {
    slug: "wife",
    itemNumber: 10,
    title: "아내를 위한 기도",
    hasNames: true,
    nameLabel: "아내 이름",
    maxNames: 1,
    hasIntercession: true,
    intercessionLabel: "아내를 위한 중보기도",
  },
  {
    slug: "parents",
    itemNumber: 11,
    title: "부모님을 위한 기도",
    hasNames: false,
    hasIntercession: true,
    intercessionLabel: "부모를 위한 중보기도",
  },
  {
    slug: "children",
    itemNumber: 12,
    title: "자녀를 위한 기도",
    hasNames: true,
    nameLabel: "자녀 이름 (여러 명)",
    bulkNames: true,
    hasIntercession: true,
    intercessionLabel: "자녀를 위한 중보기도",
  },
];

const INTERCESSION_BLOCK: Record<string, RegExp> = {
  church: /\(교회를 위한 중보기도\)\s*\n+[\s\S]*?(?=\n5\) )/,
  "cell-group": /\(목장을 위한 중보\s*기도\)\s*\n+[\s\S]*?(?=\n5\) )/,
  faculties: /\(ㅇㅇㅇ를 위한 중보기도\)\s*\n+[\s\S]*?(?=\n5\) )/,
  husband: /\(남편을 위한 중보기도\)\s*\n+[\s\S]*?(?=\n5\) )/,
  wife: /\(\s*아내를 위한 중보기도\s*\)\s*\n+[\s\S]*?(?=\n5\) )/,
  parents: /\(부모를 위한 중보기도\)\s*\n+[\s\S]*?(?=\n5\) )/,
  children: /\(자녀를 위한 중보기도\)\s*\n+[\s\S]*?(?=\n5\) )/,
};

export function personalizationConfig(slug: string): PersonalizationConfig | undefined {
  return PERSONALIZATION_PRAYERS.find((item) => item.slug === slug);
}

export function usesBulkNames(slug: string): boolean {
  return Boolean(personalizationConfig(slug)?.bulkNames);
}

export function namesFor(rows: PersonalizationRow[], slug: string): PersonalizationRow[] {
  return rows
    .filter((row) => row.prayer_slug === slug && row.slot_key === "name")
    .sort((left, right) => left.sort_order - right.sort_order || left.value.localeCompare(right.value, "ko"));
}

export function intercessionFor(rows: PersonalizationRow[], slug: string): PersonalizationRow | null {
  return rows.find((row) => row.prayer_slug === slug && row.slot_key === "intercession") ?? null;
}

export function personalizationRowsFromInputs(inputs: PrayerInputRow[]): PersonalizationRow[] {
  const rows: PersonalizationRow[] = [];
  for (const [slug, prayerItemId] of Object.entries(PERSONALIZATION_ITEM_IDS)) {
    const values = inputs.find((row) => row.prayer_item_id === prayerItemId)?.values ?? {};
    const names = slug === "children" ? values.child_names : values.names;
    parseNameList((names ?? []).join("\n")).forEach((name, index) => {
      if (!name.trim()) return;
      rows.push({
        id: `${prayerItemId}:name:${index}`,
        prayer_slug: slug,
        slot_key: "name",
        value: name,
        sort_order: index,
      });
    });
    if (values.intercession?.trim()) {
      rows.push({
        id: `${prayerItemId}:intercession`,
        prayer_slug: slug,
        slot_key: "intercession",
        value: values.intercession,
        sort_order: 0,
      });
    }
  }
  return rows;
}

export function hasBatchim(word: string): boolean {
  const ch = [...word].at(-1);
  if (!ch) return false;
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 !== 0;
  }
  return /[bcdfghjklmnpqrstvwxz0-9]$/i.test(ch);
}

function iGa(name: string): string {
  return `${name}${hasBatchim(name) ? "이" : "가"}`;
}

function eulReul(name: string): string {
  return `${name}${hasBatchim(name) ? "을" : "를"}`;
}

function eunNeun(name: string): string {
  return `${name}${hasBatchim(name) ? "은" : "는"}`;
}

function labeledNameList(names: string[], honorific?: "씨"): { name: string; labeled: string } {
  const last = lastNameForParticle(names);
  const prefix = names.length > 1 ? `${formatNameList(names.slice(0, -1))}, ` : "";
  const name = `${prefix}${last}`;
  return { name, labeled: honorific ? `${name}${honorific}` : name };
}

function replaceRemainingWithGroup(markdown: string, group: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\(태신자 이름\)\s*씨/g, group],
    [/\(태신자 이름\)/g, group],
    [/ㅇㅇㅇ씨가/g, iGa(group)],
    [/ㅇㅇㅇ씨에게/g, `${group}에게`],
    [/ㅇㅇㅇ씨의/g, `${group}의`],
    [/ㅇㅇㅇ씨를/g, eulReul(group)],
    [/ㅇㅇㅇ씨도/g, `${group}도`],
    [/ㅇㅇㅇ씨는/g, eunNeun(group)],
    [/ㅇㅇㅇ씨/g, group],
    [/\(ㅇㅇㅇ를 위한 중보기도\)/g, `(${eulReul(group)} 위한 중보기도)`],
    [/\(ㅇㅇㅇ\)를/g, eulReul(group)],
    [/\(ㅇㅇㅇ\)/g, group],
    [/ㅇㅇㅇ에게/g, `${group}에게`],
    [/ㅇㅇㅇ의/g, `${group}의`],
    [/ㅇㅇㅇ을/g, eulReul(group)],
    [/ㅇㅇㅇ를/g, eulReul(group)],
    [/ㅇㅇㅇ가/g, iGa(group)],
    [/ㅇㅇㅇ는/g, eunNeun(group)],
    [/ㅇㅇㅇ이/g, iGa(group)],
    [/ㅇㅇㅇ/g, group],
  ];
  let next = markdown;
  for (const [pattern, value] of replacements) {
    next = next.replace(pattern, value);
  }
  return next;
}

export function replaceConceivedNamesFirstThenGroup(markdown: string, names: string[], honorific?: "씨"): string {
  const { labeled } = labeledNameList(names, honorific);
  const first = markdown.replace(/\(태신자 이름\)\s*씨|\(태신자 이름\)/, labeled);
  return replaceRemainingWithGroup(first, CONCEIVED_GROUP_LABEL);
}

function replaceNamePlaceholders(markdown: string, names: string[], honorific?: "씨"): string {
  if (names.length === 0) return markdown;
  const last = lastNameForParticle(names);
  const prefix = names.length > 1 ? `${formatNameList(names.slice(0, -1))}, ` : "";
  const name = `${prefix}${last}`;
  const labeled = honorific ? `${name}${honorific}` : name;
  const replacements: Array<[RegExp, string]> = [
    [/\(태신자 이름\)\s*씨/g, labeled],
    [/\(태신자 이름\)/g, name],
    [/ㅇㅇㅇ씨가/g, `${labeled}가`],
    [/ㅇㅇㅇ씨에게/g, `${labeled}에게`],
    [/ㅇㅇㅇ씨의/g, `${labeled}의`],
    [/ㅇㅇㅇ씨를/g, `${labeled}를`],
    [/ㅇㅇㅇ씨도/g, `${labeled}도`],
    [/ㅇㅇㅇ씨는/g, `${labeled}는`],
    [/ㅇㅇㅇ씨/g, labeled],
    [/남편\(ㅇㅇㅇ\)/g, `남편(${name})`],
    [/아내\(ㅇㅇㅇ\)/g, `아내(${name})`],
    [/\(ㅇㅇㅇ를 위한 중보기도\)/g, `(${prefix}${eulReul(last)} 위한 중보기도)`],
    [/\(ㅇㅇㅇ\)를/g, `${prefix}${eulReul(last)}`],
    [/\(ㅇㅇㅇ\)/g, name],
    [/우리 ㅇㅇㅇ가/g, `우리 ${prefix}${iGa(last)}`],
    [/ㅇㅇㅇ에게/g, `${name}에게`],
    [/ㅇㅇㅇ의/g, `${name}의`],
    [/ㅇㅇㅇ을/g, `${prefix}${eulReul(last)}`],
    [/ㅇㅇㅇ를/g, `${prefix}${eulReul(last)}`],
    [/ㅇㅇㅇ가/g, `${prefix}${iGa(last)}`],
    [/ㅇㅇㅇ는/g, `${prefix}${eunNeun(last)}`],
    [/ㅇㅇㅇ이/g, `${prefix}${iGa(last)}`],
    [/ㅇㅇㅇ연약하오니/g, `${prefix}${eunNeun(last)} 연약하오니`],
    [/ㅇㅇㅇ 가/g, `${prefix}${iGa(last)}`],
    [/ㅇㅇㅇ/g, name],
  ];

  let next = markdown;
  for (const [pattern, value] of replacements) {
    next = next.replace(pattern, value);
  }
  return next;
}

export function applyPersonalization(
  markdown: string,
  slug: string,
  options: {
    name?: string | null;
    names?: string[];
    intercession?: string | null;
    nameRepeat?: "first" | "all";
  },
): string {
  let next = markdown;
  const intercession = options.intercession?.trim();
  if (intercession) {
    const block = INTERCESSION_BLOCK[slug];
    if (block) {
      next = next.replace(block, `${intercession}\n\n`);
    }
  }

  const rawNames =
    (options.names?.filter(Boolean) ?? []).length > 0 ? (options.names ?? []).join("\n") : options.name?.trim() ?? "";
  const names = parseNameList(rawNames);
  if (names.length > 0) {
    const config = personalizationConfig(slug);
    if (slug === "conceived-believer" && names.length > 1 && options.nameRepeat !== "all") {
      next = replaceConceivedNamesFirstThenGroup(next, names, config?.honorific);
    } else {
      next = replaceNamePlaceholders(next, names, config?.honorific);
    }
  }
  return next;
}

export function applyPrayerInputValues(
  markdown: string,
  slug: string,
  values: PrayerInputValues,
): string {
  let next = markdown;
  if (slug === "hope-prayer") {
    const wish = values.wish_text ? sanitizePlainText(values.wish_text, 80) : "";
    const person = values.forgiveness_person_name ? sanitizePlainText(values.forgiveness_person_name, 40) : "";
    if (wish) {
      next = next.replace(/나의 소원은 \([^)]*\)\s*입니다/, `나의 소원은 (${wish})입니다`);
    }
    if (person) {
      next = next.replace(/다른 사람\(\s*이름\s*\)/, `다른 사람(${person})`);
    }
  }
  if (slug === "conceived-prayer") {
    const target = values.evangelism_target_name ? sanitizePlainText(values.evangelism_target_name, 40) : "";
    if (target) {
      next = next.replace(/\(\s+\)/g, `(${target})`);
      next = next.replace(/○○○/g, target);
    }
  }
  if (slug === "heal-sickness") {
    const target = values.disease_target_name ? sanitizePlainText(values.disease_target_name, 40) : "";
    const disease = values.disease_name ? sanitizePlainText(values.disease_name, 40) : "";
    if (target) {
      next = next.replace(/나\(다른 사람 이름\)/g, target);
      next = next.replace(/다른 사람\(이름\)/g, target);
    }
    if (disease) {
      next = next.replace(/위암\(병명\)/g, disease);
    }
  }
  return next;
}
