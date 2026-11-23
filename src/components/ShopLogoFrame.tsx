import React, { useRef } from 'react';
import { Camera } from 'lucide-react';

interface ShopLogoFrameProps {
  logoUrl: string | null;
  onUpdateLogo: (dataUrl: string) => void;
}

export const ShopLogoFrame: React.FC<ShopLogoFrameProps> = ({ logoUrl, onUpdateLogo }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Crop square from center
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        onUpdateLogo(compressed);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      title="คลิกเพื่อเปลี่ยนรูปโลโก้ร้าน"
      className="group relative w-[52px] h-[52px] shrink-0 rounded-2xl border-2 overflow-hidden flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: 'var(--accent-soft)',
        borderColor: 'var(--accent-border)',
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="โลโก้ร้าน กุ๊กกิ๊กพาเพลิน"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-2xl leading-none" aria-hidden="true">
          🐻
        </span>
      )}
      <span
        className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
        aria-hidden="true"
      >
        <Camera className="w-4 h-4" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </button>
  );
};
