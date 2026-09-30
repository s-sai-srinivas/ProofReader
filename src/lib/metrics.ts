/**
 * Linguistic Metrics Utility for ProofReader
 * Provides Flesch Reading Ease and document quality calculations.
 */
import { db } from "./db";
import { config } from "./config";

const SYLLABLE_EXCEPTIONS: Record<string, number> = {
  "area": 3,
  "idea": 3,
  "gone": 1,
  "are": 1,
  "were": 1,
  "recipe": 3,
  "prioritize": 4,
  "vital": 2,
  "short": 1,
};

// Heuristic syllable counter for English words
export function countSyllables(word: string): number {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleanWord) return 0;
  
  if (SYLLABLE_EXCEPTIONS[cleanWord] !== undefined) {
    return SYLLABLE_EXCEPTIONS[cleanWord];
  }
  
  if (cleanWord.length <= 3) return 1;

  // Count vowel sequences
  const vowels = /[aeiouy]+/g;
  const matches = cleanWord.match(vowels);
  let count = matches ? matches.length : 0;

  // Split vowel sequences that are pronounced separately (diphthongs)
  const splitVowels = /(ia|io|eo|ua|oa|ea|uo|ae)/g;
  const splitMatches = cleanWord.match(splitVowels);
  if (splitMatches) {
    count += splitMatches.length;
  }

  // Silent 'e' at the end of the word
  if (cleanWord.endsWith("e") && !cleanWord.endsWith("le")) {
    const prevChar = cleanWord.charAt(cleanWord.length - 2);
    if (!"aeiouy".includes(prevChar)) {
      count--;
    }
  }

  // Silent ending suffixes ('es' and 'ed')
  if (cleanWord.endsWith("es") && !cleanWord.endsWith("les") && !cleanWord.endsWith("ses") && !cleanWord.endsWith("xes") && !cleanWord.endsWith("ches") && !cleanWord.endsWith("shes")) {
    count--;
  }
  if (cleanWord.endsWith("ed") && !cleanWord.endsWith("ted") && !cleanWord.endsWith("ded")) {
    count--;
  }

  return Math.max(1, count);
}

export interface ReadabilityMetrics {
  sentences: number;
  words: number;
  syllables: number;
  fleschScore: number;
  gradeLevel: string;
}

export function calculateReadability(
  text: string,
  gradeLevels?: Array<{ minScore: number; label: string }>
): ReadabilityMetrics {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      sentences: 0,
      words: 0,
      syllables: 0,
      fleschScore: 100,
      gradeLevel: "No content",
    };
  }

  // Split sentences by terminal punctuation (. ! ?)
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);

  // Split words and strip non-alphabetic chars
  const words = trimmed.split(/\s+/).filter((w) => w.trim().length > 0);
  const wordCount = Math.max(1, words.length);

  // Count syllables
  let syllableCount = 0;
  for (const word of words) {
    syllableCount += countSyllables(word);
  }
  syllableCount = Math.max(1, syllableCount);

  // Flesch Reading Ease Index Formula
  const score =
    206.835 -
    1.015 * (wordCount / sentenceCount) -
    84.6 * (syllableCount / wordCount);

  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Sort grade levels descending by minScore to guarantee no overlaps or gaps
  const activeLevels = gradeLevels || config.app.gradeLevels;
  const sortedGradeLevels = [...activeLevels].sort((a, b) => b.minScore - a.minScore);
  const matchedLevel = sortedGradeLevels.find((level) => roundedScore >= level.minScore);
  const gradeLevel = matchedLevel ? matchedLevel.label : "College Graduate (Very Confusing)";

  return {
    sentences: sentenceCount,
    words: wordCount,
    syllables: syllableCount,
    fleschScore: roundedScore,
    gradeLevel,
  };
}

import { getSetting } from "./settings";

/**
 * Readability calculator that loads custom thresholds dynamically from database settings.
 */
export async function calculateReadabilityAsync(text: string): Promise<ReadabilityMetrics> {
  interface GradeLevel {
    min?: number;
    minScore?: number;
    label: string;
  }
  const dbLevels = await getSetting<GradeLevel[]>("grade_levels", config.app.gradeLevels as GradeLevel[]);
  
  // Normalize both { min, label } and { minScore, label } schemas for extreme compatibility
  const normalizedLevels = (dbLevels || []).map((item: GradeLevel) => ({
    minScore: item.minScore !== undefined ? Number(item.minScore) : Number(item.min),
    label: item.label,
  }));

  return calculateReadability(text, normalizedLevels);
}

export function calculateDocumentQuality(
  text: string,
  corrections: Array<{ category: string }>,
  weightsMap: Record<string, number> = {}
): number {
  const trimmed = text.trim();
  if (!trimmed) return 100;

  // Deduct points based on mistake density and category severity
  let baseScore = 100;

  for (const c of corrections) {
    const category = (c.category || "").toUpperCase();
    const weight = weightsMap[category] !== undefined ? weightsMap[category] : 1.0;
    baseScore -= weight;
  }

  // Cap lowest score at 10 to encourage improvement and 100 as maximum
  return Math.max(10, Math.min(100, Math.round(baseScore)));
}

export async function getUserMetrics(userId: string, orgId: string, limit = 50, offset = 0) {
  // Database-level fast aggregations
  const totalDocuments = await db.document.count({
    where: { ownerId: userId, orgId },
  });

  const wordSumAggregate = await db.document.aggregate({
    where: { ownerId: userId, orgId },
    _sum: {
      wordCount: true,
    },
  });
  const totalWordsScanned = wordSumAggregate._sum.wordCount || 0;

  const totalCorrectionsDetected = await db.correction.count({
    where: {
      document: {
        ownerId: userId,
        orgId,
      },
    },
  });

  const documents = await db.document.findMany({
    where: { ownerId: userId, orgId },
    include: { corrections: true },
    orderBy: { createdAt: "desc" }, // Fetch newest first for active dashboard feed
    take: limit,
    skip: offset,
  });

  let qualityScoresSum = 0;

  const activeCategories = await db.category.findMany({
    where: {
      isActive: true,
      OR: [
        { orgId: null },
        { orgId: orgId },
      ],
    },
  });

  const categoryBreakdown: Record<string, number> = {};
  const weightsMap: Record<string, number> = {};
  activeCategories.forEach((cat) => {
    const cleanName = cat.name.toUpperCase();
    categoryBreakdown[cleanName] = 0;
    weightsMap[cleanName] = cat.weight;
  });

  const historicalActivity = documents.map((doc) => {
    const qualityScore = calculateDocumentQuality(
      doc.originalContent,
      doc.corrections,
      weightsMap
    );
    qualityScoresSum += qualityScore;

    // Count categories safely
    doc.corrections.forEach((c) => {
      const cat = (c.category || "").toUpperCase();
      if (categoryBreakdown[cat] !== undefined) {
        categoryBreakdown[cat]++;
      } else {
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      }
    });

    return {
      id: doc.id,
      title: doc.title,
      date: doc.createdAt.toISOString().split("T")[0],
      wordCount: doc.wordCount,
      qualityScore,
      correctionsCount: doc.corrections.length,
    };
  });

  const averageQualityScore =
    documents.length > 0 ? Math.round(qualityScoresSum / documents.length) : 100;

  return {
    totalDocuments,
    totalWordsScanned,
    totalCorrectionsDetected,
    averageQualityScore,
    categoryBreakdown,
    historicalActivity,
    documents,
  };
}

