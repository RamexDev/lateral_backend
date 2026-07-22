// Zone seed data — 111 zones/subcities/special woredas.
// Keys match the database columns exactly: region_id, name_en, name_am.
// Finfinne Special Zone (id 40) is inactive by default unless overridden in the seeder.

export const zones = [
  // ─── Addis Ababa subcities (region_id: 1) ───────────────────────────
  { id: 2,  region_id: 1,  name_en: 'Addis Ketema',              name_am: 'አዲስ ከተማ' },
  { id: 3,  region_id: 1,  name_en: 'Akaki Kaliti',              name_am: 'አቃቂ ቃሊቲ' },
  { id: 4,  region_id: 1,  name_en: 'Arada',                     name_am: 'አራዳ' },
  { id: 5,  region_id: 1,  name_en: 'Bole',                      name_am: 'ቦሌ' },
  { id: 6,  region_id: 1,  name_en: 'Gullele',                   name_am: 'ጉለሌ' },
  { id: 7,  region_id: 1,  name_en: 'Kirkos',                    name_am: 'ክርኮስ' },
  { id: 8,  region_id: 1,  name_en: 'Kolfe Keranio',             name_am: 'ኮልፌ ቀራኒዮ' },
  { id: 9,  region_id: 1,  name_en: 'Lideta',                    name_am: 'ልደታ' },
  { id: 10, region_id: 1,  name_en: 'Nifas Silk-Lafto',          name_am: 'ንፋስ ስልክ ላፍቶ' },
  { id: 11, region_id: 1,  name_en: 'Yeka',                      name_am: 'የካ' },
  { id: 12, region_id: 1,  name_en: 'Lemi Kura',                 name_am: 'ለሚ ኩራ' },

  // ─── Dire Dawa (region_id: 13) ──────────────────────────────────────
  { id: 14, region_id: 13, name_en: 'Dire Dawa Urban',           name_am: 'ድሬዳዋ ከተማ' },
  { id: 15, region_id: 13, name_en: 'Dire Dawa Rural',           name_am: 'ድሬዳዋ ገጠር' },

  // ─── Oromia (region_id: 16) ─────────────────────────────────────────
  { id: 17, region_id: 16, name_en: 'Arsi',                      name_am: 'አርሲ ዞን' },
  { id: 18, region_id: 16, name_en: 'West Arsi',                 name_am: 'ምዕራብ አርሲ ዞን' },
  { id: 19, region_id: 16, name_en: 'Bale',                      name_am: 'ባሌ ዞን' },
  { id: 20, region_id: 16, name_en: 'East Bale',                 name_am: 'ምሥራቅ ባሌ ዞን' },
  { id: 21, region_id: 16, name_en: 'Borena',                    name_am: 'ቦረና ዞን' },
  { id: 22, region_id: 16, name_en: 'East Borena',               name_am: 'ምሥራቅ ቦረና ዞን' },
  { id: 23, region_id: 16, name_en: 'East Hararghe',             name_am: 'ምሥራቅ ሐረርጌ ዞን' },
  { id: 24, region_id: 16, name_en: 'West Hararghe',             name_am: 'ምዕራብ ሐረርጌ ዞን' },
  { id: 25, region_id: 16, name_en: 'East Shewa',                name_am: 'ምሥራቅ ሸዋ ዞን' },
  { id: 26, region_id: 16, name_en: 'West Shewa',                name_am: 'ምዕራብ ሸዋ ዞን' },
  { id: 27, region_id: 16, name_en: 'North Shewa (Oromia)',      name_am: 'ሰሜን ሸዋ ዞን' },
  { id: 28, region_id: 16, name_en: 'Southwest Shewa',           name_am: 'ደቡብ ምዕራብ ሸዋ ዞን' },
  { id: 29, region_id: 16, name_en: 'East Wellega',              name_am: 'ምሥራቅ ወለጋ ዞን' },
  { id: 30, region_id: 16, name_en: 'West Wellega',              name_am: 'ምዕራብ ወለጋ ዞን' },
  { id: 31, region_id: 16, name_en: 'Kelem Wellega',             name_am: 'ቄለም ወለጋ ዞን' },
  { id: 32, region_id: 16, name_en: 'Horo Guduru Wellega',       name_am: 'ሆሮ ጉዱሩ ወለጋ ዞን' },
  { id: 33, region_id: 16, name_en: 'Illubabor',                 name_am: 'ኢሉባቦር ዞን' },
  { id: 34, region_id: 16, name_en: 'Buno Bedele',               name_am: 'ቡኖ በደሌ ዞን' },
  { id: 35, region_id: 16, name_en: 'Jimma',                     name_am: 'ጅማ ዞን' },
  { id: 36, region_id: 16, name_en: 'Guji',                      name_am: 'ጉጂ ዞን' },
  { id: 37, region_id: 16, name_en: 'West Guji',                 name_am: 'ምዕራብ ጉጂ ዞን' },
  { id: 38, region_id: 16, name_en: 'Adama Special Woreda',      name_am: 'አዳማ ልዩ ወረዳ' },
  { id: 39, region_id: 16, name_en: 'Sheger City',               name_am: 'ሸገር ከተማ' },
  {
    id: 40,
    region_id: 16,
    name_en: 'Finfinne Special Zone Surrounding Oromia',
    name_am: 'የፊንፊኔ ዙሪያ ኦሮሚያ ልዩ ዞን',
    is_active: 0
  },

  // ─── Amhara (region_id: 41) ─────────────────────────────────────────
  { id: 42, region_id: 41, name_en: 'North Gondar',              name_am: 'ሰሜን ጎንደር ዞን' },
  { id: 43, region_id: 41, name_en: 'South Gondar',              name_am: 'ደቡብ ጎንደር ዞን' },
  { id: 44, region_id: 41, name_en: 'West Gondar',               name_am: 'ምዕራብ ጎንደር ዞን' },
  { id: 45, region_id: 41, name_en: 'Awi',                       name_am: 'አገው አዊ ዞን' },
  { id: 46, region_id: 41, name_en: 'East Gojjam',               name_am: 'ምሥራቅ ጎጃም ዞን' },
  { id: 47, region_id: 41, name_en: 'West Gojjam',               name_am: 'ምዕራብ ጎጃም ዞን' },
  { id: 48, region_id: 41, name_en: 'North Wello',               name_am: 'ሰሜን ወሎ ዞን' },
  { id: 49, region_id: 41, name_en: 'South Wello',               name_am: 'ደቡብ ወሎ ዞን' },
  { id: 50, region_id: 41, name_en: 'North Shewa (Amhara)',      name_am: 'ሰሜን ሸዋ ዞን' },
  { id: 51, region_id: 41, name_en: 'Waghemra',                  name_am: 'ዋግ ኸምራ ዞን' },
  { id: 52, region_id: 41, name_en: 'Argoba Special Woreda',     name_am: 'አርጎባ ልዩ ወረዳ' },
  { id: 53, region_id: 41, name_en: 'Bahir Dar Special Zone',    name_am: 'ባሕር ዳር ልዩ ዞን' },
  { id: 54, region_id: 41, name_en: 'Oromo Special Zone',        name_am: 'ኦሮሚያ ልዩ ዞን' },

  // ─── Tigray (region_id: 55) ─────────────────────────────────────────
  { id: 56, region_id: 55, name_en: 'Central Tigray',            name_am: 'ማዕከላዊ ትግራይ ዞን' },
  { id: 57, region_id: 55, name_en: 'Eastern Tigray',            name_am: 'ምሥራቃዊ ትግራይ ዞን' },
  { id: 58, region_id: 55, name_en: 'North Western Tigray',      name_am: 'ሰሜን ምዕራብ ትግራይ ዞን' },
  { id: 59, region_id: 55, name_en: 'Southern Tigray',           name_am: 'ደቡባዊ ትግራይ ዞን' },
  { id: 60, region_id: 55, name_en: 'South Eastern Tigray',      name_am: 'ደቡብ ምሥራቅ ትግራይ ዞን' },
  { id: 61, region_id: 55, name_en: 'Western Tigray',            name_am: 'ምዕራባዊ ትግራይ ዞን' },
  { id: 62, region_id: 55, name_en: 'Mekelle Special Zone',      name_am: 'መቐለ ልዩ ዞን' },

  // ─── Somali (region_id: 63) ─────────────────────────────────────────
  { id: 64, region_id: 63, name_en: 'Afder',                     name_am: 'አፍዴር ዞን' },
  { id: 65, region_id: 63, name_en: 'Doolo',                     name_am: 'ዶሎ ዞን' },
  { id: 66, region_id: 63, name_en: 'Fafan',                     name_am: 'ፋፋን ዞን' },
  { id: 67, region_id: 63, name_en: 'Jarar',                     name_am: 'ጃራር ዞን' },
  { id: 68, region_id: 63, name_en: 'Korahe',                    name_am: 'ቆራሔ ዞን' },
  { id: 69, region_id: 63, name_en: 'Liben',                     name_am: 'ሊበን ዞን' },
  { id: 70, region_id: 63, name_en: 'Nogob',                     name_am: 'ኖጎብ ዞን' },
  { id: 71, region_id: 63, name_en: 'Siti',                      name_am: 'ሲቲ ዞን' },
  { id: 72, region_id: 63, name_en: 'Shabelle',                  name_am: 'ሸበሌ ዞን' },
  { id: 73, region_id: 63, name_en: 'Erer',                      name_am: 'ኤረር ዞን' },

  // ─── Sidama (region_id: 74) ─────────────────────────────────────────
  { id: 75, region_id: 74, name_en: 'Northern Sidama Zone',      name_am: 'ሰሜን ሲዳማ ዞን' },
  { id: 76, region_id: 74, name_en: 'Central Sidama Zone',       name_am: 'ማዕከላዊ ሲዳማ ዞን' },
  { id: 77, region_id: 74, name_en: 'Southern Sidama Zone',      name_am: 'ደቡብ ሲዳማ ዞን' },
  { id: 78, region_id: 74, name_en: 'Eastern Sidama Zone',       name_am: 'ምሥራቅ ሲዳማ ዞን' },
  { id: 79, region_id: 74, name_en: 'Hawassa City Administration', name_am: 'ሐዋሳ ከተማ አስተዳደር' },

  // ─── South West Ethiopia Peoples' (region_id: 80) ───────────────────
  { id: 81, region_id: 80, name_en: 'Keffa',                     name_am: 'ኬፋ ዞን' },
  { id: 82, region_id: 80, name_en: 'Sheka',                     name_am: 'ሸካ ዞን' },
  { id: 83, region_id: 80, name_en: 'Bench Sheko',               name_am: 'ቤንች ሸኮ ዞን' },
  { id: 84, region_id: 80, name_en: 'Dawro',                     name_am: 'ዳውሮ ዞን' },
  { id: 85, region_id: 80, name_en: 'West Omo',                  name_am: 'ምዕራብ ኦሞ ዞን' },
  { id: 86, region_id: 80, name_en: 'Konta',                     name_am: 'ኮንታ ዞን' },

  // ─── South Ethiopia (region_id: 87) ─────────────────────────────────
  { id: 88, region_id: 87, name_en: 'Wolayita',                  name_am: 'ወላይታ ዞን' },
  { id: 89, region_id: 87, name_en: 'Gedeo',                     name_am: 'ጌዴኦ ዞን' },
  { id: 90, region_id: 87, name_en: 'Gamo',                      name_am: 'ጋሞ ዞን' },
  { id: 91, region_id: 87, name_en: 'Gofa',                      name_am: 'ጎፋ ዞን' },
  { id: 92, region_id: 87, name_en: 'South Omo',                 name_am: 'ደቡብ ኦሞ ዞን' },
  { id: 93, region_id: 87, name_en: 'Konso',                     name_am: 'ኮንሶ ዞን' },
  { id: 94, region_id: 87, name_en: 'Amaro Special Woreda',      name_am: 'አማሮ ልዩ ወረዳ' },
  { id: 95, region_id: 87, name_en: 'Basketo Special Woreda',    name_am: 'ባስኬቶ ልዩ ወረዳ' },
  { id: 96, region_id: 87, name_en: 'Burji Special Woreda',      name_am: 'ቡርጂ ልዩ ወረዳ' },
  { id: 97, region_id: 87, name_en: 'Derashe Special Woreda',    name_am: 'ዲራሼ ልዩ ወረዳ' },
  { id: 98, region_id: 87, name_en: 'Ale Special Woreda',        name_am: 'አሌ ልዩ ወረዳ' },

  // ─── Central Ethiopia (region_id: 99) ───────────────────────────────
  { id: 100, region_id: 99, name_en: 'Gurage',                   name_am: 'ጉራጌ ዞን' },
  { id: 101, region_id: 99, name_en: "Silt'e",                   name_am: 'ስልጤ ዞን' },
  { id: 102, region_id: 99, name_en: 'Kembata Tembaro',          name_am: 'ከምባታ ቴምባሮ ዞን' },
  { id: 103, region_id: 99, name_en: 'Halaba Special Zone',      name_am: 'ሀላባ ዞን' },
  { id: 104, region_id: 99, name_en: 'Hadiya',                   name_am: 'ሀዲያ ዞን' },
  { id: 105, region_id: 99, name_en: 'Yem Special Woreda',       name_am: 'የኤም ዞን' },

  // ─── Afar (region_id: 106) ──────────────────────────────────────────
  { id: 107, region_id: 106, name_en: 'Zone 1 (Awsi Rasu)',      name_am: 'አውሲ ረሱ (ዞን 1)' },
  { id: 108, region_id: 106, name_en: 'Zone 2 (Kilbet Rasu)',    name_am: 'ክልበት ረሱ (ዞን 2)' },
  { id: 109, region_id: 106, name_en: 'Zone 3 (Gabi Rasu)',      name_am: 'ጋቢ ረሱ (ዞን 3)' },
  { id: 110, region_id: 106, name_en: 'Zone 4 (Fantena Rasu)',   name_am: 'ፋንቲ ረሱ (ዞን 4)' },
  { id: 111, region_id: 106, name_en: 'Zone 5 (Hari Rasu)',      name_am: 'ሃሪ ረሱ (ዞን 5)' },
  { id: 112, region_id: 106, name_en: 'Argoba Special Woreda',   name_am: 'አርጎባ ልዩ ዞን' },

  // ─── Benishangul-Gumuz (region_id: 113) ─────────────────────────────
  { id: 114, region_id: 113, name_en: 'Asosa',                   name_am: 'አሶሳ ዞን' },
  { id: 115, region_id: 113, name_en: 'Kemashi',                 name_am: 'ካማሺ ዞን' },
  { id: 116, region_id: 113, name_en: 'Metekel',                 name_am: 'መተከል ዞን' },
  { id: 117, region_id: 113, name_en: 'Mao-Komo Special Woreda', name_am: 'ማኦ ኮሞ ልዩ ወረዳ' },
  { id: 118, region_id: 113, name_en: 'Pawi Special Woreda',     name_am: 'ፓዊ ልዩ ወረዳ' },

  // ─── Gambela (region_id: 119) ───────────────────────────────────────
  { id: 120, region_id: 119, name_en: 'Zone 1 (Agnewak/Anyuak)', name_am: 'አኙዋክ ዞን' },
  { id: 121, region_id: 119, name_en: 'Zone 2 (Nuer)',           name_am: 'ኑዌር ዞን' },
  { id: 122, region_id: 119, name_en: 'Zone 3 (Majang)',         name_am: 'ማጃንግ ዞን' },
  { id: 123, region_id: 119, name_en: 'Itang Special Woreda',    name_am: 'ኢታንግ ልዩ ወረዳ' },

  // ─── Harari (region_id: 124) ────────────────────────────────────────
  {
    id: 125,
    region_id: 124,
    name_en: 'Harari (no further zone subdivision)',
    name_am: 'ሐረሪ ክልል (ቀጥታ በወረዳዎች የተዋቀረ)'
  }
];