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
