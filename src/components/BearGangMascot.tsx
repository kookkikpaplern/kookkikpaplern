import React from 'react';
import {
  BearFamilyOutfits,
  BearId,
  BearOutfit,
  DEFAULT_BEAR_OUTFITS,
} from '../config/bearOutfits';
import {
  ApronLayer,
  BagLayer,
  BowLayer,
  FancyLayer,
  GlassesLayer,
  HairLayer,
  HatLayer,
} from './BearAccessoryLayers';

interface CelebrationStarsProps {
  width?: number;
}

const CelebrationStars: React.FC<CelebrationStarsProps> = ({ width = 420 }) => (
  <g>
    <path
      d="M28 24 L32 33 L42 34 L34 41 L36 51 L28 46 L20 51 L22 41 L14 34 L24 33 Z"
      fill="#FFE05D"
      stroke="#C9971A"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d={`M${width / 2} 4 L${width / 2 + 4} 14 L${width / 2 + 15} 15 L${width / 2 + 7} 22 L${width / 2 + 9} 33 L${width / 2} 27 L${width / 2 - 9} 33 L${width / 2 - 7} 22 L${width / 2 - 15} 15 L${width / 2 - 4} 14 Z`}
      fill="#FFE05D"
      stroke="#C9971A"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d={`M${width - 28} 22 L${width - 24} 31 L${width - 14} 32 L${width - 22} 39 L${width - 20} 49 L${width - 28} 44 L${width - 36} 49 L${width - 34} 39 L${width - 42} 32 L${width - 32} 31 Z`}
      fill="#FFE05D"
      stroke="#C9971A"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </g>
);

/* =================== 1. แฝดพี่ (Twin Left) =================== */
const TwinLeftGroup: React.FC<{ outfit: BearOutfit; celebrating?: boolean }> = ({
  outfit,
  celebrating = false,
}) => (
  <g id="bear-twin-left">
    <circle cx="54" cy="48" r="16" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
    <circle cx="54" cy="48" r="8" fill="#DFBE99" />
    <circle cx="122" cy="48" r="16" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
    <circle cx="122" cy="48" r="8" fill="#DFBE99" />

    <path
      d="M44 138 C44 108, 60 98, 88 98 C116 98, 132 108, 132 138 Z"
      fill="#F4F1EC"
      stroke="#6D5242"
      strokeWidth="3"
    />
    <path d="M52 114 H124" stroke="#7A828A" strokeWidth="3" strokeLinecap="round" />
    <path d="M47 123 H129" stroke="#7A828A" strokeWidth="3" strokeLinecap="round" />
    <path d="M45 132 H131" stroke="#7A828A" strokeWidth="3" strokeLinecap="round" />

    <FancyLayer cx={88} neckY={102} styleType={outfit.fancy} />
    <ApronLayer cx={88} topY={103} styleType={outfit.apron} />
    <BagLayer cx={88} topY={102} styleType={outfit.bag} />

    <ellipse cx="88" cy="73" rx="43" ry="37" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
    {celebrating ? (
      <>
        <path d="M66 71 Q71 64 76 71" stroke="#4B372B" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M100 71 Q105 64 110 71" stroke="#4B372B" strokeWidth="3.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="71" cy="72" r="4.8" fill="#4B372B" />
        <circle cx="69.5" cy="70.2" r="1.6" fill="#FFFFFF" />
        <circle cx="105" cy="72" r="4.8" fill="#4B372B" />
        <circle cx="103.5" cy="70.2" r="1.6" fill="#FFFFFF" />
      </>
    )}
    <ellipse cx="88" cy="77" rx="4.5" ry="3.2" fill="#4B372B" />
    <path d="M82 82 Q85 86 88 82 Q91 86 94 82" stroke="#4B372B" strokeWidth="2.6" strokeLinecap="round" fill="none" />

    <HairLayer cx={88} cy={73} styleType={outfit.hair} />
    <GlassesLayer cx={88} cy={72} styleType={outfit.glasses} />
    <HatLayer cx={88} cy={73} styleType={outfit.hat} />
    <BowLayer cx={88} cy={73} styleType={outfit.bow} />

    {celebrating ? (
      <>
        <ellipse cx="42" cy="92" rx="11" ry="13" transform="rotate(-28 42 92)" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
        <ellipse cx="134" cy="92" rx="11" ry="13" transform="rotate(28 134 92)" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
      </>
    ) : (
      <>
        <ellipse cx="62" cy="136" rx="13" ry="10" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
        <ellipse cx="118" cy="136" rx="13" ry="10" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
      </>
    )}
  </g>
);

