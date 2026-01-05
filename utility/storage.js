import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { pipeline } from "stream/promises";
import fs from "fs";
import path from "path";
import { S3_CONFIG } from "./config.js";

const s3 = new S3Client(S3_CONFIG);

export async function uploadToStorage(filePath, destinationKey, contentType = 'video/mp4') {
    try {
        const fileStream = fs.createReadStream(filePath);
        
        const parallelUploads3 = new Upload({
            client: s3,
            params: {
                Bucket: S3_CONFIG.bucketName,
                Key: destinationKey,
                Body: fileStream,
                ContentType: contentType,
            },
        });

        console.log(`[Storage] Uploading ${destinationKey} to cloud...`);
        
        parallelUploads3.on("httpUploadProgress", (progress) => {
            console.log(progress);
        });

        await parallelUploads3.done();
        console.log(`[Storage] Upload complete: ${destinationKey}`);
        
        return destinationKey;
    } catch (error) {
        console.error("[Storage] Upload failed:", error);
        throw error;
    }
}

export async function downloadFromStorage(fileKey, downloadPath) {
    try {
        console.log(`[Storage] Downloading ${fileKey}...`);
        const command = new GetObjectCommand({
            Bucket: S3_CONFIG.bucketName,
            Key: fileKey,
        });

        const response = await s3.send(command);
        const dir = path.dirname(downloadPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const writer = fs.createWriteStream(downloadPath);
        await pipeline(response.Body, writer);
        console.log(`[Storage] Downloaded to: ${downloadPath}`);
        return downloadPath;
    } catch (error) {
        console.error(`[Storage] Failed to download ${fileKey}:`, error);
        throw error;
    }
}

export async function deleteFromStorage(fileKey) {
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: S3_CONFIG.bucketName,
            Key: fileKey,
        }));
        console.log(`[Storage] Deleted remote file: ${fileKey}`);
    } catch (error) {
        console.error(`[Storage] Failed to delete ${fileKey}:`, error);
    }
}

export function getPublicUrl(fileKey) {
    if (S3_CONFIG.publicUrl) {
        return `${S3_CONFIG.publicUrl}/${fileKey}`;
    }
    return `${S3_CONFIG.endpoint}/${S3_CONFIG.bucketName}/${fileKey}`;
}