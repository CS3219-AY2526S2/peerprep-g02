import { Storage } from "@google-cloud/storage";
import path from "node:path";

const storage = new Storage({
    keyFilename: process.env.GOOGLE_BUCKET,
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

    const [url] = await storage
        .bucket("question-image")
        .file(filename)
        .getSignedUrl(options);

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