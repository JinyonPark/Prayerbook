"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAppState } from "@/components/providers/AppProviders";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  PERSONALIZATION_PRAYERS,
  intercessionFor,
  namesFor,
  type PersonalizationRow,
} from "@/lib/prayers/personalize";
import { parseNameList } from "@/lib/prayers/inputs";
import { CHILDREN_PRAYER_ITEM_ID } from "@/lib/prayers/known-ids";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function PersonalizeView() {
  const { personalizations, setPersonalizations, online, prayerInputs, savePrayerInputs } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function withUser() {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요합니다.");
    return { supabase, user };
  }

  async function addName(slug: string, value: string, sortOrder: number) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(`${slug}-name`);
    setError(null);
    try {
      const { supabase, user } = await withUser();
      const { data, error: insertError } = await supabase
        .from("user_prayer_personalizations")
        .insert({
          user_id: user.id,
          prayer_slug: slug,
          slot_key: "name",
          value: trimmed,
          sort_order: sortOrder,
        })
        .select("id, prayer_slug, slot_key, value, sort_order")
        .single();
      if (insertError) throw insertError;
      setPersonalizations([...personalizations, data as PersonalizationRow]);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function updateRow(row: PersonalizationRow, value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(row.id);
    setError(null);
    try {
      const { supabase } = await withUser();
      const { error: updateError } = await supabase
        .from("user_prayer_personalizations")
        .update({ value: trimmed })
        .eq("id", row.id);
      if (updateError) throw updateError;
      setPersonalizations(personalizations.map((item) => (item.id === row.id ? { ...item, value: trimmed } : item)));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function removeRow(row: PersonalizationRow) {
    setPending(row.id);
    setError(null);
    try {
      const { supabase } = await withUser();
      const { error: deleteError } = await supabase.from("user_prayer_personalizations").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setPersonalizations(personalizations.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function saveIntercession(slug: string, existing: PersonalizationRow | null, value: string) {
    const trimmed = value.trim();
    setPending(`${slug}-intercession`);
    setError(null);
    try {
      const { supabase, user } = await withUser();
      if (!trimmed) {
        if (!existing) return;
        const { error: deleteError } = await supabase.from("user_prayer_personalizations").delete().eq("id", existing.id);
        if (deleteError) throw deleteError;
        setPersonalizations(personalizations.filter((item) => item.id !== existing.id));
        return;
      }
      if (existing) {
        const { error: updateError } = await supabase
          .from("user_prayer_personalizations")
          .update({ value: trimmed })
          .eq("id", existing.id);
        if (updateError) throw updateError;
        setPersonalizations(
          personalizations.map((item) => (item.id === existing.id ? { ...item, value: trimmed } : item)),
        );
        return;
      }
      const { data, error: insertError } = await supabase
        .from("user_prayer_personalizations")
        .insert({
          user_id: user.id,
          prayer_slug: slug,
          slot_key: "intercession",
          value: trimmed,
          sort_order: 0,
        })
        .select("id, prayer_slug, slot_key, value, sort_order")
        .single();
      if (insertError) throw insertError;
      setPersonalizations([...personalizations, data as PersonalizationRow]);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[var(--muted)]">
        여기서 저장한 이름과 중보기도가 해당 기도문 본문에 자연스럽게 들어갑니다. 자녀 이름은 여러 명을 한 번에 입력하며, 기도문 화면에서 함께 표시됩니다.
      </p>
      {!online ? <p>인터넷 연결이 필요합니다. 연결 후 저장할 수 있습니다.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {PERSONALIZATION_PRAYERS.map((prayer) => (
        <PrayerEditor
          key={prayer.slug}
          prayer={prayer}
          names={namesFor(personalizations, prayer.slug)}
          intercession={intercessionFor(personalizations, prayer.slug)}
          childNames={
            prayer.slug === "children"
              ? (prayerInputs.find((row) => row.prayer_item_id === CHILDREN_PRAYER_ITEM_ID)?.values.child_names ??
                namesFor(personalizations, "children").map((row) => row.value))
              : []
          }
          pending={pending}
          disabled={!online || pending !== null}
          onSaveChildNames={async (raw) => {
            setPending("children-names");
            setError(null);
            try {
              await savePrayerInputs(CHILDREN_PRAYER_ITEM_ID, { child_names: parseNameList(raw) });
            } catch (err) {
              setError(toUserMessage(err));
            } finally {
              setPending(null);
            }
          }}
          onAddName={(value) => {
            const nextOrder = namesFor(personalizations, prayer.slug).reduce(
              (max, row) => Math.max(max, row.sort_order),
              -1,
            ) + 1;
            void addName(prayer.slug, value, nextOrder);
          }}
          onUpdateName={(row, value) => void updateRow(row, value)}
          onDeleteName={(row) => void removeRow(row)}
          onSaveIntercession={(value) =>
            void saveIntercession(prayer.slug, intercessionFor(personalizations, prayer.slug), value)
          }
          onDeleteIntercession={() => {
            const row = intercessionFor(personalizations, prayer.slug);
            if (row) void removeRow(row);
          }}
        />
      ))}
    </div>
  );
}

function PrayerEditor({
  prayer,
  names,
  childNames,
  intercession,
  pending,
  disabled,
  onSaveChildNames,
  onAddName,
  onUpdateName,
  onDeleteName,
  onSaveIntercession,
  onDeleteIntercession,
}: {
  prayer: (typeof PERSONALIZATION_PRAYERS)[number];
  names: PersonalizationRow[];
  childNames: string[];
  intercession: PersonalizationRow | null;
  pending: string | null;
  disabled: boolean;
  onSaveChildNames: (raw: string) => Promise<void>;
  onAddName: (value: string) => void;
  onUpdateName: (row: PersonalizationRow, value: string) => void;
  onDeleteName: (row: PersonalizationRow) => void;
  onSaveIntercession: (value: string) => void;
  onDeleteIntercession: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [childDraft, setChildDraft] = useState(childNames.join("\n"));
  const [intercessionDraft, setIntercessionDraft] = useState<string | null>(null);
  const atNameLimit = Boolean(prayer.maxNames && names.length >= prayer.maxNames);
  const intercessionValue = intercessionDraft ?? intercession?.value ?? "";

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold">
        {prayer.itemNumber}. {prayer.title}
      </h2>
      {prayer.slug === "children" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">자녀 이름을 여러 명 한 번에 입력합니다. 기도문에는 함께 표시됩니다.</p>
          <textarea
            className="min-h-32 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={childDraft}
            maxLength={400}
            disabled={disabled}
            onChange={(event) => setChildDraft(event.target.value)}
          />
          {parseNameList(childDraft).length > 0 ? (
            <p className="text-sm">표시: {parseNameList(childDraft).join(", ")}</p>
          ) : (
            <p className="text-sm">아직 저장된 이름이 없습니다.</p>
          )}
          <Button disabled={disabled || pending === "children-names"} onClick={() => void onSaveChildNames(childDraft)}>
            {pending === "children-names" ? "저장 중" : "저장"}
          </Button>
        </div>
      ) : prayer.hasNames ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">{prayer.nameLabel}</p>
          {names.length === 0 ? <p className="text-sm">아직 저장된 이름이 없습니다.</p> : null}
          {names.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-2">
              <input
                className="touch-target min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
                value={drafts[row.id] ?? row.value}
                maxLength={40}
                disabled={disabled}
                onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
              />
              <Button
                variant="secondary"
                disabled={disabled || pending === row.id}
                onClick={() => onUpdateName(row, drafts[row.id] ?? row.value)}
              >
                {pending === row.id ? "저장 중" : "수정"}
              </Button>
              <Button variant="danger" disabled={disabled || pending === row.id} onClick={() => onDeleteName(row)}>
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
                maxLength={40}
                placeholder={`${prayer.nameLabel} 추가`}
                disabled={disabled}
                onChange={(event) => setNewName(event.target.value)}
              />
              <Button
                disabled={disabled || pending === `${prayer.slug}-name` || !newName.trim()}
                onClick={() => {
                  onAddName(newName);
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
                disabled={disabled || pending === intercession.id}
                onClick={() => {
                  setIntercessionDraft("");
                  onDeleteIntercession();
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
