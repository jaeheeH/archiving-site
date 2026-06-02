/**
 * Gallery thumbnail backfill script
 * Usage: node scripts/backfill-gallery-thumbnails.mjs [--url=http://localhost:3000] [--batch=5]
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readDotEnvMigrationToken() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    if (!existsSync(envPath)) return "";

    const line = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((item) => /^\s*MIGRATION_TOKEN\s*=/.test(item));

    if (!line) return "";

    return line
      .replace(/^\s*MIGRATION_TOKEN\s*=\s*/, "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
  } catch {
    return "";
  }
}

const args = process.argv.slice(2);
const baseUrl = args.find((arg) => arg.startsWith("--url="))?.split("=")[1] || "http://localhost:3000";
const batchSize = Number.parseInt(args.find((arg) => arg.startsWith("--batch="))?.split("=")[1] || "5", 10);
const migrationToken = process.env.MIGRATION_TOKEN?.trim() || readDotEnvMigrationToken();

if (!migrationToken) {
  console.error("MIGRATION_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

async function getStatus() {
  const res = await fetch(`${baseUrl}/api/gallery/thumbnails`, {
    headers: {
      "x-migration-token": migrationToken,
    },
  });

  if (!res.ok) {
    throw new Error(`상태 조회 실패: ${res.statusText}`);
  }

  return res.json();
}

async function processBatch(limit) {
  const res = await fetch(`${baseUrl}/api/gallery/thumbnails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-migration-token": migrationToken,
    },
    body: JSON.stringify({ limit }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "썸네일 배치 처리 실패");
  }

  return res.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("갤러리 썸네일 백필 시작");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Batch Size: ${batchSize}`);

  let status = await getStatus();

  console.log(`전체: ${status.status.total}`);
  console.log(`완료: ${status.status.processed}`);
  console.log(`남음: ${status.status.remaining}`);

  while (status.status.remaining > 0) {
    const result = await processBatch(batchSize);

    console.log(`처리: ${result.processed}, 실패: ${result.failed}, 남음: ${result.totalRemaining}`);

    if (result.failedItems?.length) {
      result.failedItems.forEach((item) => {
        console.log(`- 실패 ${item.id}: ${item.error}`);
      });
    }

    status.status.remaining = result.totalRemaining;

    if (result.totalRemaining > 0) {
      await sleep(1500);
    }
  }

  status = await getStatus();
  console.log(`완료율: ${status.status.percentage}%`);
}

main().catch((error) => {
  console.error("썸네일 백필 실패:", error.message);
  process.exit(1);
});
