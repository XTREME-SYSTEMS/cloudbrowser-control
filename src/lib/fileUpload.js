import { base44 } from '@/api/base44Client';

// Frontend file upload helper — routes through the uploadFileGateway backend function
// to Vercel Blob storage, bypassing Base44 integration credits.

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Drop-in replacement for base44.integrations.Core.UploadFile
export async function uploadFile(file) {
  const base64 = await fileToBase64(file);
  const res = await base44.functions.invoke('uploadFileGateway', {
    action: 'upload',
    file_data: base64,
    filename: file.name,
    content_type: file.type,
  });
  return res.data;
}

// Drop-in replacement for base44.integrations.Core.UploadPublicFile
export async function uploadPublicFile(file) {
  const base64 = await fileToBase64(file);
  const res = await base44.functions.invoke('uploadFileGateway', {
    action: 'upload_public',
    file_data: base64,
    filename: file.name,
    content_type: file.type,
  });
  return res.data;
}

// Drop-in replacement for base44.integrations.Core.UploadPrivateFile
export async function uploadPrivateFile(file) {
  const base64 = await fileToBase64(file);
  const res = await base44.functions.invoke('uploadFileGateway', {
    action: 'upload_private',
    file_data: base64,
    filename: file.name,
    content_type: file.type,
  });
  return res.data;
}