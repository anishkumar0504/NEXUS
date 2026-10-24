// lib/s3Client.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

// Reads env at call time (after dotenv has loaded). Accepts the AWS_* / S3_* names,
// and falls back to the SUPABASE_S3_* names.
function cfg() {
  return {
    endpoint: process.env.S3_ENDPOINT || process.env.SUPABASE_S3_ENDPOINT || undefined,
    region: process.env.AWS_REGION || process.env.SUPABASE_S3_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.SUPABASE_S3_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY || process.env.SUPABASE_S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET_NAME || process.env.SUPABASE_S3_BUCKET,
  };
}

function getClient(): S3Client {
  if (!client) {
    const c = cfg();
    if (!c.accessKeyId || !c.secretAccessKey) {
      throw new Error("Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env");
    }
    client = new S3Client({
      region: c.region,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      // Endpoint set  => Supabase Storage (S3-compatible).  Not set => real AWS S3.
      ...(c.endpoint ? { endpoint: c.endpoint, forcePathStyle: true } : {}),
    });
  }
  return client;
}

function contentTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string = contentTypeFromKey(key)
): Promise<string> {
  const c = cfg();
  if (!c.bucket) throw new Error("S3_BUCKET_NAME is not set in .env");

  // No ACL: Supabase ignores S3 ACLs and new AWS buckets disable them.
  // Public access comes from the bucket's public setting / bucket policy.
  await getClient().send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  if (c.endpoint) {
    // Supabase public URL, built from the same project as the endpoint
    const origin = new URL(c.endpoint).origin;
    return `${origin}/storage/v1/object/public/${c.bucket}/${key}`;
  }
  // Real AWS S3 (bucket must allow public reads via bucket policy)
  return `https://${c.bucket}.s3.${c.region}.amazonaws.com/${key}`;
}