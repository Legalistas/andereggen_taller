import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente S3 apuntando al MinIO de `static.legalistas.com.ar`.
 * Las fotos que el cliente sube desde el formulario web del landing se guardan
 * en este bucket bajo `andereggen/<slug-cliente>/`. El backoffice usa este
 * cliente para listar esas fotos cuando se abre el canvas del lead.
 */
export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "https://static.legalistas.com.ar",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
  },
});

export const BUCKET = process.env.S3_BUCKET ?? "";

export const PUBLIC_BASE_URL = "https://static.legalistas.com.ar";

export function publicUrlFor(key: string): string {
  return `${PUBLIC_BASE_URL}/${BUCKET}/${key}`;
}
