export type PlatformRole = 'platform_owner' | 'platform_admin' | 'platform_support';
export type OrganizationStatus = 'provisioning' | 'active' | 'suspended' | 'archived';

export interface PlatformOrganizationAdmin {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
}

export interface PlatformPendingInvite {
  id: string;
  email: string;
  expiresAt: string;
  status: string;
}

export interface PlatformOrganizationMetrics {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: string;
  adminCount: number;
  coupleCount: number;
  guestCount: number;
  rsvpCount: number;
  pendingInviteCount: number;
}

export interface PlatformConsoleMetrics {
  totalVenues: number;
  activeVenues: number;
  suspendedVenues: number;
  provisioningVenues: number;
  pendingInvites: number;
  activeAdmins: number;
  totalCouples: number;
  totalGuests: number;
  totalRsvps: number;
  venues: PlatformOrganizationMetrics[];
}

export interface PlatformAuditLogEntry {
  id: string;
  platformUserId: string;
  actorEmail: string;
  actorName: string;
  organizationId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  ownerId?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  primaryContactName?: string | null;
  primaryContactPhone?: string | null;
  primaryContactEmail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  admins: PlatformOrganizationAdmin[];
  pendingInvite?: PlatformPendingInvite;
}
