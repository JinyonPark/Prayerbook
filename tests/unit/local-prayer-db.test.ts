import { describe, expect, it } from "vitest";
import {
  applyConfirmedCompletionState,
  applyConfirmedLocalCompletion,
  createMemoryLocalPrayerRepository,
  deleteAllHistory,
  deleteHistoryDate,
  displayedLifetimeCount,
  emptyUserStats,
  getHistoryByMonth,
  historyRowsFromDaily,
  initializeLocalPrayerStats,
  parseInitialCompletionCount,
  prepareLocalCompletionEvent,
  rolloverToday,
  uniqueItemCount,
} from "@/lib/local-prayer-db";

const USER = "user-a";
const OTHER = "user-b";
const PRAYER = "11111111-1111-4111-8111-111111111111";
const PRAYER_B = "22222222-2222-4222-8222-222222222222";

function stats(overrides: Partial<ReturnType<typeof emptyUserStats>> = {}) {
  return {
    ...emptyUserStats({
      userId: USER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T01:00:00.000Z",
      bootstrapStatus: "completed",
    }),
    ...overrides,
  };
}

describe("초기값 계산", () => {
  it("표시 누적은 초기값 + 앱 누적이다", () => {
    const current = stats({ initialCompletionCount: 57, appCompletionCount: 18, todayCompletionCount: 18 });
    expect(displayedLifetimeCount(current)).toBe(75);
    const edited = { ...current, initialCompletionCount: 100 };
    expect(displayedLifetimeCount(edited)).toBe(118);
    expect(edited.todayCompletionCount).toBe(18);
    expect(edited.appCompletionCount).toBe(18);
  });

  it("초기값 입력 규칙을 검증한다", () => {
    expect(parseInitialCompletionCount("").ok).toBe(false);
    expect(parseInitialCompletionCount("12.5").ok).toBe(false);
    expect(parseInitialCompletionCount("-1").ok).toBe(false);
    expect(parseInitialCompletionCount("abc").ok).toBe(false);
    expect(parseInitialCompletionCount("0")).toEqual({ ok: true, value: 0 });
  });
});

describe("오늘 날짜 변경", () => {
  it("날짜가 바뀌면 오늘 횟수만 0이 된다", () => {
    const next = rolloverToday(
      stats({ todayDate: "2026-09-09", todayCompletionCount: 18, appCompletionCount: 75 }),
      "2026-09-10",
      "2026-09-10T01:00:00.000Z",
    );
    expect(next.todayDate).toBe("2026-09-10");
    expect(next.todayCompletionCount).toBe(0);
    expect(next.appCompletionCount).toBe(75);
  });
});

