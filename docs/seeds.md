# Zwuwur Seed Data Specification — Current Seed Files

This document specifies the current seed data used by the Zwuwur backend.

It is generated from the current seed source files:

- `src/seed/data/banks.js`
- `src/seed/data/regions.js`
- `src/seed/data/zones.js`
- `src/seed/data/grades.js`

---

## Summary Statistics

| Entity | Count |
|---|---:|
| Banks | 31 |
| Regions / Chartered Cities | 14 |
| Zones / Subcities / Special Woredas | 111 |
| Total Geographic Nodes | 125 |
| Grades | 18 |
| Grade Bands | 6 |
| Bootstrap Super Admin | 1 |

---

## Seed Principles

1. Seed must be idempotent.
2. Use stable explicit IDs.
3. Do not renumber existing IDs unless intentionally re-keying from a new authoritative seed source.
4. Seed order:

    banks -> regions -> zones -> grades -> super admin

5. Use upsert behavior:

    INSERT ... ON DUPLICATE KEY UPDATE

6. English and Amharic reference fields are mandatory in the database.
7. Reference data uses `is_active` soft deactivation.
8. Unless explicitly overridden in seed data, records are active by database default.
9. Finfinne Special Zone Surrounding Oromia is inactive by default.
10. Super admin bootstrap is created from environment variables and skipped if already present.

---

## Part 1: Banks

Current bank seed contains 31 active banks.

All banks are active by database default unless explicitly deactivated later by an administrator.

