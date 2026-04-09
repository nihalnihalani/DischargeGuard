/**
 * Simple Flesch-Kincaid grade level estimator.
 * Returns a grade level (6.0 means 6th grade).
 * Target: <= 6.0 for patient discharge instructions.
 */
export function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const asl = words.length / sentences.length; // average sentence length
  const asw = syllableCount / words.length; // average syllables per word

  return 0.39 * asl + 11.8 * asw - 15.59;
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}
