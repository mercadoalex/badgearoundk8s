import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { Badge } from '../types';

const s3Client = new S3Client({ region: 'us-west-2' });

export async function uploadBadgeFiles(badge: Badge, pngFilePath: string, pdfFilePath: string) {
  const files = [
    { key: `${badge.keyCode}.png`, body: fs.readFileSync(pngFilePath), contentType: 'image/png' },
    { key: `${badge.keyCode}.pdf`, body: fs.readFileSync(pdfFilePath), contentType: 'application/pdf' }
  ];

  for (const file of files) {
    const command = new PutObjectCommand({
      Bucket: 'digital-badge-bucket',
      Key: file.key,
      Body: file.body,
      ContentType: file.contentType,
    });

    try {
      await s3Client.send(command);
      console.log(`Uploaded ${file.key} to S3 successfully`);
    } catch (error) {
      console.error(`Error uploading ${file.key} to S3:`, error);
      throw error;
    }
  }
}