describe("완료 성공과 실패", () => {
  it("서버 성공 후 오늘·앱·이력이 한 번 증가한다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putUserStats(stats({ todayCompletionCount: 5, appCompletionCount: 18 }));
    await repo.putDailyHistory({
      userId: USER,
      localDate: "2026-09-09",
      totalCompletionCount: 1,
      itemCounts: { [PRAYER]: 1 },
      updatedAt: "2026-09-09T01:00:00.000Z",
    });
    await prepareLocalCompletionEvent(repo, {
      userId: USER,
      clientEventId: "evt-1",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      nowIso: "2026-09-09T02:00:00.000Z",
    });
    const applied = await applyConfirmedLocalCompletion(repo, {
      userId: USER,
      clientEventId: "evt-1",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T02:00:00.000Z",
    });
    expect(applied.applied).toBe(true);
    expect(applied.stats.todayCompletionCount).toBe(6);
    expect(applied.stats.appCompletionCount).toBe(19);
    expect(applied.history.itemCounts[PRAYER]).toBe(2);
  });

  it("서버 실패처럼 로컬 적용 전이면 횟수가 그대로다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putUserStats(stats({ todayCompletionCount: 5, appCompletionCount: 18 }));
    await prepareLocalCompletionEvent(repo, {
      userId: USER,
      clientEventId: "evt-fail",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      nowIso: "2026-09-09T02:00:00.000Z",
    });
    const pending = await repo.getCompletionEvent(USER, "evt-fail");
    const current = await repo.getUserStats(USER);
    expect(pending?.status).toBe("pending");
    expect(current?.todayCompletionCount).toBe(5);
    expect(current?.appCompletionCount).toBe(18);
  });

  it("같은 client_event_id는 로컬에서 두 번 증가하지 않는다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putUserStats(stats({ todayCompletionCount: 5, appCompletionCount: 18 }));
    const first = await applyConfirmedLocalCompletion(repo, {
      userId: USER,
      clientEventId: "evt-dup",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T02:00:00.000Z",
    });
    const second = await applyConfirmedLocalCompletion(repo, {
      userId: USER,
      clientEventId: "evt-dup",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T02:01:00.000Z",
    });
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.stats.todayCompletionCount).toBe(6);
    expect(second.stats.appCompletionCount).toBe(19);
  });

  it("idempotent 서버 응답이어도 pending이면 한 번 반영한다", () => {
    const pending = applyConfirmedCompletionState({
      stats: stats({ todayCompletionCount: 5, appCompletionCount: 18 }),
      history: undefined,
      event: {
        userId: USER,
        clientEventId: "evt-lost",
        prayerItemId: PRAYER,
        localDate: "2026-09-09",
        status: "pending",
        createdAt: "2026-09-09T02:00:00.000Z",
        appliedAt: null,
      },
      userId: USER,
      clientEventId: "evt-lost",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T02:05:00.000Z",
    });
    expect(pending.applied).toBe(true);
    expect(pending.stats.todayCompletionCount).toBe(6);
    expect(pending.stats.appCompletionCount).toBe(19);
  });
});

describe("이력", () => {
  it("같은 날짜 같은 기도는 한 줄로 합산한다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putUserStats(stats());
    for (const id of ["a", "b", "c"]) {
      await applyConfirmedLocalCompletion(repo, {
        userId: USER,
        clientEventId: id,
        prayerItemId: PRAYER,
        localDate: "2026-09-09",
        timeZone: "Asia/Seoul",
        nowIso: "2026-09-09T03:00:00.000Z",
      });
    }
    await applyConfirmedLocalCompletion(repo, {
      userId: USER,
      clientEventId: "other",
      prayerItemId: PRAYER_B,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T03:01:00.000Z",
    });
    const month = await getHistoryByMonth(repo, USER, 2026, 9);
    const rows = historyRowsFromDaily(month, [
      { id: PRAYER, title: "나라", itemNumber: 2, category: "main", displayOrder: 2 },
      { id: PRAYER_B, title: "교회", itemNumber: 3, category: "main", displayOrder: 3 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.items).toHaveLength(2);
    expect(rows[0]?.items.find((item) => item.prayerItemId === PRAYER)?.completionCount).toBe(3);
    expect(uniqueItemCount(month[0]?.itemCounts ?? {})).toBe(2);
  });

  it("월별 조회는 해당 월만 최근 날짜 우선으로 반환한다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putDailyHistory({
      userId: USER,
      localDate: "2026-08-31",
      totalCompletionCount: 1,
      itemCounts: { [PRAYER]: 1 },
      updatedAt: "2026-08-31T01:00:00.000Z",
    });
    await repo.putDailyHistory({
      userId: USER,
      localDate: "2026-09-09",
      totalCompletionCount: 2,
      itemCounts: { [PRAYER]: 2 },
      updatedAt: "2026-09-09T01:00:00.000Z",
    });
    await repo.putDailyHistory({
      userId: USER,
      localDate: "2026-09-01",
      totalCompletionCount: 1,
      itemCounts: { [PRAYER]: 1 },
      updatedAt: "2026-09-01T01:00:00.000Z",
    });
    const month = await getHistoryByMonth(repo, USER, 2026, 9);
    expect(month.map((row) => row.localDate)).toEqual(["2026-09-09", "2026-09-01"]);
  });

  it("날짜 삭제는 오늘·누적 횟수를 유지한다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putUserStats(stats({ todayCompletionCount: 18, appCompletionCount: 75, initialCompletionCount: 10 }));
    await repo.putDailyHistory({
      userId: USER,
      localDate: "2026-09-09",
      totalCompletionCount: 5,
      itemCounts: { [PRAYER]: 5 },
      updatedAt: "2026-09-09T01:00:00.000Z",
    });
    await deleteHistoryDate(repo, USER, "2026-09-09");
    expect(await repo.getDailyHistory(USER, "2026-09-09")).toBeUndefined();
    const current = await repo.getUserStats(USER);
    expect(current?.todayCompletionCount).toBe(18);
    expect(current?.appCompletionCount).toBe(75);
    expect(displayedLifetimeCount(current!)).toBe(85);
  });

  it("전체 이력 삭제는 다른 사용자와 userStats를 유지하고 새 완료는 다시 기록된다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    await repo.putUserStats(stats({ todayCompletionCount: 4, appCompletionCount: 9 }));
    await repo.putUserStats({ ...stats({ userId: OTHER }), userId: OTHER });
    await repo.putDailyHistory({
      userId: USER,
      localDate: "2026-09-08",
      totalCompletionCount: 2,
      itemCounts: { [PRAYER]: 2 },
      updatedAt: "2026-09-08T01:00:00.000Z",
    });
    await repo.putDailyHistory({
      userId: OTHER,
      localDate: "2026-09-08",
      totalCompletionCount: 7,
      itemCounts: { [PRAYER]: 7 },
      updatedAt: "2026-09-08T01:00:00.000Z",
    });
    await deleteAllHistory(repo, USER);
    expect(await getHistoryByMonth(repo, USER, 2026, 9)).toHaveLength(0);
    expect((await repo.getDailyHistory(OTHER, "2026-09-08"))?.totalCompletionCount).toBe(7);
    const kept = await repo.getUserStats(USER);
    expect(kept?.todayCompletionCount).toBe(4);
    expect(kept?.appCompletionCount).toBe(9);
    const next = await applyConfirmedLocalCompletion(repo, {
      userId: USER,
      clientEventId: "new-1",
      prayerItemId: PRAYER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T04:00:00.000Z",
    });
    expect(next.history.totalCompletionCount).toBe(1);
  });
});

