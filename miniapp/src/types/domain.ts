// Domain types — reference data shapes.

export type Lang = 'en' | 'am';

export interface Bank {
  id: number;
  name: string;
  name_am: string;
  nickname: string;
}

export interface Region {
  id: number;
  name_en: string;
  name_am: string;
  type?: 'region' | 'chartered_city';
}

export interface Zone {
  id: number;
  region_id: number;
  name_en: string;
  name_am: string;
  region_name_en?: string;
  region_name_am?: string;
  selected?: boolean;
}

export interface Grade {
  id: number;
  grade_number: number;
  band_number: number;
  band_label_en: string;
  band_label_am: string;
  tier_classification_en: string;
  tier_classification_am: string;
}

export interface GradeRow {
  id: number;
  grade_number: number;
  band_number: number;
  band_label_en: string;
  band_label_am: string;
  tier_classification_en: string;
  tier_classification_am: string;
  rank_order: number;
}
