import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.SUPABASE_S3_ENDPOINT,
  region: process.env.SUPABASE_S3_REGION,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for Supabase S3
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

  return `${process.env.SUPABASE_S3_ENDPOINT}/${process.env.SUPABASE_S3_BUCKET}/${key}`;
}