/* =================== 2. แฝดน้อง (Twin Right) =================== */
const TwinRightGroup: React.FC<{ outfit: BearOutfit; celebrating?: boolean }> = ({
  outfit,
  celebrating = false,
}) => (
  <g id="bear-twin-right">
    <circle cx="294" cy="48" r="15" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
    <circle cx="294" cy="48" r="7.5" fill="#DFBE99" />
    <circle cx="366" cy="48" r="15" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
    <circle cx="366" cy="48" r="7.5" fill="#DFBE99" />

    <path
      d="M286 138 C286 108, 302 98, 330 98 C358 98, 374 108, 374 138 Z"
      fill="#ECD5B8"
      stroke="#6D5242"
      strokeWidth="3"
    />
    <FancyLayer cx={330} neckY={102} styleType={outfit.fancy} />
    <ApronLayer cx={330} topY={105} styleType={outfit.apron} />
    <BagLayer cx={330} topY={102} styleType={outfit.bag} />

    <ellipse cx="330" cy="76" rx="42" ry="36" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
    <ellipse cx="305" cy="84" rx="7" ry="4.5" fill="#F5999B" opacity="0.8" />
    <ellipse cx="355" cy="84" rx="7" ry="4.5" fill="#F5999B" opacity="0.8" />
    {celebrating ? (
      <>
        <path d="M308 74 Q313 67 318 74" stroke="#4B372B" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M342 74 Q347 67 352 74" stroke="#4B372B" strokeWidth="3.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="313" cy="75" r="4.6" fill="#4B372B" />
        <circle cx="311.5" cy="73.5" r="1.5" fill="#FFFFFF" />
        <circle cx="347" cy="75" r="4.6" fill="#4B372B" />
        <circle cx="345.5" cy="73.5" r="1.5" fill="#FFFFFF" />
      </>
    )}
    <ellipse cx="330" cy="79" rx="4.2" ry="3" fill="#4B372B" />
    <path d="M324 83 Q327 86 330 83 Q333 86 336 83" stroke="#4B372B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <path d="M327 85 Q330 92 334 85 Z" fill="#F27988" stroke="#4B372B" strokeWidth="1.6" />

    <HairLayer cx={330} cy={76} styleType={outfit.hair} />
    <GlassesLayer cx={330} cy={75} styleType={outfit.glasses} />
    <HatLayer cx={330} cy={76} styleType={outfit.hat} />
    <BowLayer cx={330} cy={76} styleType={outfit.bow} />

    {celebrating ? (
      <>
        <ellipse cx="284" cy="92" rx="11" ry="13" transform="rotate(-28 284 92)" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
        <ellipse cx="376" cy="92" rx="11" ry="13" transform="rotate(28 376 92)" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
      </>
    ) : (
      <>
        <ellipse cx="298" cy="136" rx="13" ry="10" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
        <ellipse cx="358" cy="136" rx="13" ry="10" fill="#ECD5B8" stroke="#6D5242" strokeWidth="3" />
      </>
    )}
  </g>
);

