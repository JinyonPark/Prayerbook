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
  hasIntercession: boolean;
  intercessionLabel?: string;
};

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
    title: "목장을 위한 기도",
    hasNames: false,
    hasIntercession: true,
    intercessionLabel: "목장을 위한 중보기도",
  },
  {
    slug: "conceived-believer",
    itemNumber: 6,
    title: "태신자를 위한 기도",
    hasNames: true,
    nameLabel: "태신자 이름",
    honorific: "씨",
    hasIntercession: false,
  },
  {
    slug: "faculties",
    itemNumber: 7,
    title: "사람을 위한 기도",
    hasNames: true,
    nameLabel: "이름",
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
    title: "부모를 위한 기도",
    hasNames: false,
    hasIntercession: true,
    intercessionLabel: "부모를 위한 중보기도",
  },
  {
    slug: "children",
    itemNumber: 12,
    title: "자녀를 위한 기도",
    hasNames: true,
    nameLabel: "자녀 이름",
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

export function namesFor(rows: PersonalizationRow[], slug: string): PersonalizationRow[] {
  return rows
    .filter((row) => row.prayer_slug === slug && row.slot_key === "name")
    .sort((left, right) => left.sort_order - right.sort_order || left.value.localeCompare(right.value, "ko"));
}

export function intercessionFor(rows: PersonalizationRow[], slug: string): PersonalizationRow | null {
  return rows.find((row) => row.prayer_slug === slug && row.slot_key === "intercession") ?? null;
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

function replaceNamePlaceholders(markdown: string, name: string, honorific?: "씨"): string {
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
    [/\(ㅇㅇㅇ를 위한 중보기도\)/g, `(${eulReul(name)} 위한 중보기도)`],
    [/\(ㅇㅇㅇ\)를/g, `${eulReul(name)}`],
    [/\(ㅇㅇㅇ\)/g, name],
    [/우리 ㅇㅇㅇ가/g, `우리 ${iGa(name)}`],
    [/ㅇㅇㅇ에게/g, `${name}에게`],
    [/ㅇㅇㅇ의/g, `${name}의`],
    [/ㅇㅇㅇ을/g, eulReul(name)],
    [/ㅇㅇㅇ를/g, eulReul(name)],
    [/ㅇㅇㅇ가/g, iGa(name)],
    [/ㅇㅇㅇ는/g, eunNeun(name)],
    [/ㅇㅇㅇ연약하오니/g, `${eunNeun(name)} 연약하오니`],
    [/ㅇㅇㅇ 가/g, iGa(name)],
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
  options: { name?: string | null; intercession?: string | null },
): string {
  let next = markdown;
  const intercession = options.intercession?.trim();
  if (intercession) {
    const block = INTERCESSION_BLOCK[slug];
    if (block) {
      next = next.replace(block, `${intercession}\n\n`);
    }
  }

  const name = options.name?.trim();
  if (name) {
    const config = personalizationConfig(slug);
    next = replaceNamePlaceholders(next, name, config?.honorific);
  }
  return next;
}
