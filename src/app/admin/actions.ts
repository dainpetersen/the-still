"use server";

import { revalidatePath } from "next/cache";
import { reviewSubmission } from "@/lib/supabase";

export async function approveSubmission(id: string) {
  await reviewSubmission(id, "approved");
  revalidatePath("/admin");
}

export async function rejectSubmission(id: string, note?: string) {
  await reviewSubmission(id, "rejected", note);
  revalidatePath("/admin");
}
