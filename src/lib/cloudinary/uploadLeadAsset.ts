import { getCloudinary } from "@/lib/cloudinary";

export type LeadAssetUploadResult = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

type CloudinaryUploadApiResult = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

/**
 * Upload a lead intake asset to Cloudinary server-side (signed).
 * Files go to: Sublime/IntakeLeads/<leadId>/
 */
export async function uploadLeadAssetToCloudinary(
  fileBuffer: Buffer,
  leadId: string,
  resourceType: "image" | "video" = "image",
): Promise<LeadAssetUploadResult> {
  let cloudinary;
  try {
    cloudinary = getCloudinary();
  } catch (err) {
    console.error("[uploadLeadAsset] Cloudinary config failed:", err instanceof Error ? err.message : err);
    throw err;
  }

  const folder = `Sublime/IntakeLeads/${leadId}`;

  const result = await new Promise<CloudinaryUploadApiResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        tags: [`intake-lead:${leadId}`],
      },
      (error, result) => {
        if (error || !result) {
          console.error("[uploadLeadAsset] Cloudinary upload failed:", error instanceof Error ? error.message : error);
          return reject(error ?? new Error("Upload failed — no result returned"));
        }
        resolve(result as CloudinaryUploadApiResult);
      },
    );
    uploadStream.end(fileBuffer);
  });

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}
