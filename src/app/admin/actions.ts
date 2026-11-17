"use server";

import { revalidatePath } from "next/cache";
import { reviewSubmission, reviewSubmissions } from "@/lib/supabase";

export async function approveSubmission(id: string) {
  await reviewSubmission(id, "approved");
  revalidatePath("/admin");
}

/** The weekly release review: add the ticked bottles, discard the rest. */
export async function reviewReleases(approveIds: string[], rejectIds: string[]) {
  await reviewSubmissions(approveIds, "approved");
  await reviewSubmissions(rejectIds, "rejected", "Not added at release review");
  revalidatePath("/admin");
}

export async function rejectSubmission(id: string, note?: string) {
  await reviewSubmission(id, "rejected", note);
  revalidatePath("/admin");
}
