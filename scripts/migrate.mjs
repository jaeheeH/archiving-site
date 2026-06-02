/**
 * 갤러리 이미지 마이그레이션 스크립트
 * Usage: node scripts/migrate.mjs [--url=http://localhost:3000] [--batch=5]
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
const baseUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch='))?.split('=')[1] || '3');
const migrationToken = process.env.MIGRATION_TOKEN?.trim() || readDotEnvMigrationToken();

if (!migrationToken) {
  console.error('❌ MIGRATION_TOKEN 환경변수가 필요합니다.');
  process.exit(1);
}

// Node.js 18+ fetch polyfill check
if (typeof fetch === 'undefined') {
  console.error('❌ fetch is not available. Please use Node.js 18 or higher.');
  process.exit(1);
}

console.log(`🔧 설정:`);
console.log(`   Base URL: ${baseUrl}`);
console.log(`   Batch Size: ${batchSize}\n`);

async function getStatus() {
  const res = await fetch(`${baseUrl}/api/gallery/migrate`, {
    headers: {
      'x-migration-token': migrationToken
    }
  });
  if (!res.ok) {
    throw new Error(`상태 조회 실패: ${res.statusText}`);
  }
  return await res.json();
}

async function processBatch(limit) {
  const res = await fetch(`${baseUrl}/api/gallery/migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-migration-token': migrationToken
    },
    body: JSON.stringify({ limit })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '배치 처리 실패');
  }

  return await res.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 갤러리 마이그레이션 시작\n');

  // 초기 상태
  let status = await getStatus();
  console.log('📊 초기 상태:');
  console.log(`   전체: ${status.status.total}개`);
  console.log(`   완료: ${status.status.processed}개`);
  console.log(`   남음: ${status.status.remaining}개`);
  console.log(`   진행률: ${status.status.percentage}%\n`);

  if (status.status.remaining === 0) {
    console.log('✅ 모든 이미지가 이미 처리되었습니다.');
    return;
  }

  console.log('⚠️  시작하기 전에:');
  console.log('   1. 개발 서버가 실행 중인지 확인하세요 (npm run dev)');
  console.log('   2. Supabase에서 embedding을 초기화하려면 reset-embeddings.sql을 실행하세요\n');

  let totalProcessed = 0;
  let totalFailed = 0;
  let batchCount = 0;

  while (status.status.remaining > 0) {
    batchCount++;
    console.log(`\n📦 배치 #${batchCount} 처리 중...`);

    try {
      const result = await processBatch(batchSize);

      totalProcessed += result.processed;
      totalFailed += result.failed || 0;

      console.log(`   ✅ 성공: ${result.processed}개`);

      if (result.failed > 0) {
        console.log(`   ❌ 실패: ${result.failed}개`);
        if (result.failedItems && result.failedItems.length > 0) {
          result.failedItems.forEach(item => {
            console.log(`      - [${item.id}] ${item.title}: ${item.error}`);
          });
        }
      }

      if (result.processedItems && result.processedItems.length > 0) {
        result.processedItems.forEach(item => {
          console.log(`      ✓ [${item.id}] ${item.title}`);
        });
      }

      console.log(`   📊 남은 개수: ${result.totalRemaining}개`);

      // 진행률 표시
      const currentStatus = await getStatus();
      const progress = currentStatus.status.percentage;
      const bar = '█'.repeat(Math.floor(progress / 2)) + '░'.repeat(50 - Math.floor(progress / 2));
      console.log(`   [${bar}] ${progress}%`);

      status.status.remaining = result.totalRemaining;

      // 다음 배치 전 대기
      if (result.totalRemaining > 0) {
        console.log('   ⏳ 3초 대기...');
        await sleep(3000);
      }

    } catch (error) {
      console.error(`   ❌ 오류: ${error.message}`);
      console.log('   ⏳ 10초 대기 후 재시도...');
      await sleep(10000);
    }
  }

  // 최종 결과
  console.log('\n' + '='.repeat(60));
  console.log('🎉 마이그레이션 완료!');
  console.log('='.repeat(60));
  console.log(`✅ 총 성공: ${totalProcessed}개`);
  console.log(`❌ 총 실패: ${totalFailed}개`);
  console.log(`📦 총 배치: ${batchCount}개`);

  // 최종 상태
  const finalStatus = await getStatus();
  console.log('\n📊 최종 상태:');
  console.log(`   전체: ${finalStatus.status.total}개`);
  console.log(`   완료: ${finalStatus.status.processed}개`);
  console.log(`   진행률: ${finalStatus.status.percentage}%`);
}

main().catch(error => {
  console.error('\n❌ 마이그레이션 실패:', error.message);
  process.exit(1);
});