| ID | name_en | name_am | alias_en | alias_am | swift_code | year_established | year_established_note |
|---:|---|---|---|---|---|---:|---|
| 1 | Commercial Bank of Ethiopia | የኢትዮጵያ ንግድ ባንክ | CBE | ንግድ ባንክ | CBETETAA | 1963 | 1942 / 1963 |
| 2 | Awash Bank S.C. | አዋሽ ባንክ | Awash Bank | አዋሽ | AWINETAA | 1994 |  |
| 3 | Dashen Bank S.C. | ዳሸን ባንክ | Dashen | ዳሸን | DASHETAA | 1995 |  |
| 4 | Bank of Abyssinia S.C. | አቢሲኒያ ባንክ | Abyssinia | አቢሲኒያ | ABYSETAA | 1996 |  |
| 5 | Wegagen Bank S.C. | ወጋገን ባንክ | Wegagen | ወጋገን | WEGAETAA | 1997 |  |
| 6 | Hibret Bank S.C. | ኅብረት ባንክ | Hibret Bank | ኅብረት | UNTDETAA | 1998 |  |
| 7 | Nib International Bank S.C. | ንብ ኢንተርናሽናል ባንክ | Nib Bank | ንብ | NIBIETAA | 1999 |  |
| 8 | Cooperative Bank of Oromia S.C. | የኦሮሚያ ኅብረት ሥራ ባንክ | Coopbank / CBO | ኮኦፕ | CBORETAA | 2004 |  |
| 9 | Lion International Bank S.C. | አንበሳ ኢንተርናሽናል ባንክ | Lion Bank | አንበሳ | LIBSETAA | 2006 |  |
| 10 | Zemen Bank S.C. | ዘመን ባንክ | Zemen | ዘመን | ZEMEETAA | 2008 |  |
| 11 | Oromia Bank S.C. | ኦሮሚያ ባንክ | Oromia Bank | ኦሮሚያ | ORIRETAA | 2008 |  |
| 12 | Bunna Bank S.C. | ቡና ባንክ | Bunna Bank | ቡና | BUNAETAA | 2009 |  |
| 13 | Berhan Bank S.C. | ብርሃን ባንክ | Berhan | ብርሃን | BERHETAA | 2009 |  |
| 14 | Abay Bank S.C. | ዓባይ ባንክ | Abay Bank | ዓባይ | ABAYETAA | 2010 |  |
| 15 | Addis International Bank S.C. | አዲስ ኢንተርናሽናል ባንክ | AdIB / Addis Bank | አዲስ | ABSCETAA | 2011 |  |
| 16 | Enat Bank S.C. | እናት ባንክ | Enat Bank | እናት | ENATETAA | 2011 |  |
| 17 | Global Bank Ethiopia S.C. | ግሎባል ባንክ ኢትዮጵያ | Global Bank | ግሎባል | DEGAETAA | 2012 |  |
| 18 | ZamZam Bank S.C. | ዘምዘም ባንክ | ZamZam | ዘምዘም | ZAMZETAA | 2020 |  |
| 19 | Hijra Bank S.C. | ሂጅራ ባንክ | Hijra | ሂጅራ | HIJRETAA | 2020 |  |
| 20 | Goh Betoch Bank S.C. | ጎህ ቤቶች ባንክ | Goh Bank | ጎህ | GOBTETAA | 2021 |  |
| 21 | Siinqee Bank S.C. | ሲንቄ ባንክ | Siinqee | ሲንቄ | SINQETAA | 2021 |  |
| 22 | Ahadu Bank S.C. | አሐዱ ባንክ | Ahadu | አሐዱ | AHUUETAA | 2021 |  |
| 23 | Amhara Bank S.C. | አማራ ባንክ | Amhara Bank | አማራ | AMHRETAA | 2021 |  |
| 24 | Tsehay Bank S.C. | ፀሐይ ባንክ | Tsehay | ፀሐይ | TSCPETAA | 2022 |  |
| 25 | Gadaa Bank S.C. | ገዳ ባንክ | Gadaa | ገዳ | GDAAETAA | 2022 |  |
| 26 | Tsedey Bank S.C. | ፀደይ ባንክ | Tsedey | ፀደይ | TSDYETAA | 2022 |  |
| 27 | Sidama Bank S.C. | ሲዳማ ባንክ | Sidama Bank | ሲዳማ | SDMAETAA | 2022 |  |
| 28 | Omo Bank S.C. | ኦሞ ባንክ | Omo Bank | ኦሞ | OSCOETAA | 2022 |  |
| 29 | Shabelle Bank S.C. | ሸበሌ ባንክ | Shabelle | ሸበሌ | SBEEETAA | 2022 |  |
| 30 | Rammis Bank S.C. | ራሚስ ባንክ | Rammis | ራሚስ | RMSIETAA | 2023 |  |
| 31 | Siket Bank S.C. | ስኬት ባንክ | Siket | ስኬት | SSHCETAA | 2023 |  |

### Bank Seed Notes

- Debub Global Bank is not included in the current bank seed.
- Tsehay Bank is included in the current bank seed.
- Bank aliases are now stored as bilingual fields: `alias_en` and `alias_am`.
- Bank names are stored as bilingual fields: `name_en` and `name_am`.
- `year_established_note` is currently only provided for Commercial Bank of Ethiopia.

---

## Part 2: Regions

Current region seed contains 14 regions and chartered cities.

| ID | name_en | name_am | type |
|---:|---|---|---|
| 1 | Addis Ababa | አዲስ አበባ | chartered_city |
| 13 | Dire Dawa | ድሬዳዋ | chartered_city |
| 16 | Oromia | ኦሮሚያ | region |
| 41 | Amhara | አማራ | region |
| 55 | Tigray | ትግራይ | region |
| 63 | Somali | ሶማሌ | region |
| 74 | Sidama | ሲዳማ | region |
| 80 | South West Ethiopia Peoples' | ደቡብ ምዕራብ ኢትዮጵያ ሕዝቦች | region |
| 87 | South Ethiopia | ደቡብ ኢትዮጵያ | region |
| 99 | Central Ethiopia | ማዕከላዊ ኢትዮጵያ | region |
| 106 | Afar | ዓፋር | region |
| 113 | Benishangul-Gumuz | ቤንሻንጉል ጉሙዝ | region |
| 119 | Gambela | ጋምቤላ | region |
| 124 | Harari | ሐረሪ | region |

