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
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kenya",
  "Kuwait",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Maldives",
  "Malta",
  "Mauritius",
  "Mexico",
  "Monaco",
  "Morocco",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tanzania",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Vietnam",
  "Zimbabwe",
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
  Cuba: "CU",
  Cyprus: "CY",
  "Czech Republic": "CZ",
  Denmark: "DK",
  "Dominican Republic": "DO",
  Ecuador: "EC",
  Egypt: "EG",
  Estonia: "EE",
  Ethiopia: "ET",
  Fiji: "FJ",
  Finland: "FI",
  France: "FR",
  Georgia: "GE",
  Germany: "DE",
  Ghana: "GH",
  Greece: "GR",
  Guatemala: "GT",
  "Hong Kong": "HK",
  Hungary: "HU",
  Iceland: "IS",
  India: "IN",
  Indonesia: "ID",
  Iran: "IR",
  Iraq: "IQ",
  Ireland: "IE",
  Israel: "IL",
  Italy: "IT",
  Jamaica: "JM",
  Japan: "JP",
  Jordan: "JO",
  Kenya: "KE",
  Kuwait: "KW",
  Laos: "LA",
  Latvia: "LV",
  Lebanon: "LB",
  Lithuania: "LT",
  Luxembourg: "LU",
  Malaysia: "MY",
  Maldives: "MV",
  Malta: "MT",
  Mauritius: "MU",
  Mexico: "MX",
  Monaco: "MC",
  Morocco: "MA",
  Nepal: "NP",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Nigeria: "NG",
  Norway: "NO",
  Pakistan: "PK",
  Peru: "PE",
  Philippines: "PH",
  Poland: "PL",
  Portugal: "PT",
  Romania: "RO",
  Russia: "RU",
  "Saudi Arabia": "SA",
  Serbia: "RS",
  Singapore: "SG",
  Slovakia: "SK",
  Slovenia: "SI",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  "Sri Lanka": "LK",
  Sweden: "SE",
  Switzerland: "CH",
  Taiwan: "TW",
  Tanzania: "TZ",
  Thailand: "TH",
  Turkey: "TR",
  Ukraine: "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  Uruguay: "UY",
  Vietnam: "VN",
  Zimbabwe: "ZW",
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
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const pairs = [];

    for (let i = 0; i < alphabet.length; i += 1) {
      for (let j = 0; j < alphabet.length; j += 1) {
        pairs.push(`${alphabet[i]}${alphabet[j]}`);
      }
    }

    return pairs
      .map((code) => {
        try {
          const name = displayNames.of(code);
          return name && name !== code ? { name, code, flag: codeToFlag(code) } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
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

export function codeForCountry(countryName) {
  return COUNTRY_OPTIONS.find((country) => country.name === countryName)?.code || "";
}
