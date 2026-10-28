export function fmtIp(ip: string): string {
  if (!ip || ip === '0.0.0.0') return '00.00.00.00';
  return ip.split('.').map(seg => seg.padStart(2, '0')).join('.');
}

export const compressAndEncodeImage = (file: File, maxDimension = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        const b64 = canvas.toDataURL('image/jpeg', 0.65);
        // Reject if result exceeds 200KB — prevents DB bloat
        const MAX_BYTES = 200 * 1024;
        if (b64.length > MAX_BYTES) {
          reject(new Error('Image too large after compression. Please use a smaller image (max ~200KB).'));
          return;
        }
        resolve(b64);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
    };
    reader.onerror = reject;
  });
};