---

## Part 3: Zones

Current zone seed contains 111 zones, subcities, and special woredas.

Zones reference regions by `region_id`.

### Zone Counts by Region

| Region ID | Region | Zone Count |
|---:|---|---:|
| 1 | Addis Ababa | 11 |
| 13 | Dire Dawa | 2 |
| 16 | Oromia | 24 |
| 41 | Amhara | 13 |
| 55 | Tigray | 7 |
| 63 | Somali | 10 |
| 74 | Sidama | 5 |
| 80 | South West Ethiopia Peoples' | 6 |
| 87 | South Ethiopia | 11 |
| 99 | Central Ethiopia | 6 |
| 106 | Afar | 6 |
| 113 | Benishangul-Gumuz | 5 |
| 119 | Gambela | 4 |
| 124 | Harari | 1 |
|  | Total | 111 |

### Hierarchical Tree View

Addis Ababa (Chartered City)

- Addis Ketema
- Akaki Kaliti
- Arada
- Bole
- Gullele
- Kirkos
- Kolfe Keranio
- Lideta
- Nifas Silk-Lafto
- Yeka
- Lemi Kura

Dire Dawa (Chartered City)

- Dire Dawa Urban
- Dire Dawa Rural

Oromia (Region)

- Arsi
- West Arsi
- Bale
- East Bale
- Borena
- East Borena
- East Hararghe
- West Hararghe
- East Shewa
- West Shewa
- North Shewa (Oromia)
- Southwest Shewa
- East Wellega
- West Wellega
- Kelem Wellega
- Horo Guduru Wellega
- Illubabor
- Buno Bedele
- Jimma
- Guji
- West Guji
- Adama Special Woreda
- Sheger City
- Finfinne Special Zone Surrounding Oromia (inactive by default)

Amhara (Region)

- North Gondar
- South Gondar
- West Gondar
- Awi
- East Gojjam
- West Gojjam
- North Wello
- South Wello
- North Shewa (Amhara)
- Waghemra
- Argoba Special Woreda
- Bahir Dar Special Zone
- Oromo Special Zone

Tigray (Region)

- Central Tigray
- Eastern Tigray
- North Western Tigray
- Southern Tigray
- South Eastern Tigray
- Western Tigray
- Mekelle Special Zone

Somali (Region)

- Afder
- Doolo
- Fafan
- Jarar
- Korahe
- Liben
- Nogob
- Siti
- Shabelle
- Erer

Sidama (Region)

- Northern Sidama Zone
- Central Sidama Zone
- Southern Sidama Zone
- Eastern Sidama Zone
- Hawassa City Administration

South West Ethiopia Peoples' (Region)

- Keffa
- Sheka
- Bench Sheko
- Dawro
- West Omo
- Konta

South Ethiopia (Region)

- Wolayita
- Gedeo
- Gamo
- Gofa
- South Omo
- Konso
- Amaro Special Woreda
- Basketo Special Woreda
- Burji Special Woreda
- Derashe Special Woreda
- Ale Special Woreda

Central Ethiopia (Region)

- Gurage
- Silt'e
- Kembata Tembaro
- Halaba Special Zone
- Hadiya
- Yem Special Woreda

Afar (Region)

- Zone 1 (Awsi Rasu)
- Zone 2 (Kilbet Rasu)
- Zone 3 (Gabi Rasu)
- Zone 4 (Fantena Rasu)
- Zone 5 (Hari Rasu)
- Argoba Special Woreda

Benishangul-Gumuz (Region)

- Asosa
- Kemashi
- Metekel
- Mao-Komo Special Woreda
- Pawi Special Woreda

Gambela (Region)

- Zone 1 (Agnewak/Anyuak)
- Zone 2 (Nuer)
- Zone 3 (Majang)
- Itang Special Woreda

Harari (Region)

- Harari (no further zone subdivision)

### Flat Node Relationship Table

