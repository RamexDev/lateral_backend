import { pool } from '../../db/pool.js';

export async function listGrades() {
  const [rows] = await pool.query(
    'SELECT id, grade_number, band_number, band_label_en, band_label_am, tier_classification_en, tier_classification_am, rank_order FROM grades WHERE is_active = TRUE ORDER BY rank_order ASC'
  );

  return rows.map(row => ({
    id: row.id,
    grade_number: row.grade_number,
    band_number: row.band_number,
    band_label_en: row.band_label_en,
    band_label_am: row.band_label_am,
    tier_classification_en: row.tier_classification_en,
    tier_classification_am: row.tier_classification_am,
    rank_order: row.rank_order
  }));
}
