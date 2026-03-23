// ═══════════════════════════════════════════════════════════════════════════
// NATIONALITY DATA — ISO 3166-1 subset with flag emoji
// ═══════════════════════════════════════════════════════════════════════════

export interface NationalityOption {
  code: string;
  flag: string;
  name: string;
}

export const NATIONALITIES: NationalityOption[] = [
  { code: 'MX', flag: '🇲🇽', name: 'México' },
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: 'ES', flag: '🇪🇸', name: 'España' },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: 'PE', flag: '🇵🇪', name: 'Perú' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela' },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'GT', flag: '🇬🇹', name: 'Guatemala' },
  { code: 'CU', flag: '🇨🇺', name: 'Cuba' },
  { code: 'DO', flag: '🇩🇴', name: 'Rep. Dominicana' },
  { code: 'HN', flag: '🇭🇳', name: 'Honduras' },
  { code: 'SV', flag: '🇸🇻', name: 'El Salvador' },
  { code: 'NI', flag: '🇳🇮', name: 'Nicaragua' },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica' },
  { code: 'PA', flag: '🇵🇦', name: 'Panamá' },
  { code: 'PR', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: 'BO', flag: '🇧🇴', name: 'Bolivia' },
  { code: 'PY', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'UY', flag: '🇺🇾', name: 'Uruguay' },
  { code: 'BR', flag: '🇧🇷', name: 'Brasil' },
  { code: 'CA', flag: '🇨🇦', name: 'Canadá' },
  { code: 'GB', flag: '🇬🇧', name: 'Reino Unido' },
  { code: 'FR', flag: '🇫🇷', name: 'Francia' },
  { code: 'DE', flag: '🇩🇪', name: 'Alemania' },
  { code: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: 'JP', flag: '🇯🇵', name: 'Japón' },
  { code: 'KR', flag: '🇰🇷', name: 'Corea del Sur' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'PH', flag: '🇵🇭', name: 'Filipinas' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'ZA', flag: '🇿🇦', name: 'Sudáfrica' },
  { code: 'EG', flag: '🇪🇬', name: 'Egipto' },
  { code: 'IL', flag: '🇮🇱', name: 'Israel' },
  { code: 'TR', flag: '🇹🇷', name: 'Turquía' },
  { code: 'RU', flag: '🇷🇺', name: 'Rusia' },
  { code: 'PL', flag: '🇵🇱', name: 'Polonia' },
  { code: 'SE', flag: '🇸🇪', name: 'Suecia' },
  { code: 'NO', flag: '🇳🇴', name: 'Noruega' },
  { code: 'NL', flag: '🇳🇱', name: 'Países Bajos' },
  { code: 'BE', flag: '🇧🇪', name: 'Bélgica' },
  { code: 'CH', flag: '🇨🇭', name: 'Suiza' },
  { code: 'AT', flag: '🇦🇹', name: 'Austria' },
];

export const GENDERS = [
  { value: '', label: 'Prefiero no decir' },
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'nonbinary', label: 'No binario' },
  { value: 'other', label: 'Otro' },
] as const;

export function getFlagByCode(code: string): string {
  return NATIONALITIES.find(n => n.code === code)?.flag ?? '';
}

export function getNameByCode(code: string): string {
  return NATIONALITIES.find(n => n.code === code)?.name ?? '';
}
