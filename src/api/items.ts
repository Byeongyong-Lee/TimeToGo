import { api } from '@/api/client';
import type { Item, Paginated } from '@/types/api';

/** 서버 리소스 예시. 실제 엔드포인트에 맞춰 바꿔 쓰세요. */
export const itemsApi = {
  async list(page = 1): Promise<Paginated<Item>> {
    const res = await api.get<Paginated<Item>>('/items', { params: { page } });
    return res.data;
  },

  async detail(id: string): Promise<Item> {
    const res = await api.get<Item>(`/items/${id}`);
    return res.data;
  },
};
