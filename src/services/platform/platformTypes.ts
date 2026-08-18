export type PlatformRole = 'platform_owner' | 'platform_admin' | 'platform_support';

export interface PlatformOrganizationAdmin {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
}

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  ownerId?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  admins: PlatformOrganizationAdmin[];
}
