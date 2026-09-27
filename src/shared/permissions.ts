/**
 * The single list of grantable permissions, shared by the API (route guards)
 * and the React app (menu, page guards, Settings editor). Add a feature here
 * once and both sides pick it up.
 */

export const FUNCTIONALITIES = [
  { id: 'stock', name: 'Gestion du Stock' },
  { id: 'customers', name: 'Fichier Clients (KYC)' },
  { id: 'sales', name: 'Enregistrement des Ventes' },
  { id: 'orders', name: 'Commandes Spéciales' },
  { id: 'odf', name: 'Trade-ins (ODF)' },
  { id: 'reports', name: 'Rapports' },
] as const;

export type Functionality = (typeof FUNCTIONALITIES)[number]['id'];
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface PermissionRow {
  functionality: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface PermissionSubject {
  role: string;
  permissions?: PermissionRow[];
}

const FLAG: Record<PermissionAction, keyof Omit<PermissionRow, 'functionality'>> = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
};

export function hasPermission(
  subject: PermissionSubject | null | undefined,
  functionality: Functionality,
  action: PermissionAction = 'view',
): boolean {
  if (!subject) return false;
  if (subject.role === 'Admin') return true;
  const row = subject.permissions?.find(p => p.functionality === functionality);
  return !!row?.[FLAG[action]];
}

export type Requirement = readonly [Functionality, PermissionAction];

/** Permission needed to open each page. Pages not listed only need a login. */
export const PAGE_ACCESS: Record<string, Requirement> = {
  '/stock': ['stock', 'view'],
  '/stock/sold': ['stock', 'view'],
  '/customers': ['customers', 'view'],
  '/sales': ['sales', 'create'],
  '/sales-history': ['sales', 'view'],
  '/orders': ['orders', 'view'],
  '/odf': ['odf', 'view'],
  '/reports': ['reports', 'view'],
  '/reports/discounts': ['reports', 'view'],
};
