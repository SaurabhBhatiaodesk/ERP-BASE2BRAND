import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary (inline credentials)
cloudinary.config({
  cloud_name: "djyl2qvdc", // ← your cloud name
  api_key: "877661512152286", // ← your API key
  api_secret: "5XLPLzndoMSddHxb_WGx5Dau3bg", // ← your API secret
});

const sampleImageUrl =
  "https://res.cloudinary.com/demo/image/upload/sample.jpg";

async function main() {
  console.log("Uploading sample image from Cloudinary demo...\n");

  const uploadResult = await cloudinary.uploader.upload(sampleImageUrl);

  console.log("Upload successful!");
  console.log("Secure URL:", uploadResult.secure_url);
  console.log("Public ID:", uploadResult.public_id);
  console.log();

  console.log("Fetching image details...\n");

  const details = await cloudinary.api.resource(uploadResult.public_id);

  console.log("Width:", details.width, "px");
  console.log("Height:", details.height, "px");
  console.log("Format:", details.format);
  console.log("File size:", details.bytes, "bytes");
  console.log();

  // f_auto — Cloudinary picks the best format for the browser (e.g. WebP instead of JPEG)
  // q_auto — Cloudinary optimizes quality vs file size automatically
  const transformedUrl = cloudinary.url(uploadResult.public_id, {
    secure: true,
    transformation: [{ fetch_format: "auto", quality: "auto" }],
  });

  console.log(
    "Done! Click link below to see optimized version of the image. Check the size and the format."
  );
  console.log("Transformed URL:", transformedUrl);
}

main().catch(err => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
