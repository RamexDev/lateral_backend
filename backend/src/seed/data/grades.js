// Grade seed data — 18 grades in 6 bands of 3 (SRS FR-PROFILE-005, FR-REF-004).
// Band formula: band_number = CEIL(grade_number / 3).
// Amharic band labels use standard Ethiopian banking/HR terminology.
// tier_classification_am uses "ደረጃ" (grade/level) + number.

export const grades = [
  // ─── Band 1: Support (ድጋፍ) — Grades 1–3 ────────────────────────────
  {
    id: 1,
    grade_number: 1,
    band_number: 1,
    band_label_en: 'Support',
    band_label_am: 'ድጋፍ',
    tier_classification_en: 'Grade 1',
    tier_classification_am: 'ደረጃ 1',
    rank_order: 1
  },
  {
    id: 2,
    grade_number: 2,
    band_number: 1,
    band_label_en: 'Support',
    band_label_am: 'ድጋፍ',
    tier_classification_en: 'Grade 2',
    tier_classification_am: 'ደረጃ 2',
    rank_order: 2
  },
  {
    id: 3,
    grade_number: 3,
    band_number: 1,
    band_label_en: 'Support',
    band_label_am: 'ድጋፍ',
    tier_classification_en: 'Grade 3',
    tier_classification_am: 'ደረጃ 3',
    rank_order: 3
  },

    // ─── Band 2: Associate (ረዳት) — Grades 4–6 ────────────────────────────
  {
    id: 4,
    grade_number: 4,
    band_number: 2,
    band_label_en: 'Associate',
    band_label_am: 'ረዳት',
    tier_classification_en: 'Grade 4',
    tier_classification_am: 'ደረጃ 4',
    rank_order: 4
  },
  {
    id: 5,
    grade_number: 5,
    band_number: 2,
    band_label_en: 'Associate',
    band_label_am: 'ረዳት',
    tier_classification_en: 'Grade 5',
    tier_classification_am: 'ደረጃ 5',
    rank_order: 5
  },
  {
    id: 6,
    grade_number: 6,
    band_number: 2,
    band_label_en: 'Associate',
    band_label_am: 'ረዳት',
    tier_classification_en: 'Grade 6',
    tier_classification_am: 'ደረጃ 6',
    rank_order: 6
  },
  
  // ─── Band 3: Senior (ከፍተኛ) — Grades 7–9 ────────────────────────────
  {
    id: 7,
    grade_number: 7,
    band_number: 3,
    band_label_en: 'Senior',
    band_label_am: 'ከፍተኛ',
    tier_classification_en: 'Grade 7',
    tier_classification_am: 'ደረጃ 7',
    rank_order: 7
  },
  {
    id: 8,
    grade_number: 8,
    band_number: 3,
    band_label_en: 'Senior',
    band_label_am: 'ከፍተኛ',
    tier_classification_en: 'Grade 8',
    tier_classification_am: 'ደረጃ 8',
    rank_order: 8
  },
  {
    id: 9,
    grade_number: 9,
    band_number: 3,
    band_label_en: 'Senior',
    band_label_am: 'ከፍተኛ',
    tier_classification_en: 'Grade 9',
    tier_classification_am: 'ደረጃ 9',
    rank_order: 9
  },

  // ─── Band 4: Manager (አስተዳዳሪ) — Grades 10–12 ───────────────────────
  {
    id: 10,
    grade_number: 10,
    band_number: 4,
    band_label_en: 'Manager',
    band_label_am: 'አስተዳዳሪ',
    tier_classification_en: 'Grade 10',
    tier_classification_am: 'ደረጃ 10',
    rank_order: 10
  },
  {
    id: 11,
    grade_number: 11,
    band_number: 4,
    band_label_en: 'Manager',
    band_label_am: 'አስተዳዳሪ',
    tier_classification_en: 'Grade 11',
    tier_classification_am: 'ደረጃ 11',
    rank_order: 11
  },
  {
    id: 12,
    grade_number: 12,
    band_number: 4,
    band_label_en: 'Manager',
    band_label_am: 'አስተዳዳሪ',
    tier_classification_en: 'Grade 12',
    tier_classification_am: 'ደረጃ 12',
    rank_order: 12
  },

  // ─── Band 5: Director (ዳይሬክተር) — Grades 13–15 ──────────────────────
  {
    id: 13,
    grade_number: 13,
    band_number: 5,
    band_label_en: 'Director',
    band_label_am: 'ዳይሬክተር',
    tier_classification_en: 'Grade 13',
    tier_classification_am: 'ደረጃ 13',
    rank_order: 13
  },
  {
    id: 14,
    grade_number: 14,
    band_number: 5,
    band_label_en: 'Director',
    band_label_am: 'ዳይሬክተር',
    tier_classification_en: 'Grade 14',
    tier_classification_am: 'ደረጃ 14',
    rank_order: 14
  },
  {
    id: 15,
    grade_number: 15,
    band_number: 5,
    band_label_en: 'Director',
    band_label_am: 'ዳይሬክተር',
    tier_classification_en: 'Grade 15',
    tier_classification_am: 'ደረጃ 15',
    rank_order: 15
  },

  // ─── Band 6: Executive (ሥራ አስፈጻሚ) — Grades 16–18 ───────────────────
  {
    id: 16,
    grade_number: 16,
    band_number: 6,
    band_label_en: 'Executive',
    band_label_am: 'ሥራ አስፈጻሚ',
    tier_classification_en: 'Grade 16',
    tier_classification_am: 'ደረጃ 16',
    rank_order: 16
  },
  {
    id: 17,
    grade_number: 17,
    band_number: 6,
    band_label_en: 'Executive',
    band_label_am: 'ሥራ አስፈጻሚ',
    tier_classification_en: 'Grade 17',
    tier_classification_am: 'ደረጃ 17',
    rank_order: 17
  },
  {
    id: 18,
    grade_number: 18,
    band_number: 6,
    band_label_en: 'Executive',
    band_label_am: 'ሥራ አስፈጻሚ',
    tier_classification_en: 'Grade 18',
    tier_classification_am: 'ደረጃ 18',
    rank_order: 18
  }
];