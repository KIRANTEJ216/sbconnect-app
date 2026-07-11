export const SUPER_ADMIN_EMAILS = [
  'kktej3d@gmail.com',
]

export const ADMIN_EMAILS = [
  'kktej3d@gmail.com',
]

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim())
}

export function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim())
}

/** Admin + Super Admin can VIEW the admin panel */
export function isAdminViewer(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** Only Super Admin can WRITE (edit/delete/modify) */
export function isSuperAdminRole(role: string | undefined): boolean {
  return role === 'super_admin';
}

export function isAdmin(email: string | null | undefined, role: string | undefined): boolean {
  if (role === 'admin' || role === 'super_admin') return true;
  if (email && ADMIN_EMAILS.includes(email.toLowerCase().trim())) return true;
  return false;
}

export function isSuperAdmin(email: string | null | undefined, role: string | undefined): boolean {
  if (role === 'super_admin') return true;
  if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim())) return true;
  return false;
}
