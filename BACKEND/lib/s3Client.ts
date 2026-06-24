// lib/s3Client.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.SUPABASE_S3_ENDPOINT,
  region: process.env.SUPABASE_S3_REGION,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string = "image/png"
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.SUPABASE_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  // Return PUBLIC URL format, NOT S3 endpoint
   const projectRef = "gsqlirsxlzvyoyetduet"; // Your project ref
  return `https://${projectRef}.supabase.co/storage/v1/object/public/${process.env.SUPABASE_S3_BUCKET}/${key}`;
}