describe("기존 사용자 bootstrap", () => {
  it("userStats가 없을 때만 서버 완료 횟수를 초기값으로 넣는다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    const first = await initializeLocalPrayerStats(repo, {
      userId: USER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T01:00:00.000Z",
      fetchLegacy: async () => ({
        completeCount: 75,
        todayCount: 3,
        days: [{ localDate: "2026-09-09", itemCounts: { [PRAYER]: 3 } }],
      }),
    });
    expect(first.stats.initialCompletionCount).toBe(75);
    expect(first.stats.appCompletionCount).toBe(0);
    expect(displayedLifetimeCount(first.stats)).toBe(75);
    const second = await initializeLocalPrayerStats(repo, {
      userId: USER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T02:00:00.000Z",
      fetchLegacy: async () => ({ completeCount: 999, todayCount: 0, days: [] }),
    });
    expect(second.seeded).toBe(false);
    expect(second.stats.initialCompletionCount).toBe(75);
  });

  it("서버 이력을 못 읽으면 0으로 두고 이후 자동 합산하지 않는다", async () => {
    const repo = createMemoryLocalPrayerRepository();
    const failed = await initializeLocalPrayerStats(repo, {
      userId: USER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T01:00:00.000Z",
      fetchLegacy: async () => {
        throw new Error("unavailable");
      },
    });
    expect(failed.bootstrapFailed).toBe(true);
    expect(failed.stats.initialCompletionCount).toBe(0);
    const later = await initializeLocalPrayerStats(repo, {
      userId: USER,
      localDate: "2026-09-09",
      timeZone: "Asia/Seoul",
      nowIso: "2026-09-09T02:00:00.000Z",
      fetchLegacy: async () => ({ completeCount: 40, todayCount: 0, days: [] }),
    });
    expect(later.stats.initialCompletionCount).toBe(0);
  });
});