| ID | Parent ID | Name EN | Name AM | Type | Note |
|---:|---:|---|---|---|---|
| 1 |  | Addis Ababa | አዲስ አበባ | Chartered City |  |
| 2 | 1 | Addis Ketema | አዲስ ከተማ | Zone / Subcity |  |
| 3 | 1 | Akaki Kaliti | አቃቂ ቃሊቲ | Zone / Subcity |  |
| 4 | 1 | Arada | አራዳ | Zone / Subcity |  |
| 5 | 1 | Bole | ቦሌ | Zone / Subcity |  |
| 6 | 1 | Gullele | ጉለሌ | Zone / Subcity |  |
| 7 | 1 | Kirkos | ክርኮስ | Zone / Subcity |  |
| 8 | 1 | Kolfe Keranio | ኮልፌ ቀራኒዮ | Zone / Subcity |  |
| 9 | 1 | Lideta | ልደታ | Zone / Subcity |  |
| 10 | 1 | Nifas Silk-Lafto | ንፋስ ስልክ ላፍቶ | Zone / Subcity |  |
| 11 | 1 | Yeka | የካ | Zone / Subcity |  |
| 12 | 1 | Lemi Kura | ለሚ ኩራ | Zone / Subcity |  |
| 13 |  | Dire Dawa | ድሬዳዋ | Chartered City |  |
| 14 | 13 | Dire Dawa Urban | ድሬዳዋ ከተማ | Zone / Subcity |  |
| 15 | 13 | Dire Dawa Rural | ድሬዳዋ ገጠር | Zone / Subcity |  |
| 16 |  | Oromia | ኦሮሚያ | Region |  |
| 17 | 16 | Arsi | አርሲ ዞን | Zone / Subcity |  |
| 18 | 16 | West Arsi | ምዕራብ አርሲ ዞን | Zone / Subcity |  |
| 19 | 16 | Bale | ባሌ ዞን | Zone / Subcity |  |
| 20 | 16 | East Bale | ምሥራቅ ባሌ ዞን | Zone / Subcity |  |
| 21 | 16 | Borena | ቦረና ዞን | Zone / Subcity |  |
| 22 | 16 | East Borena | ምሥራቅ ቦረና ዞን | Zone / Subcity |  |
| 23 | 16 | East Hararghe | ምሥራቅ ሐረርጌ ዞን | Zone / Subcity |  |
| 24 | 16 | West Hararghe | ምዕራብ ሐረርጌ ዞን | Zone / Subcity |  |
| 25 | 16 | East Shewa | ምሥራቅ ሸዋ ዞን | Zone / Subcity |  |
| 26 | 16 | West Shewa | ምዕራብ ሸዋ ዞን | Zone / Subcity |  |
| 27 | 16 | North Shewa (Oromia) | ሰሜን ሸዋ ዞን | Zone / Subcity |  |
| 28 | 16 | Southwest Shewa | ደቡብ ምዕራብ ሸዋ ዞን | Zone / Subcity |  |
| 29 | 16 | East Wellega | ምሥራቅ ወለጋ ዞን | Zone / Subcity |  |
| 30 | 16 | West Wellega | ምዕራብ ወለጋ ዞን | Zone / Subcity |  |
| 31 | 16 | Kelem Wellega | ቄለም ወለጋ ዞን | Zone / Subcity |  |
| 32 | 16 | Horo Guduru Wellega | ሆሮ ጉዱሩ ወለጋ ዞን | Zone / Subcity |  |
| 33 | 16 | Illubabor | ኢሉባቦር ዞን | Zone / Subcity |  |
| 34 | 16 | Buno Bedele | ቡኖ በደሌ ዞን | Zone / Subcity |  |
| 35 | 16 | Jimma | ጅማ ዞን | Zone / Subcity |  |
| 36 | 16 | Guji | ጉጂ ዞን | Zone / Subcity |  |
| 37 | 16 | West Guji | ምዕራብ ጉጂ ዞን | Zone / Subcity |  |
| 38 | 16 | Adama Special Woreda | አዳማ ልዩ ወረዳ | Zone / Subcity |  |
| 39 | 16 | Sheger City | ሸገር ከተማ | Zone / Subcity |  |
| 40 | 16 | Finfinne Special Zone Surrounding Oromia | የፊንፊኔ ዙሪያ ኦሮሚያ ልዩ ዞን | Zone / Subcity | Inactive by default |
| 41 |  | Amhara | አማራ | Region |  |
| 42 | 41 | North Gondar | ሰሜን ጎንደር ዞን | Zone / Subcity |  |
| 43 | 41 | South Gondar | ደቡብ ጎንደር ዞን | Zone / Subcity |  |
| 44 | 41 | West Gondar | ምዕራብ ጎንደር ዞን | Zone / Subcity |  |
| 45 | 41 | Awi | አገው አዊ ዞን | Zone / Subcity |  |
| 46 | 41 | East Gojjam | ምሥራቅ ጎጃም ዞን | Zone / Subcity |  |
| 47 | 41 | West Gojjam | ምዕራብ ጎጃም ዞን | Zone / Subcity |  |
| 48 | 41 | North Wello | ሰሜን ወሎ ዞን | Zone / Subcity |  |
| 49 | 41 | South Wello | ደቡብ ወሎ ዞን | Zone / Subcity |  |
| 50 | 41 | North Shewa (Amhara) | ሰሜን ሸዋ ዞን | Zone / Subcity |  |
| 51 | 41 | Waghemra | ዋግ ኸምራ ዞን | Zone / Subcity |  |
| 52 | 41 | Argoba Special Woreda | አርጎባ ልዩ ወረዳ | Zone / Subcity | Distinct from Afar Argoba Special Woreda, id 112 |
| 53 | 41 | Bahir Dar Special Zone | ባሕር ዳር ልዩ ዞን | Zone / Subcity |  |
| 54 | 41 | Oromo Special Zone | ኦሮሚያ ልዩ ዞን | Zone / Subcity |  |
| 55 |  | Tigray | ትግራይ | Region |  |
| 56 | 55 | Central Tigray | ማዕከላዊ ትግራይ ዞን | Zone / Subcity |  |
| 57 | 55 | Eastern Tigray | ምሥራቃዊ ትግራይ ዞን | Zone / Subcity |  |
| 58 | 55 | North Western Tigray | ሰሜን ምዕራብ ትግራይ ዞን | Zone / Subcity |  |
| 59 | 55 | Southern Tigray | ደቡባዊ ትግራይ ዞን | Zone / Subcity |  |
| 60 | 55 | South Eastern Tigray | ደቡብ ምሥራቅ ትግራይ ዞን | Zone / Subcity |  |
| 61 | 55 | Western Tigray | ምዕራባዊ ትግራይ ዞን | Zone / Subcity |  |
| 62 | 55 | Mekelle Special Zone | መቐለ ልዩ ዞን | Zone / Subcity |  |
| 63 |  | Somali | ሶማሌ | Region |  |
| 64 | 63 | Afder | አፍዴር ዞን | Zone / Subcity |  |
| 65 | 63 | Doolo | ዶሎ ዞን | Zone / Subcity |  |
| 66 | 63 | Fafan | ፋፋን ዞን | Zone / Subcity |  |
| 67 | 63 | Jarar | ጃራር ዞን | Zone / Subcity |  |
| 68 | 63 | Korahe | ቆራሔ ዞን | Zone / Subcity |  |
| 69 | 63 | Liben | ሊበን ዞን | Zone / Subcity |  |
| 70 | 63 | Nogob | ኖጎብ ዞን | Zone / Subcity |  |
| 71 | 63 | Siti | ሲቲ ዞን | Zone / Subcity |  |
| 72 | 63 | Shabelle | ሸበሌ ዞን | Zone / Subcity |  |
| 73 | 63 | Erer | ኤረር ዞን | Zone / Subcity |  |
| 74 |  | Sidama | ሲዳማ | Region |  |
| 75 | 74 | Northern Sidama Zone | ሰሜን ሲዳማ ዞን | Zone / Subcity |  |
| 76 | 74 | Central Sidama Zone | ማዕከላዊ ሲዳማ ዞን | Zone / Subcity |  |
| 77 | 74 | Southern Sidama Zone | ደቡብ ሲዳማ ዞን | Zone / Subcity |  |
| 78 | 74 | Eastern Sidama Zone | ምሥራቅ ሲዳማ ዞን | Zone / Subcity |  |
| 79 | 74 | Hawassa City Administration | ሐዋሳ ከተማ አስተዳደር | Zone / Subcity |  |
| 80 |  | South West Ethiopia Peoples' | ደቡብ ምዕራብ ኢትዮጵያ ሕዝቦች | Region |  |
| 81 | 80 | Keffa | ኬፋ ዞን | Zone / Subcity |  |
| 82 | 80 | Sheka | ሸካ ዞን | Zone / Subcity |  |
| 83 | 80 | Bench Sheko | ቤንች ሸኮ ዞን | Zone / Subcity |  |
| 84 | 80 | Dawro | ዳውሮ ዞን | Zone / Subcity |  |
| 85 | 80 | West Omo | ምዕራብ ኦሞ ዞን | Zone / Subcity |  |
| 86 | 80 | Konta | ኮንታ ዞን | Zone / Subcity |  |
| 87 |  | South Ethiopia | ደቡብ ኢትዮጵያ | Region |  |
| 88 | 87 | Wolayita | ወላይታ ዞን | Zone / Subcity |  |
| 89 | 87 | Gedeo | ጌዴኦ ዞን | Zone / Subcity |  |
| 90 | 87 | Gamo | ጋሞ ዞን | Zone / Subcity |  |
| 91 | 87 | Gofa | ጎፋ ዞን | Zone / Subcity |  |
| 92 | 87 | South Omo | ደቡብ ኦሞ ዞን | Zone / Subcity |  |
| 93 | 87 | Konso | ኮንሶ ዞን | Zone / Subcity |  |
| 94 | 87 | Amaro Special Woreda | አማሮ ልዩ ወረዳ | Zone / Subcity |  |
| 95 | 87 | Basketo Special Woreda | ባስኬቶ ልዩ ወረዳ | Zone / Subcity |  |
| 96 | 87 | Burji Special Woreda | ቡርጂ ልዩ ወረዳ | Zone / Subcity |  |
| 97 | 87 | Derashe Special Woreda | ዲራሼ ልዩ ወረዳ | Zone / Subcity |  |
| 98 | 87 | Ale Special Woreda | አሌ ልዩ ወረዳ | Zone / Subcity |  |
| 99 |  | Central Ethiopia | ማዕከላዊ ኢትዮጵያ | Region |  |
| 100 | 99 | Gurage | ጉራጌ ዞን | Zone / Subcity |  |
| 101 | 99 | Silt'e | ስልጤ ዞን | Zone / Subcity |  |
| 102 | 99 | Kembata Tembaro | ከምባታ ቴምባሮ ዞን | Zone / Subcity |  |
| 103 | 99 | Halaba Special Zone | ሀላባ ዞን | Zone / Subcity |  |
| 104 | 99 | Hadiya | ሀዲያ ዞን | Zone / Subcity |  |
| 105 | 99 | Yem Special Woreda | የኤም ዞን | Zone / Subcity |  |
| 106 |  | Afar | ዓፋር | Region |  |
| 107 | 106 | Zone 1 (Awsi Rasu) | አውሲ ረሱ (ዞን 1) | Zone / Subcity |  |
| 108 | 106 | Zone 2 (Kilbet Rasu) | ክልበት ረሱ (ዞን 2) | Zone / Subcity |  |
| 109 | 106 | Zone 3 (Gabi Rasu) | ጋቢ ረሱ (ዞን 3) | Zone / Subcity |  |
| 110 | 106 | Zone 4 (Fantena Rasu) | ፋንቲ ረሱ (ዞን 4) | Zone / Subcity |  |
| 111 | 106 | Zone 5 (Hari Rasu) | ሃሪ ረሱ (ዞን 5) | Zone / Subcity |  |
| 112 | 106 | Argoba Special Woreda | አርጎባ ልዩ ዞን | Zone / Subcity | Distinct from Amhara Argoba Special Woreda, id 52 |
| 113 |  | Benishangul-Gumuz | ቤንሻንጉል ጉሙዝ | Region |  |
| 114 | 113 | Asosa | አሶሳ ዞን | Zone / Subcity |  |
| 115 | 113 | Kemashi | ካማሺ ዞን | Zone / Subcity |  |
| 116 | 113 | Metekel | መተከል ዞን | Zone / Subcity |  |
| 117 | 113 | Mao-Komo Special Woreda | ማኦ ኮሞ ልዩ ወረዳ | Zone / Subcity |  |
| 118 | 113 | Pawi Special Woreda | ፓዊ ልዩ ወረዳ | Zone / Subcity |  |
| 119 |  | Gambela | ጋምቤላ | Region |  |
| 120 | 119 | Zone 1 (Agnewak/Anyuak) | አኙዋክ ዞን | Zone / Subcity |  |
| 121 | 119 | Zone 2 (Nuer) | ኑዌር ዞን | Zone / Subcity |  |
| 122 | 119 | Zone 3 (Majang) | ማጃንግ ዞን | Zone / Subcity |  |
| 123 | 119 | Itang Special Woreda | ኢታንግ ልዩ ወረዳ | Zone / Subcity |  |
| 124 |  | Harari | ሐረሪ | Region |  |
| 125 | 124 | Harari (no further zone subdivision) | ሐረሪ ክልል (ቀጥታ በወረዳዎች የተዋቀረ) | Zone / Subcity |  |

