export interface Vendor {
  id: string;
  name: string;
  /** Dynamic category id (see vendorCategoryService.getVendorCategories). */
  category: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  notes?: string;
  rating?: number; // 1-5 stars
  isPreferred?: boolean;
  /** Short description shown in the venue's preferred-vendor showcase. */
  description?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Kept for backward-compat with backup/import reading old records; not used for new UI. */
export interface VendorPayment {
  id: string;
  vendorId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  description: string;
  isPaid: boolean;
}
