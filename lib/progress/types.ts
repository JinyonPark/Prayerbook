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

export type CompletePrayerResult = {
  prayer_item_id?: string;
  history_code?: string;
  completion_count?: number;
  previous_count?: number;
  previous_total: number;
  current_total: number;
  total_completed: number;
  total_changed: boolean;
  current_round: number;
  current_completed_count: number;
  eligible_count?: number;
  progress_percent: number;
  today_completion_count?: number;
  today_unique_prayer_count?: number;
  lifetime_completion_count?: number;
  operation_id: string | null;
  request_id?: string;
  affected_items: RpcAffectedItem[];
  idempotent?: boolean;
  spouse_prayer_selection?: "husband" | "wife" | null;
  items?: RpcProgressItem[];
};

export type RpcMutationResult = Omit<RpcProgressSummary, "items"> &
  CompletePrayerResult & {
    items?: RpcProgressItem[];
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
  auto_scroll_enabled?: boolean;
  conceived_show_all_names?: boolean;
  time_zone?: string;
  share_selected_fields?: {
    today?: boolean;
    lifetime?: boolean;
    total?: boolean;
    progress?: boolean;
  } | null;
  share_custom_template?: string | null;
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