### Zone Seed Notes

- Addis Ababa zones represent subcities.
- Dire Dawa zones represent urban and rural subdivisions.
- Finfinne Special Zone Surrounding Oromia, id 40, is inactive by default.
- Sheger City, id 39, is active.
- Argoba Special Woreda appears under both Amhara and Afar. These are distinct administrative units and are not duplicates.
- Amhara currently has 13 zone-level entries, including special zones and special woredas. This may differ from some public sources that cite 11 ordinary zones depending on counting convention.

---

## Part 4: Grades

Current grade seed contains 18 grades grouped into 6 bands of 3.

Band formula:

    band_number = CEIL(grade_number / 3)

### Grade Band Summary

| Band | Grades | band_label_en | band_label_am |
|---:|---:|---|---|
| 1 | 1-3 | Support | ድጋፍ |
| 2 | 4-6 | Associate | ረዳት |
| 3 | 7-9 | Senior | ከፍተኛ |
| 4 | 10-12 | Manager | አስተዳዳሪ |
| 5 | 13-15 | Director | ዳይሬክተር |
| 6 | 16-18 | Executive | ሥራ አስፈጻሚ |

### Full Grade Seed

| ID | grade_number | band_number | band_label_en | band_label_am | tier_classification_en | tier_classification_am | rank_order |
|---:|---:|---:|---|---|---|---|---:|
| 1 | 1 | 1 | Support | ድጋፍ | Grade 1 | ደረጃ 1 | 1 |
| 2 | 2 | 1 | Support | ድጋፍ | Grade 2 | ደረጃ 2 | 2 |
| 3 | 3 | 1 | Support | ድጋፍ | Grade 3 | ደረጃ 3 | 3 |
| 4 | 4 | 2 | Associate | ረዳት | Grade 4 | ደረጃ 4 | 4 |
| 5 | 5 | 2 | Associate | ረዳት | Grade 5 | ደረጃ 5 | 5 |
| 6 | 6 | 2 | Associate | ረዳት | Grade 6 | ደረጃ 6 | 6 |
| 7 | 7 | 3 | Senior | ከፍተኛ | Grade 7 | ደረጃ 7 | 7 |
| 8 | 8 | 3 | Senior | ከፍተኛ | Grade 8 | ደረጃ 8 | 8 |
| 9 | 9 | 3 | Senior | ከፍተኛ | Grade 9 | ደረጃ 9 | 9 |
| 10 | 10 | 4 | Manager | አስተዳዳሪ | Grade 10 | ደረጃ 10 | 10 |
| 11 | 11 | 4 | Manager | አስተዳዳሪ | Grade 11 | ደረጃ 11 | 11 |
| 12 | 12 | 4 | Manager | አስተዳዳሪ | Grade 12 | ደረጃ 12 | 12 |
| 13 | 13 | 5 | Director | ዳይሬክተር | Grade 13 | ደረጃ 13 | 13 |
| 14 | 14 | 5 | Director | ዳይሬክተር | Grade 14 | ደረጃ 14 | 14 |
| 15 | 15 | 5 | Director | ዳይሬክተር | Grade 15 | ደረጃ 15 | 15 |
| 16 | 16 | 6 | Executive | ሥራ አስፈጻሚ | Grade 16 | ደረጃ 16 | 16 |
| 17 | 17 | 6 | Executive | ሥራ አስፈጻሚ | Grade 17 | ደረጃ 17 | 17 |
| 18 | 18 | 6 | Executive | ሥራ አስፈጻሚ | Grade 18 | ደረጃ 18 | 18 |

