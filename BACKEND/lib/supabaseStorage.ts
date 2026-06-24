import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const BUCKET_NAME = "nexus-images";

export async function uploadImageToSupabase(
  imageBuffer: Buffer | ArrayBuffer,
  fileName: string,
  contentType: string = "image/png"
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, imageBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  // Get public URL
  const { data: publicUrl } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}