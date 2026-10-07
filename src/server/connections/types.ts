/** One person as a directory reports them, before we store them. */
export interface DirectoryUser {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  phone: string;
  mobile: string;
  location: string;
  groups: string[];
  /** False when suspended, archived or disabled. */
  active: boolean;
  /** Extra attributes custom fields can be filled from, by name. */
  attributes: Record<string, string>;
}

/** One line of a connection's health check. */
export interface HealthItem {
  key: string;
  label: string;
  ok: boolean;
  /** What is working, or exactly what to do about it. */
  message: string;
}

export interface DirectoryClient {
  listUsers(): Promise<DirectoryUser[]>;
}
