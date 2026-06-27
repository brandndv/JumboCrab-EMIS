export interface RawSessionData {
  userId?: string;
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  switchAccount?: {
    userId: string;
    role: string;
    label: string;
    href: string;
  } | null;
  employee?: unknown;
  isLoggedIn: boolean;
  isDisabled?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
