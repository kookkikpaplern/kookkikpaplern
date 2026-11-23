import React from 'react';
import {
  ApronStyle,
  BagStyle,
  BowStyle,
  FancyStyle,
  GlassesStyle,
  HairStyle,
  HatStyle,
} from '../config/bearOutfits';

interface HeadCoord {
  cx: number;
  cy: number;
  scale?: number;
}

export const HairLayer: React.FC<HeadCoord & { styleType: HairStyle }> = ({
  cx,
  cy,
  scale = 1,
  styleType,
}) => {
  if (styleType === 'none') return null;

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      {styleType === 'default' && (
        <path
          d="M-6 -29 C-8 -21, 4 -18, 7 -25"
          stroke="#7A5F4E"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {styleType === 'curly' && (
        <g>
          <path
            d="M-24 -28 C-20 -40, -6 -42, 0 -33 C6 -42, 22 -40, 25 -27 C17 -22, 9 -25, 0 -22 C-9 -25, -17 -21, -24 -28 Z"
            fill="#6D4F3D"
            stroke="#4B3528"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M-12 -32 Q-6 -26 0 -30 Q7 -25 14 -31"
            stroke="#947059"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
      {styleType === 'parted' && (
        <g>
          <path
            d="M-14 -34 Q-5 -18 6 -29 Q0 -38 -14 -34 Z"
            fill="#B8A9F0"
            stroke="#6D5242"
            strokeWidth="2"
          />
          <path
            d="M-6 -32 Q0 -21 8 -28"
            stroke="#85D8CE"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
      {styleType === 'spiky' && (
        <path
          d="M-20 -29 L-12 -45 L-3 -33 L4 -47 L11 -33 L21 -42 L18 -27 Z"
          fill="#5B4639"
          stroke="#3E2E24"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
};

export const GlassesLayer: React.FC<HeadCoord & { styleType: GlassesStyle }> = ({
  cx,
  cy,
  scale = 1,
  styleType,
}) => {
  if (styleType === 'none') return null;

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      {styleType === 'round' && (
        <g>
          <circle cx="-17" cy="0" r="11" fill="rgba(255,255,255,0.22)" stroke="#4B372B" strokeWidth="2.6" />
          <circle cx="17" cy="0" r="11" fill="rgba(255,255,255,0.22)" stroke="#4B372B" strokeWidth="2.6" />
          <path d="M-6 -1 Q0 -4 6 -1" stroke="#4B372B" strokeWidth="2.5" fill="none" />
          <path d="M-28 -1 L-36 -4 M28 -1 L36 -4" stroke="#4B372B" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
      {styleType === 'mint-round' && (
        <g>
          <circle cx="-17" cy="0" r="11" fill="rgba(168,223,201,0.28)" stroke="#3D8B6E" strokeWidth="2.8" />
          <circle cx="17" cy="0" r="11" fill="rgba(168,223,201,0.28)" stroke="#3D8B6E" strokeWidth="2.8" />
          <path d="M-6 -1 Q0 -4 6 -1" stroke="#3D8B6E" strokeWidth="2.6" fill="none" />
          <path d="M-28 -1 L-36 -4 M28 -1 L36 -4" stroke="#3D8B6E" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
      {styleType === 'sunglasses' && (
        <g>
          <rect x="-30" y="-8" width="24" height="15" rx="6" fill="#2A2628" stroke="#181517" strokeWidth="2" />
          <rect x="6" y="-8" width="24" height="15" rx="6" fill="#2A2628" stroke="#181517" strokeWidth="2" />
          <path d="M-6 -2 H6" stroke="#181517" strokeWidth="3" />
          <path d="M-25 -4 L-19 -4 M11 -4 L17 -4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        </g>
      )}
    </g>
  );
};

export const HatLayer: React.FC<HeadCoord & { styleType: HatStyle }> = ({
  cx,
  cy,
  scale = 1,
  styleType,
}) => {
  if (styleType === 'none') return null;

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      {styleType === 'chef-star' && (
        <g transform="translate(0, -30)">
          <path
            d="M-22 6 C-34 -6, -28 -25, -12 -24 C-6 -34, 8 -34, 14 -24 C30 -25, 34 -6, 22 6 Z"
            fill="#FFFFFF"
            stroke="#7A5F4E"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <rect
            x="-23"
            y="2"
            width="46"
            height="11"
            rx="4"
            fill="#F9F6F0"
            stroke="#7A5F4E"
            strokeWidth="2.5"
          />
          <path
            d="M0 -18 L2.8 -12 L9 -11 L4.5 -6.5 L5.6 0 L0 -3.2 L-5.6 0 L-4.5 -6.5 L-9 -11 L-2.8 -12 Z"
            fill="#FFE05D"
            stroke="#C9971A"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </g>
      )}
      {styleType === 'mint-beanie' && (
        <g transform="translate(0, -24)">
          <path
            d="M-36 4 C-34 -26, -8 -34, 14 -30 C34 -26, 40 -8, 38 10 C18 -2, -16 -5, -36 4 Z"
            fill="#98DEC4"
            stroke="#4B7B6B"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M-38 5 C-16 -7, 20 -4, 40 11 C41 16, 36 19, 31 17 C13 6, -15 4, -34 14 C-39 15, -40 8, -38 5 Z"
            fill="#83CFB4"
            stroke="#4B7B6B"
            strokeWidth="2.4"
          />
          <path
            d="M24 -11 L27 -4 L35 -3 L29 2 L30 9 L24 5 L18 9 L19 2 L13 -3 L21 -4 Z"
            fill="#FFE15A"
            stroke="#C79619"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </g>
      )}
      {styleType === 'beret' && (
        <g transform="translate(2, -32) rotate(-8)">
          <ellipse cx="0" cy="0" rx="28" ry="13" fill="#FBE4D8" stroke="#7A5F4E" strokeWidth="2.5" />
          <path d="M0 -13 L3 -19" stroke="#7A5F4E" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {styleType === 'crown' && (
        <g transform="translate(0, -34)">
          <path
            d="M-18 8 L-22 -12 L-8 -2 L0 -16 L8 -2 L22 -12 L18 8 Z"
            fill="#FFE05D"
            stroke="#B48112"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="-2" r="2.8" fill="#F472B6" />
        </g>
      )}
    </g>
  );
};

export const BowLayer: React.FC<HeadCoord & { styleType: BowStyle }> = ({
  cx,
  cy,
  scale = 1,
  styleType,
}) => {
  if (styleType === 'none') return null;

  const isBowTie = styleType === 'gold-bowtie';
  const offset = isBowTie ? { x: 0, y: 31, rot: 0 } : { x: -34, y: -28, rot: -18 };

  const fill =
    styleType === 'pink-polka'
      ? '#F7A7B8'
      : styleType === 'mint-ribbon'
      ? '#98DEC4'
      : '#FFE05D';

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <g transform={`translate(${offset.x}, ${offset.y}) rotate(${offset.rot})`}>
        <path
          d="M0 0 L-15 -9 C-17 -2, -17 8, -13 11 Z"
          fill={fill}
          stroke="#7A5F4E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M0 0 L15 -9 C17 -2, 17 8, 13 11 Z"
          fill={fill}
          stroke="#7A5F4E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {styleType === 'pink-polka' && (
          <>
            <circle cx="-8" cy="1" r="1.5" fill="#FFF6F8" />
            <circle cx="8" cy="1" r="1.5" fill="#FFF6F8" />
          </>
        )}
        <circle cx="0" cy="1" r="4.5" fill="#FFFDF9" stroke="#7A5F4E" strokeWidth="2" />
      </g>
    </g>
  );
};

export const ApronLayer: React.FC<{ cx: number; topY: number; styleType: ApronStyle }> = ({
  cx,
  topY,
  styleType,
}) => {
  if (styleType === 'none') return null;

  const palette =
    styleType === 'denim'
      ? { body: '#3B5478', pocket: '#4B678E', stroke: '#293A54' }
      : styleType === 'mint-chef'
      ? { body: '#8ED8BC', pocket: '#B5EAD6', stroke: '#3E7B64' }
      : { body: '#F7C6AD', pocket: '#FDE0D0', stroke: '#9B5B40' };

  return (
    <g transform={`translate(${cx}, ${topY})`}>
      <path
        d="M-24 0 H24 L29 35 H-29 Z"
        fill={palette.body}
        stroke={palette.stroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <rect
        x="-12"
        y="14"
        width="24"
        height="14"
        rx="3"
        fill={palette.pocket}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      {/* Cute side tie */}
      <path
        d="M-28 22 L-38 17 L-36 26 Z M-28 22 L-39 30 L-31 31 Z"
        fill={palette.body}
        stroke={palette.stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </g>
  );
};

export const BagLayer: React.FC<{ cx: number; topY: number; styleType: BagStyle }> = ({
  cx,
  topY,
  styleType,
}) => {
  if (styleType === 'none') return null;

  return (
    <g transform={`translate(${cx}, ${topY})`}>
      <path d="M-24 2 L32 24" stroke="#6592B8" strokeWidth="4" strokeLinecap="round" />
      {styleType === 'patchwork' && (
        <g transform="translate(18, 9) rotate(-12)">
          <rect x="0" y="0" width="27" height="23" rx="6" fill="#F6A67E" stroke="#6D5242" strokeWidth="2.3" />
          <rect x="4" y="4" width="10" height="9" rx="2" fill="#9BD8F0" />
          <circle cx="20" cy="12" r="4" fill="#FFE066" />
        </g>
      )}
      {styleType === 'delivery-box' && (
        <g transform="translate(16, 7)">
          <rect x="0" y="0" width="30" height="24" rx="5" fill="#5FB894" stroke="#2D6A52" strokeWidth="2.3" />
          <path d="M4 8 H26" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="15" cy="16" r="4" fill="#FFE05D" />
        </g>
      )}
      {styleType === 'tote-mint' && (
        <g transform="translate(18, 9)">
          <rect x="0" y="0" width="25" height="24" rx="5" fill="#B5EAD6" stroke="#3E7B64" strokeWidth="2.3" />
          <path d="M6 0 C6 -7, 19 -7, 19 0" stroke="#3E7B64" strokeWidth="2.2" fill="none" />
        </g>
      )}
    </g>
  );
};

export const FancyLayer: React.FC<{ cx: number; neckY: number; styleType: FancyStyle }> = ({
  cx,
  neckY,
  styleType,
}) => {
  if (styleType === 'none') return null;

  return (
    <g transform={`translate(${cx}, ${neckY})`}>
      {styleType === 'rainbow-scarf' && (
        <g>
          <path
            d="M-34 0 C-18 10, 18 10, 34 0 L31 12 C14 20, -16 20, -32 11 Z"
            fill="#FFE28A"
            stroke="#6D5242"
            strokeWidth="2.3"
          />
          <path d="M-26 3 C-16 8, -8 9, -2 9" stroke="#F79DA0" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M4 9 C14 9, 24 7, 30 3" stroke="#9CE2BF" strokeWidth="4.5" strokeLinecap="round" />
          <path
            d="M22 5 L45 21 L39 29 L16 13 Z"
            fill="#A8D8F5"
            stroke="#6D5242"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </g>
      )}
      {styleType === 'royal-cape' && (
        <g>
          <path
            d="M-36 2 C-14 10, 14 10, 36 2 L45 34 H-45 Z"
            fill="#E07A8E"
            stroke="#7A3646"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="6" r="5" fill="#FFE05D" stroke="#7A3646" strokeWidth="1.8" />
        </g>
      )}
      {styleType === 'hawaii-shirt' && (
        <g>
          <path
            d="M-34 2 L-16 12 L0 3 L16 12 L34 2 L38 28 H-38 Z"
            fill="#88D4E8"
            stroke="#366E80"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="-16" cy="19" r="3.5" fill="#FFF3B0" />
          <circle cx="15" cy="18" r="3.5" fill="#F9A8B8" />
        </g>
      )}
    </g>
  );
};
