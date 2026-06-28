export const COUNTRY_LANGUAGES = {
  Australia: ["English"],
  Bali: ["Indonesian"],
  Canada: ["English", "French"],
  France: ["French"],
  Greece: ["Greek"],
  India: ["Hindi", "Tamil", "Bengali"],
  Indonesia: ["Indonesian"],
  Italy: ["Italian"],
  Japan: ["Japanese"],
  Malaysia: ["Malay", "Tamil", "Mandarin"],
  Maldives: ["Dhivehi"],
  Nepal: ["Nepali"],
  Singapore: ["English", "Malay", "Tamil", "Mandarin"],
  "South Korea": ["Korean"],
  Spain: ["Spanish"],
  "Sri Lanka": ["Sinhala", "Tamil"],
  Thailand: ["Thai"],
  "United Kingdom": ["English"],
  "United States": ["English"],
  Vietnam: ["Vietnamese"],
};

export const COUNTRIES = Object.keys(COUNTRY_LANGUAGES);

export function defaultLanguagesFor(country) {
  const localLanguages = COUNTRY_LANGUAGES[country] || [];
  return Array.from(new Set(["English", "Sinhala", ...localLanguages]));
}
