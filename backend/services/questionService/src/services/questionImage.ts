// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT‑4 Turbo), date: 2026‑04-16
// Scope: Generated appropriate signed url options for generateUploadUrl
// Author review: I validated that the options were correct
// reference:
// - https://docs.cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4#storage_generate_signed_url_v4-nodejs
// I copied the example from the official documentations for the getSignedUrl function, only changed the bucket name.
import { Storage } from "@google-cloud/storage";

const storage = new Storage({
    keyFilename: process.env.GOOGLE_IMAGE_BUCKET,
});

const bucketName = "question-image";

export async function generateUploadUrl(fileName: string, contentType: string) {
    const file = storage.bucket(bucketName).file(fileName);

    // Generate a signed URL for uploading a file
    const [url] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 5 * 60 * 1000,
        contentType,
    });

    return {
        uploadUrl: url,
        filePath: fileName,
    };
}

export async function getSignedImageUrl(filename: string) {
    const options = {
        version: "v4" as const,
        action: "read" as const,
        expires: Date.now() + 15 * 60 * 1000,
    };

    const [url] = await storage.bucket("question-image").file(filename).getSignedUrl(options);

    return url;
}

export async function deleteImage(fileName: string) {
    try {
        await storage.bucket(bucketName).file(fileName).delete();

        console.log(`Deleted image: ${fileName}`);
        return true;
    } catch (err) {
        console.error("Failed to delete image:", err);
        return false;
    }
}
