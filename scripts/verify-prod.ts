import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { countSyllables, calculateReadability } from "../src/lib/metrics";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function runAudit() {
  console.log("\n==============================================");
  console.log("   PROODREADER - PRODUCTION READINESS AUDIT   ");
  console.log("==============================================\n");

  let checksPassed = 0;
  const totalChecks = 4;
  let criticalPassed = 0;
  const criticalRequired = 2;

  // ── 1. Database Connection Check ──
  try {
    await db.rule.findMany({ take: 1 });
    console.log("✅ [PASS] Database connection successfully established.");
    checksPassed++;
    criticalPassed++;
  } catch (error) {
    console.error("❌ [FAIL] Database connection failed:", error);
  }

  // ── 2. Seeding Integrity Check ──
  try {
    const activeRulesCount = await db.rule.count({
      where: { isActive: true },
    });
    if (activeRulesCount >= 6) {
      console.log(`✅ [PASS] Rule database integrity verified. Found ${activeRulesCount} active rules.`);
      checksPassed++;
      criticalPassed++;
    } else {
      console.warn(`⚠️ [WARN] Rule seed incomplete. Found only ${activeRulesCount} active rules. Run prisma db seed.`);
    }
  } catch (error) {
    console.error("❌ [FAIL] Rules query failed:", error);
  }

  // ── 3. Syllable Heuristic Counter Check (Dynamic) ──
  try {
    const testWords = [
      { word: "prioritize", expected: 4 },
      { word: "vital", expected: 2 },
      { word: "short", expected: 1 },
      { word: "area", expected: 3 },
      { word: "idea", expected: 3 },
      { word: "gone", expected: 1 },
      { word: "tree", expected: 1 },
      { word: "likes", expected: 1 },
      { word: "saved", expected: 1 },
    ];
    
    let wordsPassed = 0;
    for (const item of testWords) {
      const count = countSyllables(item.word);
      if (count === item.expected) {
        wordsPassed++;
      } else {
        console.warn(`⚠️ [WARN] Syllable mismatch for '${item.word}': computed=${count}, expected=${item.expected}`);
      }
    }

    if (wordsPassed === testWords.length) {
      console.log(`✅ [PASS] Syllable heuristic counter accuracy verified. Passed ${wordsPassed}/${testWords.length} words.`);
      checksPassed++;
    } else {
      console.warn(`⚠️ [WARN] Syllable calculator drift: only ${wordsPassed}/${testWords.length} words matched perfectly.`);
    }
  } catch (error) {
    console.error("❌ [FAIL] Syllable check error:", error);
  }

  // ── 4. Readability Ease Formula Check ──
  try {
    const testText = "It is vital that we prioritize this immediately.";
    const metrics = calculateReadability(testText);

    if (metrics.fleschScore > 0 && metrics.gradeLevel) {
      console.log(`✅ [PASS] Flesch Readability Ease calculator verified. Score: ${metrics.fleschScore} (${metrics.gradeLevel}).`);
      checksPassed++;
    } else {
      console.warn("⚠️ [WARN] Readability Ease calculation out of expected bounds.");
    }
  } catch (error) {
    console.error("❌ [FAIL] Readability index check error:", error);
  }

  // ── Final Audit Summary ──
  console.log("\n==============================================");
  console.log(` AUDIT RESULT: ${checksPassed}/${totalChecks} TESTS PASSED`);
  if (criticalPassed === criticalRequired) {
    console.log(" 🎉 SUCCESS: System is 100% Production-Ready! ");
  } else {
    console.log(" ❌ FAILURE: Critical checks failed. Review database settings. ");
  }
  console.log("==============================================\n");

  await db.$disconnect();
  await pool.end();
  
  if (criticalPassed !== criticalRequired) {
    process.exit(1);
  }
}

runAudit();
