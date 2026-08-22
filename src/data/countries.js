export const COUNTRY_LANGUAGES = {
  Australia: ["English"],
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

const FALLBACK_COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belgium",
  "Brazil",
  "Bulgaria",
  "Cambodia",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Denmark",
  "Egypt",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Greece",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Italy",
  "Japan",
  "Kenya",
  "Malaysia",
  "Maldives",
  "Mexico",
  "Morocco",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Philippines",
  "Portugal",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Thailand",
  "Turkey",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
];

const FALLBACK_CODES = {
  Afghanistan: "AF",
  Albania: "AL",
  Algeria: "DZ",
  Andorra: "AD",
  Angola: "AO",
  Argentina: "AR",
  Armenia: "AM",
  Australia: "AU",
  Austria: "AT",
  Azerbaijan: "AZ",
  Bahamas: "BS",
  Bahrain: "BH",
  Bangladesh: "BD",
  Barbados: "BB",
  Belgium: "BE",
  Brazil: "BR",
  Bulgaria: "BG",
  Cambodia: "KH",
  Canada: "CA",
  Chile: "CL",
  China: "CN",
  Colombia: "CO",
  "Costa Rica": "CR",
  Croatia: "HR",
  Denmark: "DK",
  Egypt: "EG",
  Finland: "FI",
  France: "FR",
  Georgia: "GE",
  Germany: "DE",
  Greece: "GR",
  Iceland: "IS",
  India: "IN",
  Indonesia: "ID",
  Ireland: "IE",
  Italy: "IT",
  Japan: "JP",
  Kenya: "KE",
  Malaysia: "MY",
  Maldives: "MV",
  Mexico: "MX",
  Morocco: "MA",
  Nepal: "NP",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Philippines: "PH",
  Portugal: "PT",
  Singapore: "SG",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  "Sri Lanka": "LK",
  Sweden: "SE",
  Switzerland: "CH",
  Thailand: "TH",
  Turkey: "TR",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  Vietnam: "VN",
};

function codeToFlag(code) {
  if (!code || code.length !== 2) return "🌍";
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function buildCountryOptions() {
  try {
    if (!Intl.supportedValuesOf || !Intl.DisplayNames) throw new Error("Intl region names unavailable");
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return Intl.supportedValuesOf("region")
      .map((code) => ({
        code,
        name: names.of(code),
        flag: codeToFlag(code),
      }))
      .filter((country) => country.name && country.name !== "Unknown Region")
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return FALLBACK_COUNTRIES.map((name) => ({
      name,
      code: FALLBACK_CODES[name] || "",
      flag: codeToFlag(FALLBACK_CODES[name]),
    }));
  }
}

export const COUNTRY_OPTIONS = buildCountryOptions();

export const COUNTRIES = COUNTRY_OPTIONS.map((country) => country.name);

export function flagForCountry(countryName) {
  return COUNTRY_OPTIONS.find((country) => country.name === countryName)?.flag || "🌍";
}

export function defaultLanguagesFor(country) {
  const localLanguages = COUNTRY_LANGUAGES[country];
  if (localLanguages && localLanguages.length > 0) {
    return Array.from(new Set([...localLanguages, "English"]));
  }
  return ["English"];
}

