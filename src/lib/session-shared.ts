export interface RawSessionData {
  userId?: string;
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  employee?: unknown;
  isLoggedIn: boolean;
  isDisabled?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
