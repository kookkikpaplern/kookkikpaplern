import QRCode from 'qrcode';

function crc16CCITT(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

export function formatPromptPayTarget(rawId: string): string {
  const digits = rawId.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `0066${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('66')) {
    return `00${digits}`;
  }
  return digits;
}

export function generatePromptPayPayload(promptPayId: string, amount?: number): string {
  const target = formatPromptPayTarget(promptPayId);
  const cleanDigits = promptPayId.replace(/\D/g, '');

  let subTag = '01';
  if (cleanDigits.length === 13) {
    subTag = '02';
  } else if (cleanDigits.length >= 15) {
    subTag = '03';
  }

  const merchantInfo = tlv('00', 'A000000677010111') + tlv(subTag, target);

  let payload = '';
  payload += tlv('00', '01'); // Payload Format Indicator
  payload += tlv('01', amount && amount > 0 ? '12' : '11'); // 12 = Dynamic with amount
  payload += tlv('29', merchantInfo); // PromptPay Merchant Account Info
  payload += tlv('53', '764'); // Currency THB
  if (amount && amount > 0) {
    payload += tlv('54', amount.toFixed(2));
  }
  payload += tlv('58', 'TH'); // Country Code
  payload += '6304'; // CRC Tag + Length

  const checksum = crc16CCITT(payload);
  return payload + checksum;
}

export async function generatePromptPayQrDataUrl(
  promptPayId: string,
  amount?: number
): Promise<string> {
  const payload = generatePromptPayPayload(promptPayId, amount);
  return QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    color: {
      dark: '#1E293B',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}
