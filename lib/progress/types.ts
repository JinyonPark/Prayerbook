export type RpcAffectedItem = {
  prayer_item_id: string;
  before_count: number;
  after_count: number;
};

export type RpcProgressItem = {
  prayer_item_id: string;
  slug: string;
  title: string;
  item_number: number | null;
  category: "main" | "supplementary";
  counts_toward_total: boolean;
  display_order: number;
  completion_count: number;
  is_completed_in_current_round: boolean | null;
  excluded_from_progress?: boolean;
};

export type RpcProgressSummary = {
  total_completed: number;
  current_round: number;
  current_completed_count: number;
  progress_percent: number;
  eligible_count?: number;
  spouse_prayer_selection?: "husband" | "wife" | null;
  items: RpcProgressItem[];
};

export type RpcMutationResult = RpcProgressSummary & {
  operation_id: string;
  affected_items: RpcAffectedItem[];
  total_changed: boolean;
  previous_total: number;
  current_total: number;
  idempotent?: boolean;
};

export type ReadingState = {
  last_prayer_item_id: string | null;
  scroll_ratio: number;
  anchor_key?: string | null;
  anchor_offset?: number | null;
  last_opened_at: string | null;
  updated_at: string | null;
};

export type UserPreferences = {
  theme: "day" | "night";
  font_size: "small" | "default" | "large" | "xlarge";
  line_height: "compact" | "comfortable" | "spacious";
  spouse_prayer_selection?: "husband" | "wife" | null;
  auto_scroll_speed?: "slow" | "normal" | "fast";
  time_zone?: string;
};

export type HistoryOperation = {
  id: string;
  operation_type: string;
  created_at: string;
  items: Array<{
    prayer_item_id: string;
    title: string;
    item_number: number | null;
    before_count: number;
    after_count: number;
  }>;
};
