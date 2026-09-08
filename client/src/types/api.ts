export type SessionStatus = 'open' | 'closed';
export type SelectionType = 'single' | 'multi';

export interface ItemOptionSnapshot {
  group: string;
  name: string;
  delta_cents: number;
}

export interface Item {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  dish_id: string | null;
  dish: string;
  note: string;
  // Unit price; the line total is price_cents * quantity.
  price_cents: number | null;
  quantity: number;
  options: ItemOptionSnapshot[] | null;
  added_at: string;
  paid_at: string | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  restaurant_id: string | null;
  restaurant_name: string;
  // Legacy free-text deadline (old sessions only). New sessions use deadline_at.
  deadline: string;
  // ISO-8601 UTC ("...Z") or null.
  deadline_at: string | null;
  auto_closed: boolean;
  creator_id: string;
  creator_name: string;
  creator_iban: string;
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
  paid_by_user_id: string | null;
  paid_by_user_name: string;
  paid_by_iban: string;
  discount_cents: number;
  discount_label: string;
  items_count: number | null;
  total_cents: number | null;
  // List-only payment progress; null on the single-session endpoint.
  priced_items_count: number | null;
  paid_items_count: number | null;
}

export interface Session extends SessionSummary {
  items: Item[];
}

export interface SessionsListResponse {
  sessions: SessionSummary[];
}

export interface DishOption {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  sort_order: number;
}

export interface DishOptionGroup {
  id: string;
  dish_id: string;
  name: string;
  selection_type: SelectionType;
  // For 'multi': max number of options selectable (null = unlimited).
  max_select: number | null;
  sort_order: number;
  options: DishOption[];
}

export interface Dish {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  description: string;
  base_price_cents: number;
  is_vegetarian: boolean;
  sort_order: number;
  option_groups: DishOptionGroup[];
}

export interface RestaurantSummary {
  id: string;
  name: string;
  dish_count: number;
  created_at: string;
}

export interface Restaurant {
  id: string;
  workspace_id: number;
  name: string;
  created_at: string;
  dishes: Dish[];
}

export interface CreateSessionInput {
  user_id: string;
  user_name: string;
  title: string;
  restaurant_id?: string | null;
  restaurant_name?: string;
  deadline?: string;
  deadline_at?: string | null;
  creator_iban?: string;
}

export interface UpdateSessionInput {
  user_id: string;
  title?: string;
  restaurant_id?: string | null;
  restaurant_name?: string;
  deadline?: string;
  deadline_at?: string | null;
  creator_iban?: string;
  status?: SessionStatus;
  paid_by_user_id?: string | null;
  paid_by_user_name?: string;
  paid_by_iban?: string;
  discount_cents?: number;
  discount_label?: string;
}

export interface DeleteSessionInput {
  user_id: string;
}

export interface AddFreeTextItemInput {
  user_id: string;
  user_name: string;
  dish: string;
  note?: string;
  price_cents?: number | null;
  quantity?: number;
}

export interface AddStructuredItemInput {
  user_id: string;
  user_name: string;
  dish_id: string;
  option_ids: string[];
  note?: string;
  quantity?: number;
}

export type AddItemInput = AddFreeTextItemInput | AddStructuredItemInput;

export interface UpdateItemInput {
  user_id: string;
  dish?: string;
  note?: string;
  price_cents?: number | null;
  quantity?: number;
  paid?: boolean;
}

export interface DeleteItemInput {
  user_id: string;
}

export interface MenuOptionInput {
  id?: string;
  name: string;
  price_delta_cents: number;
}

export interface MenuOptionGroupInput {
  id?: string;
  name: string;
  selection_type: SelectionType;
  max_select?: number | null;
  options: MenuOptionInput[];
}

export interface MenuDishInput {
  id?: string;
  name: string;
  category?: string;
  description?: string;
  base_price_cents: number;
  is_vegetarian?: boolean;
  option_groups: MenuOptionGroupInput[];
}

export interface MenuReplaceInput {
  dishes: MenuDishInput[];
}

// Workspace-scoped option group templates (saved option groups that can be
// inserted into any dish in the same workspace).
export interface OptionTemplateOption {
  id: string;
  name: string;
  price_delta_cents: number;
  sort_order: number;
}

export interface OptionTemplate {
  id: string;
  name: string;
  selection_type: SelectionType;
  created_at: string;
  options: OptionTemplateOption[];
}

export interface CreateOptionTemplateInput {
  name: string;
  selection_type: SelectionType;
  options: { name: string; price_delta_cents: number }[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
