import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding default proofreading rules...");

  // Create default organization (avoid hardcoded IDs)
  let defaultOrg = await prisma.organization.findFirst({
    where: { name: "Default Organization" },
  });
  if (!defaultOrg) {
    defaultOrg = await prisma.organization.create({
      data: {
        name: "Default Organization",
      },
    });
  }

  // Create default roles
  const defaultRoles = [
    {
      name: "ADMIN",
      label: "Administrator",
      permissions: ["rules:manage", "categories:manage", "documents:read", "documents:write", "users:manage", "settings:manage"],
    },
    {
      name: "PUBLISHER",
      label: "Publisher",
      permissions: ["documents:read", "documents:write"],
    },
    {
      name: "EDITOR",
      label: "Editor",
      permissions: ["documents:read", "documents:write", "rules:view"],
    },
    {
      name: "VIEWER",
      label: "Viewer",
      permissions: ["documents:read"],
    },
  ];

  const roleMap: Record<string, string> = {};
  for (const role of defaultRoles) {
    const createdRole = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        label: role.label,
        permissions: role.permissions,
      },
      create: {
        name: role.name,
        label: role.label,
        permissions: role.permissions,
      },
    });
    roleMap[role.name] = createdRole.id;
  }

  console.log("  ✓ Default roles seeded.");

  // Guard the demo user behind a production check to remove production risk
  if (process.env.NODE_ENV !== "production") {
    console.log("Seeding demo admin user (non-production)...");
    const demoPassword = await bcrypt.hash("demo1234", 10);
    await prisma.user.upsert({
      where: { email: "demo@proofreader.com" },
      update: {
        roleId: roleMap["ADMIN"],
      },
      create: {
        name: "Demo Admin",
        email: "demo@proofreader.com",
        passwordHash: demoPassword,
        role: "ADMIN",
        roleId: roleMap["ADMIN"],
        orgId: defaultOrg.id,
      },
    });
    console.log("  ✓ Demo user seeded.");
  }

  // Create default categories (omitting hardcoded IDs)
  const defaultCategories = [
    { name: "GRAMMAR", label: "Grammar & Spelling", color: "#22c55e", sortOrder: 0, weight: 3.5 },
    { name: "CLARITY", label: "Conciseness & Clarity", color: "#3b82f6", sortOrder: 1, weight: 2.0 },
    { name: "TONE", label: "Tone & Engagement", color: "#f59e0b", sortOrder: 2, weight: 1.0 },
    { name: "STYLE", label: "Formatting & Style", color: "#ec4899", sortOrder: 3, weight: 1.0 },
  ];

  const catMap: Record<string, string> = {};
  for (const cat of defaultCategories) {
    let createdCat = await prisma.category.findFirst({
      where: { name: cat.name, orgId: null },
    });
    if (createdCat) {
      createdCat = await prisma.category.update({
        where: { id: createdCat.id },
        data: {
          label: cat.label,
          color: cat.color,
          sortOrder: cat.sortOrder,
          weight: cat.weight,
        },
      });
    } else {
      createdCat = await prisma.category.create({
        data: {
          name: cat.name,
          label: cat.label,
          color: cat.color,
          sortOrder: cat.sortOrder,
          weight: cat.weight,
          isActive: true,
          orgId: null,
        },
      });
    }
    catMap[cat.name] = createdCat.id;
  }

  console.log("  ✓ Default categories seeded.");

  // Default rules utilizing dynamic category and organization IDs
  const defaultRules = [
    {
      pattern: "its",
      replacement: "it's",
      category: "GRAMMAR",
      explanation: "Use the apostrophe for the contraction of 'it is'.",
    },
    {
      pattern: "there is several",
      replacement: "there are several",
      category: "GRAMMAR",
      explanation: "Subject-verb agreement: plural subjects require plural verbs.",
    },
    {
      pattern: "in a short period of time",
      replacement: "shortly",
      category: "CLARITY",
      explanation: "Conciseness: Replace wordy constructions with a direct adverb.",
    },
    {
      pattern: "utilize",
      replacement: "use",
      category: "CLARITY",
      explanation: "Clarity: Use simple and familiar verbs where possible.",
    },
    {
      pattern: "just wanted to check",
      replacement: "wanted to check",
      category: "TONE",
      explanation: "Confidence: Remove weak hedge words to project more authority.",
    },
    {
      pattern: "please do not hesitate to contact us",
      replacement: "please contact us",
      category: "STYLE",
      explanation: "Style: Replace outdated boilerplate phrasing with a clean call-to-action.",
    },
  ];

  for (const rule of defaultRules) {
    // Find existing rule or create
    const existingRule = await prisma.rule.findFirst({
      where: {
        pattern: rule.pattern,
        orgId: defaultOrg.id,
      },
    });

    if (existingRule) {
      await prisma.rule.update({
        where: { id: existingRule.id },
        data: {
          replacement: rule.replacement,
          category: rule.category,
          categoryId: catMap[rule.category],
          explanation: rule.explanation,
        },
      });
    } else {
      await prisma.rule.create({
        data: {
          pattern: rule.pattern,
          replacement: rule.replacement,
          category: rule.category,
          categoryId: catMap[rule.category],
          explanation: rule.explanation,
          orgId: defaultOrg.id,
          isActive: true,
        },
      });
    }
  }

  // Create default settings (no changes here but safe to seed)
  const defaultSettings = [
    {
      key: "grade_levels",
      label: "Readability Grade Levels",
      value: [
        { min: 90, label: "5th Grade (Very Easy)" },
        { min: 80, label: "6th Grade (Easy)" },
        { min: 70, label: "7th Grade (Fairly Easy)" },
        { min: 60, label: "8th-9th Grade (Standard)" },
        { min: 50, label: "10th-12th Grade (Fairly Difficult)" },
        { min: 30, label: "College (Difficult)" },
        { min: 0, label: "College Graduate (Very Confusing)" }
      ],
      type: "json",
      category: "scoring",
    },
    {
      key: "category_weights",
      label: "Issue Category Weights",
      value: {
        GRAMMAR: 3.5,
        CLARITY: 2.0,
        TONE: 1.0,
        STYLE: 1.0,
      },
      type: "json",
      category: "scoring",
    },
    {
      key: "password_min_length",
      label: "Minimum Password Length",
      value: 8,
      type: "number",
      category: "general",
    },
    {
      key: "ai_model",
      label: "AI Language Model",
      value: "llama-3.3-70b-versatile",
      type: "string",
      category: "ai",
    },
    {
      key: "ai_timeout_ms",
      label: "AI Request Timeout (ms)",
      value: 30000,
      type: "number",
      category: "ai",
    },
    {
      key: "rate_limit_proofread_limit",
      label: "Proofreading Scan Limit per Minute",
      value: 20,
      type: "number",
      category: "rate-limit",
    },
  ];

  // Remove legacy Gemini-era setting keys superseded by ai_*
  await prisma.setting.deleteMany({
    where: { key: { in: ["gemini_model", "gemini_timeout_ms"] } },
  });

  console.log("Seeding default system settings...");
  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {
        label: setting.label,
        value: setting.value,
        type: setting.type,
        category: setting.category,
      },
      create: {
        key: setting.key,
        label: setting.label,
        value: setting.value,
        type: setting.type,
        category: setting.category,
      },
    });
  }
  console.log("  ✓ Default system settings seeded.");

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
