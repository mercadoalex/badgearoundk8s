import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export async function generateBadgeFiles(badge: Badge): Promise<{ pngFilePath: string, pdfFilePath: string }> {
  const pngFilePath = path.join(__dirname, 'badges', `${badge.keyCode}.png`);
  const pdfFilePath = path.join(__dirname, 'badges', `${badge.keyCode}.pdf`);

  // Generate PNG file (placeholder logic)
  fs.writeFileSync(pngFilePath, 'PNG file content');

  // Generate PDF file
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(pdfFilePath));
  doc.text(`Badge for ${badge.firstName} ${badge.lastName}`);
  doc.end();

  return { pngFilePath, pdfFilePath };
}