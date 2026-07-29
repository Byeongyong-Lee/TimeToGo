/** 서버 공통 응답/도메인 타입 */

export type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

export type User = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = AuthTokens & {
  user: User;
};

export type Item = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  hasNext: boolean;
};
