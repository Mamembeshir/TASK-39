const DISPUTE_STAFF_ROLES = ['administrator', 'service_manager', 'moderator'];

export function canManageTicketDisputes(roles: string[]) {
  return DISPUTE_STAFF_ROLES.some((role) => roles.includes(role));
}