---

## Part 5: Super Admin Bootstrap

A bootstrap super admin is created from environment variables.

Environment variables:

- SUPER_ADMIN_EMAIL
- SUPER_ADMIN_PASSWORD
- SUPER_ADMIN_FULL_NAME

Seeder behavior:

- create super admin if not exists
- skip if a super admin already exists
- password must be hashed with bcrypt
- production startup must reject weak default passwords

---

## Production Gates

Before production seeding:

1. Approve Amharic translations for:
   - banks
   - bank aliases
   - regions
   - zones
   - grades
   - system messages

2. Confirm Finfinne Special Zone Surrounding Oromia status.

3. Confirm Commercial Bank of Ethiopia establishment-year semantics:
   - 1942
   - 1963

4. Confirm Enat Bank establishment-year semantics if needed.

5. Confirm Amhara zone count convention.

6. Confirm Tsehay Bank metadata.

7. Confirm legacy handling for Debub Global Bank if present in older environments.

---

## Corrections Log

Changes compared to older seed documentation:

1. Bank list updated to match current `banks.js`.
2. Tsehay Bank added.
3. Debub Global Bank removed from the active seed list.
4. Bank model updated to use:
   - `name_en`
   - `name_am`
   - `alias_en`
   - `alias_am`
   - `swift_code`
   - `year_established`
   - `year_established_note`
5. Region model updated to include:
   - `name_en`
   - `name_am`
   - `type`
6. Zone model updated to include:
   - `region_id`
   - `name_en`
   - `name_am`
   - explicit inactive flag for Finfinne Special Zone Surrounding Oromia
7. Grade seed fully documented with:
   - `grade_number`
   - `band_number`
   - `band_label_en`
   - `band_label_am`
   - `tier_classification_en`
   - `tier_classification_am`
   - `rank_order`
8. Seed order clarified:

    banks -> regions -> zones -> grades -> super admin

9. Finfinne Special Zone Surrounding Oromia confirmed inactive by default.
10. Bank establishment years now reflect the current seed source, including:
    - Cooperative Bank of Oromia: 2004
    - ZamZam Bank: 2020
    - Hijra Bank: 2020
    - Ahadu Bank: 2021
    - Shabelle Bank: 2022
    - Rammis Bank: 2023
    - Enat Bank: 2011