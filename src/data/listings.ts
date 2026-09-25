import { supabase } from "../lib/supabase";
import { getCurrentUserId } from "../auth/session";

export type ListingStatus = "draft" | "pending_review" | "approved" | "rejected" | "sold" | "withdrawn";
export type PropertyType = "apartment" | "villa" | "land" | "commercial" | "other";

export interface Listing {
  id: string;
  owner_id: string;
  status: ListingStatus;
  title: string;
  description: string | null;
  city: string | null;
  district: string | null;
  address_line: string | null;
  property_type: PropertyType | null;
  size_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  asking_price: number | null;
  currency: string;
  original_purchase_year: number | null;
  title_deed_number: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ListingPhoto {
  id: string;
  listing_id: string;
  storage_path: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface NewListingInput {
  title: string;
  description: string;
  city: string;
  district: string;
  address_line: string;
  property_type: PropertyType;
  size_m2: number;
  bedrooms: number;
  bathrooms: number;
  asking_price: number;
  currency: string;
  original_purchase_year: number;
}

export function listingPhotoUrl(storagePath: string): string {
  return supabase.storage.from("listing-photos").getPublicUrl(storagePath).data.publicUrl;
}

export async function fetchApprovedListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Listing[];
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Listing | null;
}

export async function fetchMyListings(): Promise<Listing[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Listing[];
}

export async function fetchPendingListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Listing[];
}

export async function createDraftListing(input: NewListingInput): Promise<Listing> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("listings")
    .insert({ ...input, owner_id: userId, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Listing;
}

export async function updateListing(id: string, patch: Partial<NewListingInput>): Promise<void> {
  const { error } = await supabase.from("listings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function submitForReview(id: string): Promise<void> {
  const { error } = await supabase.from("listings").update({ status: "pending_review" }).eq("id", id);
  if (error) throw error;
}

export async function withdrawListing(id: string): Promise<void> {
  const { error } = await supabase.from("listings").update({ status: "withdrawn" }).eq("id", id);
  if (error) throw error;
}

export async function approveListing(id: string): Promise<void> {
  const adminId = getCurrentUserId();
  const { error } = await supabase
    .from("listings")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: adminId })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectListing(id: string, reason: string): Promise<void> {
  const adminId = getCurrentUserId();
  const { error } = await supabase
    .from("listings")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId
    })
    .eq("id", id);
  if (error) throw error;
}

/** First (lowest sort_order) photo path per listing id, for row/card thumbnails. */
export async function fetchCoverPhotos(listingIds: string[]): Promise<Record<string, string>> {
  if (listingIds.length === 0) return {};
  const { data, error } = await supabase
    .from("listing_photos")
    .select("*")
    .in("listing_id", listingIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const photo of data as ListingPhoto[]) {
    if (!(photo.listing_id in map)) map[photo.listing_id] = photo.storage_path;
  }
  return map;
}

export async function fetchListingPhotos(listingId: string): Promise<ListingPhoto[]> {
  const { data, error } = await supabase
    .from("listing_photos")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as ListingPhoto[];
}

export async function uploadListingPhoto(listingId: string, file: File, sortOrder: number): Promise<ListingPhoto> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${listingId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("listing-photos").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("listing_photos")
    .insert({ listing_id: listingId, storage_path: path, sort_order: sortOrder, is_cover: sortOrder === 0 })
    .select("*")
    .single();
  if (error) throw error;
  return data as ListingPhoto;
}

export async function deleteListingPhoto(photo: ListingPhoto): Promise<void> {
  await supabase.storage.from("listing-photos").remove([photo.storage_path]);
  const { error } = await supabase.from("listing_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

export interface InquiryInput {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export async function submitInquiry(listingId: string, input: InquiryInput): Promise<void> {
  const { error } = await supabase.from("listing_inquiries").insert({ listing_id: listingId, ...input });
  if (error) throw error;
}
