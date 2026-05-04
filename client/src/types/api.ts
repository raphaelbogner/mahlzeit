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
  price_cents: number | null;
  options: ItemOptionSnapshot[];
  added_at: string;
}

export interface Session {
  id: string;
  workspace_id: number;
  title: string;
  restaurant_id: string | null;
  restaurant_name: string;
  deadline: string;
  creator_id: string;
  creator_name: string;
  creator_iban: string;
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
  items: Item[];
}

export interface SessionSummary {
  id: string;
  title: string;
  restaurant_name: string;
  deadline: string;
  creator_id: string;
  creator_name: string;
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
  item_count: number;
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
  sort_order: number;
  options: DishOption[];
}

export interface Dish {
  id: string;
  restaurant_id: string;
  name: string;
  base_price_cents: number;
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
  title: string;
  restaurant_id?: string | null;
  restaurant_name?: string;
  deadline?: string;
  creator_id: string;
  creator_name: string;
  creator_iban?: string;
}

export interface UpdateSessionInput {
  title?: string;
  restaurant_id?: string | null;
  restaurant_name?: string;
  deadline?: string;
  status?: SessionStatus;
}

export interface AddFreeTextItemInput {
  user_id: string;
  user_name: string;
  dish: string;
  note?: string;
  price_cents?: number | null;
}

export interface AddStructuredItemInput {
  user_id: string;
  user_name: string;
  dish_id: string;
  option_ids: string[];
  note?: string;
}

export type AddItemInput = AddFreeTextItemInput | AddStructuredItemInput;

export interface UpdateItemInput {
  dish?: string;
  note?: string;
  price_cents?: number | null;
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
  options: MenuOptionInput[];
}

export interface MenuDishInput {
  id?: string;
  name: string;
  base_price_cents: number;
  option_groups: MenuOptionGroupInput[];
}

export interface MenuReplaceInput {
  dishes: MenuDishInput[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
