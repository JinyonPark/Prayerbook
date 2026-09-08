"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAppState } from "@/components/providers/AppProviders";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  PERSONALIZATION_PRAYERS,
  namesFor,
  intercessionFor,
  personalizationRowsFromInputs,
} from "@/lib/prayers/personalize";
import { parseNameList, type PrayerInputValues } from "@/lib/prayers/inputs";
import { PERSONALIZATION_ITEM_IDS } from "@/lib/prayers/known-ids";

export function PersonalizeView() {
  const { online, prayerInputs, savePrayerInputs, prefs, updatePrefs } = useAppState();
  const personalizations = personalizationRowsFromInputs(prayerInputs);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  function valuesFor(slug: string): PrayerInputValues {
    const id = PERSONALIZATION_ITEM_IDS[slug];
    return prayerInputs.find((row) => row.prayer_item_id === id)?.values ?? {};
  }

  async function saveSlug(slug: string, next: PrayerInputValues, pendingKey: string) {
    setPending(pendingKey);
    setError(null);
    try {
      await savePrayerInputs(PERSONALIZATION_ITEM_IDS[slug], next);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[var(--muted)]">
        여기서 저장한 이름과 중보기도가 해당 기도문 본문에 자연스럽게 들어갑니다. 자녀, 태신자, 사람을 위한 기도는 이름을 여러 명 한 번에 입력합니다.
      </p>
      {!online ? <p>인터넷 연결이 필요합니다. 연결 후 저장할 수 있습니다.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {PERSONALIZATION_PRAYERS.map((prayer) => (
        <PrayerEditor
          key={prayer.slug}
          prayer={prayer}
          names={namesFor(personalizations, prayer.slug).map((row) => row.value)}
          intercession={intercessionFor(personalizations, prayer.slug)?.value ?? ""}
          pending={pending}
          disabled={!online || pending !== null}
          conceivedShowAllNames={prefs.conceivedShowAllNames}
          onToggleConceivedShowAllNames={(value) => void updatePrefs({ conceivedShowAllNames: value })}
          onSaveNames={(names) => {
            const current = valuesFor(prayer.slug);
            const next: PrayerInputValues = { ...current };
            if (prayer.slug === "children") next.child_names = names;
            else next.names = names;
            void saveSlug(prayer.slug, next, `${prayer.slug}-name`);
          }}
          onSaveIntercession={(value) => {
            const current = valuesFor(prayer.slug);
            void saveSlug(prayer.slug, { ...current, intercession: value }, `${prayer.slug}-intercession`);
          }}
        />
      ))}
    </div>
  );
}

function bulkNameHint(slug: string): string {
  if (slug === "children") return "자녀 이름을 여러 명 한 번에 입력합니다. 줄바꿈이나 쉼표로 구분하며, 기도문에는 함께 표시됩니다.";
  if (slug === "conceived-believer") {
    return "태신자 이름을 여러 명 한 번에 입력합니다. 줄바꿈이나 쉼표로 구분합니다. 아래 설정에서 이름을 매번 전부 넣을지, 처음만 넣고 나머지는 ‘태신자들’로 이을지 고를 수 있습니다.";
  }
  return "이름을 여러 명 한 번에 입력합니다. 줄바꿈이나 쉼표로 구분하며, 기도문에는 함께 표시됩니다.";
}

function PrayerEditor({
  prayer,
  names,
  intercession,
  pending,
  disabled,
  conceivedShowAllNames,
  onToggleConceivedShowAllNames,
  onSaveNames,
  onSaveIntercession,
}: {
  prayer: (typeof PERSONALIZATION_PRAYERS)[number];
  names: string[];
  intercession: string;
  pending: string | null;
  disabled: boolean;
  conceivedShowAllNames: boolean;
  onToggleConceivedShowAllNames: (value: boolean) => void;
  onSaveNames: (names: string[]) => void;
  onSaveIntercession: (value: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(names.join("\n"));
  const [newName, setNewName] = useState("");
  const [intercessionDraft, setIntercessionDraft] = useState<string | null>(null);
  const atNameLimit = Boolean(prayer.maxNames && names.length >= prayer.maxNames);
  const intercessionValue = intercessionDraft ?? intercession;
  const parsedNames = prayer.bulkNames ? parseNameList(nameDraft).slice(0, 20) : names;
  const namesKey = names.join("\n");
  const namePending = pending === `${prayer.slug}-name`;

  useEffect(() => {
    setNameDraft(namesKey);
  }, [namesKey]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold">
        {prayer.itemNumber}. {prayer.title}
      </h2>
      {prayer.bulkNames ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">{bulkNameHint(prayer.slug)}</p>
          <textarea
            className="min-h-32 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={nameDraft}
            maxLength={2000}
            disabled={disabled}
            onChange={(event) => setNameDraft(event.target.value)}
          />
          {parsedNames.length > 0 ? <p className="text-sm">표시: {parsedNames.join(", ")}</p> : <p className="text-sm">아직 저장된 이름이 없습니다.</p>}
          <Button disabled={disabled || namePending} onClick={() => onSaveNames(parsedNames)}>
            {namePending ? "저장 중" : "저장"}
          </Button>
          {prayer.slug === "conceived-believer" ? (
            <fieldset>
              <legend className="mb-2 text-sm text-[var(--muted)]">태신자 이름 표시</legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={!conceivedShowAllNames ? "primary" : "secondary"}
                  aria-pressed={!conceivedShowAllNames}
                  disabled={disabled}
                  onClick={() => onToggleConceivedShowAllNames(false)}
                >
                  처음만 전부 표시
                </Button>
                <Button
                  type="button"
                  variant={conceivedShowAllNames ? "primary" : "secondary"}
                  aria-pressed={conceivedShowAllNames}
                  disabled={disabled}
                  onClick={() => onToggleConceivedShowAllNames(true)}
                >
                  매번 전부 표시
                </Button>
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : prayer.hasNames ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">{prayer.nameLabel}</p>
          {names.length === 0 ? <p className="text-sm">아직 저장된 이름이 없습니다.</p> : null}
          {names.map((name) => (
            <div key={name} className="flex flex-wrap gap-2">
              <p className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2">{name}</p>
              <Button
                variant="danger"
                disabled={disabled}
                onClick={() => onSaveNames(names.filter((item) => item !== name))}
              >
                삭제
              </Button>
            </div>
          ))}
          {atNameLimit ? (
            <p className="text-sm text-[var(--muted)]">이 기도는 이름을 하나만 저장합니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                className="touch-target min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
                value={newName}
                maxLength={50}
                placeholder={`${prayer.nameLabel} 추가`}
                disabled={disabled}
                onChange={(event) => setNewName(event.target.value)}
              />
              <Button
                disabled={disabled || pending === `${prayer.slug}-name` || !newName.trim()}
                onClick={() => {
                  const next = prayer.maxNames === 1 ? [newName.trim()] : [...names, newName.trim()].filter(Boolean);
                  onSaveNames(next);
                  setNewName("");
                }}
              >
                추가
              </Button>
            </div>
          )}
        </div>
      ) : null}
      {prayer.hasIntercession ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">{prayer.intercessionLabel}</p>
          <textarea
            className="min-h-32 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={intercessionValue}
            maxLength={4000}
            disabled={disabled}
            placeholder="원문의 괄호 자리에 넣을 중보기도 내용을 적어 주세요."
            onChange={(event) => setIntercessionDraft(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled || pending === `${prayer.slug}-intercession`}
              onClick={() => onSaveIntercession(intercessionValue)}
            >
              {pending === `${prayer.slug}-intercession` ? "저장 중" : "저장"}
            </Button>
            {intercession ? (
              <Button
                variant="danger"
                disabled={disabled}
                onClick={() => {
                  setIntercessionDraft("");
                  onSaveIntercession("");
                }}
              >
                삭제
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
