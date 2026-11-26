export async function compressProductImageFile(file: File, targetSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid file data'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        let dim = targetSize;
        let dataUrl = '';
        while (dim >= 140) {
          canvas.width = dim;
          canvas.height = dim;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, dim, dim);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, dim, dim);

          let quality = 0.78;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          // Keep well under localStorage & Google Sheets 50k cell limit (~38KB max)
          while (dataUrl.length > 38000 && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length <= 38000) break;
          dim = Math.round(dim * 0.75);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressMemoryPhotoFile(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read photo file'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid file data'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.fillStyle = '#FAF6F0';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let quality = 0.84;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 180000 && quality > 0.4) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressSlipImageFile(file: File, maxDim = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read slip image file'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid file data'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        let dimScale = 1;
        let dataUrl = '';
        while (dimScale >= 0.5) {
          const w = Math.max(1, Math.round(targetW * dimScale));
          const h = Math.max(1, Math.round(targetH * dimScale));
          canvas.width = w;
          canvas.height = h;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          let quality = 0.78;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          // Keep safely below Google Sheets 50k char cell limit and fast in localStorage
          while (dataUrl.length > 40000 && quality > 0.3) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length <= 40000) break;
          dimScale -= 0.15;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