/* =================== 3. พี่สาวคนโต (Center Sister) =================== */
const SisterGroup: React.FC<{ outfit: BearOutfit; celebrating?: boolean }> = ({
  outfit,
  celebrating = false,
}) => (
  <g id="bear-big-sister">
    <circle cx="168" cy="40" r="16" fill="#FFF8EE" stroke="#7A5F4E" strokeWidth="3" />
    <circle cx="168" cy="40" r="7.5" fill="#FBE1D4" />
    <circle cx="252" cy="40" r="16" fill="#FFF8EE" stroke="#7A5F4E" strokeWidth="3" />
    <circle cx="252" cy="40" r="7.5" fill="#FBE1D4" />

    <path
      d="M174 138 C176 112, 190 105, 210 105 C230 105, 244 112, 246 138 Z"
      fill="#FFF8EE"
      stroke="#7A5F4E"
      strokeWidth="3"
    />
    <FancyLayer cx={210} neckY={106} styleType={outfit.fancy} />
    <ApronLayer cx={210} topY={106} styleType={outfit.apron} />
    <BagLayer cx={210} topY={106} styleType={outfit.bag} />

    <path
      d="M164 62 C160 48, 174 36, 188 40 C196 29, 224 29, 232 40 C246 36, 260 48, 256 62 C265 72, 262 92, 248 100 C236 112, 184 112, 172 100 C158 92, 155 72, 164 62 Z"
      fill="#FFF8EE"
      stroke="#7A5F4E"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <ellipse cx="182" cy="84" rx="7" ry="4" fill="#F9B4B6" opacity="0.65" />
    <ellipse cx="238" cy="84" rx="7" ry="4" fill="#F9B4B6" opacity="0.65" />
    {celebrating ? (
      <>
        <path d="M184 74 Q190 66 196 74" stroke="#4B372B" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M224 74 Q230 66 236 74" stroke="#4B372B" strokeWidth="3.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="190" cy="75" r="4.8" fill="#4B372B" />
        <circle cx="188.5" cy="73.2" r="1.6" fill="#FFFFFF" />
        <circle cx="230" cy="75" r="4.8" fill="#4B372B" />
        <circle cx="228.5" cy="73.2" r="1.6" fill="#FFFFFF" />
      </>
    )}
    <ellipse cx="210" cy="80" rx="4.4" ry="3.1" fill="#4B372B" />
    <path d="M204 85 Q207 89 210 85 Q213 89 216 85" stroke="#4B372B" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {outfit.hair !== 'none' && (
      <path d="M204 44 C202 52, 214 55, 217 48" stroke="#B99E8B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    )}
    {outfit.hair !== 'curly' && outfit.hair !== 'default' && (
      <HairLayer cx={210} cy={74} styleType={outfit.hair} />
    )}
    <GlassesLayer cx={210} cy={74} styleType={outfit.glasses} />
    <HatLayer cx={210} cy={74} styleType={outfit.hat} />
    <BowLayer cx={210} cy={74} styleType={outfit.bow} />

    {celebrating ? (
      <>
        <ellipse cx="166" cy="95" rx="11" ry="13" transform="rotate(-32 166 95)" fill="#FFF8EE" stroke="#7A5F4E" strokeWidth="3" />
        <ellipse cx="254" cy="95" rx="11" ry="13" transform="rotate(32 254 95)" fill="#FFF8EE" stroke="#7A5F4E" strokeWidth="3" />
      </>
    ) : (
      <>
        <ellipse cx="176" cy="136" rx="14" ry="11" fill="#FFF8EE" stroke="#7A5F4E" strokeWidth="3" />
        <ellipse cx="244" cy="136" rx="14" ry="11" fill="#FFF8EE" stroke="#7A5F4E" strokeWidth="3" />
      </>
    )}
  </g>
);

/* =================== 4. แม่หมีเชฟ (Mama Bear: Darker Cream-Brown + Chef Star Hat + Mint Apron) =================== */
const MamaBearGroup: React.FC<{ outfit: BearOutfit; celebrating?: boolean }> = ({
  outfit,
  celebrating = false,
}) => (
  <g id="bear-mama">
    {/* Ears (สีครีมน้ำตาลเข้มกว่าพ่อหมีเล็กน้อย) */}
    <circle cx="62" cy="46" r="17" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
    <circle cx="62" cy="46" r="8.5" fill="#C99E74" />
    <circle cx="148" cy="46" r="17" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
    <circle cx="148" cy="46" r="8.5" fill="#C99E74" />

    {/* Body */}
    <path
      d="M52 142 C54 106, 74 96, 105 96 C136 96, 156 106, 158 142 Z"
      fill="#DDB892"
      stroke="#664A39"
      strokeWidth="3"
    />
    <FancyLayer cx={105} neckY={102} styleType={outfit.fancy} />
    <ApronLayer cx={105} topY={104} styleType={outfit.apron} />
    <BagLayer cx={105} topY={102} styleType={outfit.bag} />

    {/* Head */}
    <ellipse cx="105" cy="73" rx="46" ry="38" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
    <ellipse cx="77" cy="83" rx="7.5" ry="4.5" fill="#F49D9F" opacity="0.7" />
    <ellipse cx="133" cy="83" rx="7.5" ry="4.5" fill="#F49D9F" opacity="0.7" />

    {celebrating ? (
      <>
        <path d="M81 71 Q87 63 93 71" stroke="#422E23" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M117 71 Q123 63 129 71" stroke="#422E23" strokeWidth="3.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="87" cy="72" r="4.8" fill="#422E23" />
        <circle cx="85.5" cy="70.2" r="1.6" fill="#FFFFFF" />
        <path d="M80 68 L83 70" stroke="#422E23" strokeWidth="2" strokeLinecap="round" />
        <circle cx="123" cy="72" r="4.8" fill="#422E23" />
        <circle cx="121.5" cy="70.2" r="1.6" fill="#FFFFFF" />
        <path d="M130 68 L127 70" stroke="#422E23" strokeWidth="2" strokeLinecap="round" />
      </>
    )}
    <ellipse cx="105" cy="78" rx="4.6" ry="3.2" fill="#422E23" />
    <path d="M98 83 Q101.5 87 105 83 Q108.5 87 112 83" stroke="#422E23" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    <HairLayer cx={105} cy={73} styleType={outfit.hair} />
    <GlassesLayer cx={105} cy={72} styleType={outfit.glasses} />
    <HatLayer cx={105} cy={73} styleType={outfit.hat} />
    <BowLayer cx={105} cy={73} styleType={outfit.bow} />

    {celebrating ? (
      <>
        <ellipse cx="52" cy="92" rx="11" ry="13" transform="rotate(-30 52 92)" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
        <ellipse cx="158" cy="92" rx="11" ry="13" transform="rotate(30 158 92)" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
      </>
    ) : (
      <>
        <ellipse cx="74" cy="140" rx="14" ry="10.5" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
        <ellipse cx="136" cy="140" rx="14" ry="10.5" fill="#DDB892" stroke="#664A39" strokeWidth="3" />
      </>
    )}
  </g>
);

/* =================== 5. พ่อหมีขี่เวสป้าเขียวมิ้น (Papa Bear: Light Cream-Tan + Curly Hair + Round Glasses + Mint Vespa) =================== */
const PapaBearVespaGroup: React.FC<{ outfit: BearOutfit; celebrating?: boolean }> = ({
  outfit,
  celebrating = false,
}) => (
  <g id="bear-papa-vespa">
    {/* Back Delivery Rack & Mint Vespa Rear Body */}
    <ellipse cx="58" cy="142" rx="18" ry="18" fill="#3B3A3D" stroke="#242325" strokeWidth="3" />
    <circle cx="58" cy="142" r="7" fill="#D8D4CE" />
    <ellipse cx="164" cy="142" rx="18" ry="18" fill="#3B3A3D" stroke="#242325" strokeWidth="3" />
    <circle cx="164" cy="142" r="7" fill="#D8D4CE" />

    {/* Mint Vespa Scooter Frame */}
    <path
      d="M42 132 C42 110, 68 106, 98 112 L124 114 C132 95, 140 84, 152 82 L160 118 C172 122, 178 134, 172 142 H48 Z"
      fill="#8ADBC0"
      stroke="#3D7864"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    {/* Vespa Seat */}
    <path
      d="M74 106 C86 100, 114 102, 122 112 H72 Z"
      fill="#7A5640"
      stroke="#4B3426"
      strokeWidth="2.5"
    />
    {/* Vespa Headlight & Handlebars */}
    <circle cx="159" cy="84" r="9" fill="#FFF7CC" stroke="#3D7864" strokeWidth="2.6" />
    <path d="M138 80 L152 80" stroke="#3D7864" strokeWidth="4" strokeLinecap="round" />

    {/* Papa Bear Big Warm Body (ขนนุ่มสีครีมน้ำตาลอ่อน) */}
    <path
      d="M68 110 C68 82, 86 74, 110 74 C134 74, 146 86, 144 112 Z"
      fill="#EED9BE"
      stroke="#6B503F"
      strokeWidth="3"
    />
    <FancyLayer cx={108} neckY={82} styleType={outfit.fancy} />
    <ApronLayer cx={108} topY={82} styleType={outfit.apron} />
    <BagLayer cx={74} topY={86} styleType={outfit.bag} />

    {/* Papa Ears */}
    <circle cx="72" cy="34" r="15" fill="#EED9BE" stroke="#6B503F" strokeWidth="3" />
    <circle cx="72" cy="34" r="7" fill="#DFBE9B" />
    <circle cx="144" cy="34" r="15" fill="#EED9BE" stroke="#6B503F" strokeWidth="3" />
    <circle cx="144" cy="34" r="7" fill="#DFBE9B" />

    {/* Papa Head (Big & Handsome) */}
    <ellipse cx="108" cy="57" rx="44" ry="36" fill="#EED9BE" stroke="#6B503F" strokeWidth="3" />
    <ellipse cx="82" cy="66" rx="6.5" ry="3.8" fill="#F29E9D" opacity="0.55" />
    <ellipse cx="134" cy="66" rx="6.5" ry="3.8" fill="#F29E9D" opacity="0.55" />

    {celebrating ? (
      <>
        <path d="M86 55 Q91 49 96 55" stroke="#422E23" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 55 Q125 49 130 55" stroke="#422E23" strokeWidth="3" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="91" cy="56" r="4.4" fill="#422E23" />
        <circle cx="89.5" cy="54.5" r="1.4" fill="#FFFFFF" />
        <circle cx="125" cy="56" r="4.4" fill="#422E23" />
        <circle cx="123.5" cy="54.5" r="1.4" fill="#FFFFFF" />
      </>
    )}
    <ellipse cx="108" cy="62" rx="4.5" ry="3.2" fill="#422E23" />
    <path d="M101 67 Q104.5 71 108 67 Q111.5 71 115 67" stroke="#422E23" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Wavy Curly Hair + Round Glasses + Hat/Bow */}
    <HairLayer cx={108} cy={57} styleType={outfit.hair} />
    <GlassesLayer cx={108} cy={56} styleType={outfit.glasses} />
    <HatLayer cx={108} cy={57} styleType={outfit.hat} />
    <BowLayer cx={108} cy={57} styleType={outfit.bow} />

    {/* Papa Arms gripping handlebar or waving */}
    {celebrating ? (
      <>
        <ellipse cx="64" cy="76" rx="10" ry="12" transform="rotate(-30 64 76)" fill="#EED9BE" stroke="#6B503F" strokeWidth="2.8" />
        <ellipse cx="152" cy="76" rx="10" ry="12" transform="rotate(30 152 76)" fill="#EED9BE" stroke="#6B503F" strokeWidth="2.8" />
      </>
    ) : (
      <path
        d="M126 88 Q138 86 144 80"
        stroke="#6B503F"
        strokeWidth="9"
        strokeLinecap="round"
      />
    )}
  </g>
);

/* =================== EXPORTED MASCOT COMPOSITIONS =================== */

interface BearGangMascotProps {
  pose?: 'peeking' | 'celebrating';
  outfits?: BearFamilyOutfits;
  className?: string;
}

export const BearGangMascot: React.FC<BearGangMascotProps> = ({
  pose = 'peeking',
  outfits = DEFAULT_BEAR_OUTFITS,
  className = '',
}) => {
  const isCelebrating = pose === 'celebrating';
  return (
    <div
      className={`pointer-events-none select-none flex justify-center ${
        isCelebrating ? 'animate-bear-happy' : ''
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 420 148"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[340px] h-auto overflow-visible drop-shadow-sm"
      >
        {isCelebrating && <CelebrationStars width={420} />}
        <TwinLeftGroup outfit={outfits.twinLeft} celebrating={isCelebrating} />
        <TwinRightGroup outfit={outfits.twinRight} celebrating={isCelebrating} />
        <SisterGroup outfit={outfits.sister} celebrating={isCelebrating} />
      </svg>
    </div>
  );
};

export const MamaBearMascot: React.FC<{
  pose?: 'peeking' | 'celebrating';
  outfits?: BearFamilyOutfits;
  className?: string;
}> = ({ pose = 'peeking', outfits = DEFAULT_BEAR_OUTFITS, className = '' }) => {
  const isCelebrating = pose === 'celebrating';
  return (
    <div
      className={`pointer-events-none select-none flex justify-center ${
        isCelebrating ? 'animate-bear-happy' : ''
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 210 148"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[180px] h-auto overflow-visible drop-shadow-sm"
      >
        {isCelebrating && <CelebrationStars width={210} />}
        <MamaBearGroup outfit={outfits.mama} celebrating={isCelebrating} />
      </svg>
    </div>
  );
};

export const PapaBearVespaMascot: React.FC<{
  pose?: 'delivering' | 'celebrating';
  outfits?: BearFamilyOutfits;
  className?: string;
}> = ({ pose = 'delivering', outfits = DEFAULT_BEAR_OUTFITS, className = '' }) => {
  const isCelebrating = pose === 'celebrating';
  return (
    <div
      className={`pointer-events-none select-none flex justify-center ${
        isCelebrating ? 'animate-bear-happy' : ''
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 220 166"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[185px] h-auto overflow-visible drop-shadow-sm"
      >
        <PapaBearVespaGroup outfit={outfits.papa} celebrating={isCelebrating} />
      </svg>
    </div>
  );
};

export const BearParentsCelebration: React.FC<{
  outfits?: BearFamilyOutfits;
  className?: string;
}> = ({ outfits = DEFAULT_BEAR_OUTFITS, className = '' }) => (
  <div
    className={`pointer-events-none select-none flex justify-center animate-bear-happy ${className}`}
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 430 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[360px] h-auto overflow-visible drop-shadow-sm"
    >
      <CelebrationStars width={430} />
      <g transform="translate(8, 12)">
        <MamaBearGroup outfit={outfits.mama} celebrating />
      </g>
      <g transform="translate(205, 0)">
        <PapaBearVespaGroup outfit={outfits.papa} celebrating />
      </g>
    </svg>
  </div>
);

export const BearSinglePreview: React.FC<{
  bearId: BearId;
  outfit: BearOutfit;
  className?: string;
}> = ({ bearId, outfit, className = '' }) => {
  return (
    <svg
      viewBox="0 0 220 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full max-w-[240px] h-auto overflow-visible ${className}`}
    >
      {bearId === 'papa' && <PapaBearVespaGroup outfit={outfit} />}
      {bearId === 'mama' && (
        <g transform="translate(5, 10)">
          <MamaBearGroup outfit={outfit} />
        </g>
      )}
      {bearId === 'sister' && (
        <g transform="translate(-100, 12)">
          <SisterGroup outfit={outfit} />
        </g>
      )}
      {bearId === 'twinLeft' && (
        <g transform="translate(22, 12)">
          <TwinLeftGroup outfit={outfit} />
        </g>
      )}
      {bearId === 'twinRight' && (
        <g transform="translate(-220, 12)">
          <TwinRightGroup outfit={outfit} />
        </g>
      )}
    </svg>
  );
};
