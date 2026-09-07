import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "content", "prayers");

function bumpVersion(raw) {
  return raw.replace(/content_version:\s*\d+/, "content_version: 2");
}

function patch(file, mutator) {
  const full = path.join(ROOT, file);
  const before = readFileSync(full, "utf8");
  let next = mutator(before);
  if (next !== before) next = bumpVersion(next);
  if (next !== before) writeFileSync(full, next, "utf8");
  return { file, changed: next !== before };
}

const results = [];

results.push(patch("dawn.md", (text) => text
  .replace("있는줄 믿습니다", "있는 줄 믿습니다")
  .replace("있는 여러가지 악에서", "있는 여러 가지 악에서")));

results.push(patch("homeland.md", (text) => {
  let next = text.replace(
    "그러므로 우리나라가 하나님의 이름을 거룩히 할 일만 행하게 하옵소서.",
    "그러므로 우리 나라 지도자들과 백성들이 하나님의 이름을 거룩히 할 일만 행하게 하옵소서.",
  );
  next = next.replace(
    /5\) 하나님! 다른 나라들의 죄를 용서하여 준 것 같이 우리나라의 죄를 사하여주옵소서\. 우리나라 지도자들과 백성들이 지은죄가 많습니다\. 하나님만이 죄를 사하는 권세가 있는 줄 믿습니다\./,
    `5) 하나님! 다른 나라의 죄를 용서해 주시기 원합니다.
우리나라에 상처를 주고 힘들게 하였던 사람들과 민족들을 용서해 주옵소서.
예수님의 이름으로 용서해 주옵소서.
그리고 그 민족과 사람들을 축복해 주옵소서.
그 사람들이 하나님을 경외하고 복 받기를 원합니다.`,
  );
  return next;
}));

results.push(patch("church.md", (text) => text
  .replace("여러가지 시험에 들지 않도록", "여러 가지 시험에 들지 않도록")
  .replace("세상으로부터 시험 당하지", "세상으로부터 시험당하지")
  .replace("물질로 시험 당하지", "물질로 시험당하지")));

results.push(patch("pastor.md", (text) => text.replace("시험 당함을", "시험당함")));

results.push(patch("cell-group.md", (text) => text
  .replace('title: "목장을 위한 기도"', 'title: "목장과 목장원을 위한 기도"')
  .replace("우리 목장에 필요한 것을 공급하여 주시기를", "우리 목장과 목장원에게 필요한 것을 공급해 주시기를")
  .replace("서로 목장원들이", "목장원들이 서로")
  .replace("전목장원이", "전 목장원이")
  .replace("우리 목자의 죄와 목장원의 죄", "목자의 죄와 목장원의 죄")
  .replace("우리 목장이 시험에", "우리 목장과 목장원이 시험에")
  .replace("내쫒아 주옵시고", "내쫓아 주옵시고")
  .replace("우리 목장을 악에서", "우리 목장과 목장원을 악에서")));

results.push(patch("conceived-believer.md", (text) => text.replace(
  "또한 ㅇㅇㅇ씨가 하나님의 뜻을 알고",
  "또한 ㅇㅇㅇ씨가 하나님의 뜻을 깨닫고",
)));

results.push(patch("faculties.md", (text) => text
  .replace("그리고ㅇㅇㅇ가", "그리고 ㅇㅇㅇ가")
  .replace("하나님!ㅇㅇㅇ를", "하나님! ㅇㅇㅇ를")
  .replace("또한ㅇㅇㅇ의", "또한 ㅇㅇㅇ의")));

results.push(patch("home.md", (text) => text.replace("시험 당함을", "시험당함")));

results.push(patch("husband.md", (text) => text.replace("있는줄 믿습니다", "있는 줄 믿습니다")));

results.push(patch("wife.md", (text) => text
  .replace("있는줄 믿습니다", "있는 줄 믿습니다")
  .replace("시험 당하지", "시험당하지")));

results.push(patch("parents.md", (text) => text.replace('title: "부모를 위한 기도"', 'title: "부모님을 위한 기도"')));

results.push(patch("personal-2.md", (text) => text
  .replace("십자가의 은혜로", "십자가의 보혈로")
  .replace("불충, 불순종", "불충, 불성실, 불순종")));

results.push(patch("repentance.md", (text) => text
  .replaceAll("십자가의 은혜로", "십자가의 보혈로")
  .replace("있는줄 믿습니다", "있는 줄 믿습니다")));

results.push(patch("spiritual-power.md", (text) => text.replace("피난처입니다.", "피난처이십니다.")));

results.push(patch("temptations.md", (text) => text
  .replace("거룩하심 분", "거룩하신 분")
  .replace("찿지 못하게", "찾지 못하게")));

results.push(patch("tired.md", (text) => text.replace("내려놓기를 원합니다", "내려놓기 원합니다")));

results.push(patch("thanks.md", (text) => text
  .replace("꾸이지 않을", "꾸지 않을")
  .replace("찿을 수 있는", "찾을 수 있는")));

results.push(patch("healing.md", (text) => text
  .replace("혹 죄로 인해 건강을 해친 것이 아닌지", "죄로 인해 건강을 해친 것이 아닌지")
  .replace("혹 사탄이 틈타서 질병이 생긴 것이라면", "사탄이 틈타서 질병이 생긴 것이라면")
  .replace("있는 여러가지 악에서", "있는 여러 가지 악에서")
  .replace("지켜주옵소서", "지켜 주옵소서")));

results.push(patch("spouse.md", (text) => {
  let next = text
    .replace("자들로써", "자들로서")
    .replace("짝 지워주신", "짝 지어주신")
    .replace("지켜주옵소서", "지켜 주옵소서")
    .replace("7)하나님!", "7) 하나님!");
  next = next.replace(
    "나도 용서하게 하옵소서. 6) 하나님! 남편(아내)의 죄를 용서해 주었으니 나의 죄를 용서하여 주옵소서. 하나님만이 죄를 사하는 권세가 있는 줄 믿습니다.",
    `나도 용서하게 하옵소서.

6) 하나님! 남편(아내)의 죄를 용서해 주었으니 나의 죄를 용서하여 주옵소서.
하나님만이 죄를 사하는 권세가 있는 줄 믿습니다.`,
  );
  return next;
}));

results.push(patch("money.md", (text) => text
  .replace("인한 여러가지 악에서", "인한 여러 가지 악에서")
  .replace("지켜주옵소서", "지켜 주옵소서")));

results.push(patch("business.md", (text) => text
  .replace("있는줄 믿습니다", "있는 줄 믿습니다")
  .replace("지켜주옵소서", "지켜 주옵소서")));

results.push(patch("night.md", (text) => text
  .replace("여러가지 일들을", "여러 가지 일들을")
  .replace("지켜주옵소서", "지켜 주옵소서")));

results.push(patch("heal-sickness.md", (text) => text
  .replace("준 것같이 나의 죄를", "준 것 같이 나의 죄를")
  .replace("귀신을 쫓아내며,,,.", "귀신을 쫓아내며…")));

for (const item of results) {
  console.log(`${item.changed ? "CHANGED" : "same   "} ${item.file}`);
}
