/**
 * 전체 갤러리 이미지 마이그레이션 스크립트
 * 모든 이미지의 embedding을 NULL로 설정하고 다시 분석
 */

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const migrationToken = process.env.MIGRATION_TOKEN;

if (!migrationToken) {
  console.error('❌ MIGRATION_TOKEN 환경변수가 필요합니다.');
  process.exit(1);
}

async function resetAllEmbeddings() {
  console.log('🔄 모든 embedding을 NULL로 초기화 중...');

  // Supabase Admin API를 통해 모든 embedding을 NULL로 설정
  // 이 작업은 Supabase 대시보드에서 직접 SQL 실행:
  // UPDATE gallery SET embedding = NULL;

  console.log('⚠️  Supabase 대시보드에서 다음 SQL을 실행하세요:');
  console.log('   UPDATE gallery SET embedding = NULL;');
  console.log('');

  const readline = (await import('node:readline')).createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question('✅ SQL 실행 완료했나요? (y/n): ', (answer) => {
      readline.close();
      if (answer.toLowerCase() === 'y') {
        resolve(true);
      } else {
        console.log('❌ 마이그레이션 취소됨');
        process.exit(0);
      }
    });
  });
}

async function getMigrationStatus() {
  const res = await fetch(`${baseUrl}/api/gallery/migrate`);
  const data = await res.json();
  return data.status;
}

async function processBatch(limit = 5) {
  console.log(`\n📦 배치 처리 시작 (limit: ${limit})...`);

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

  const data = await res.json();
  return data;
}

async function main() {
  console.log('🚀 전체 갤러리 마이그레이션 시작\n');

  // 1. embedding 초기화 확인
  const shouldReset = process.argv.includes('--reset');
  if (shouldReset) {
    await resetAllEmbeddings();
  }

  // 2. 초기 상태 확인
  let status = await getMigrationStatus();
  console.log('📊 마이그레이션 상태:');
  console.log(`   전체: ${status.total}개`);
  console.log(`   완료: ${status.processed}개`);
  console.log(`   남음: ${status.remaining}개`);
  console.log(`   진행률: ${status.percentage}%\n`);

  if (status.remaining === 0) {
    console.log('✅ 이미 모든 이미지가 처리되었습니다.');
    return;
  }

  // 3. 배치 처리
  let totalProcessed = 0;
  let totalFailed = 0;
  const batchSize = 3; // 한 번에 3개씩 처리 (API 부하 고려)

  while (status.remaining > 0) {
    try {
      const result = await processBatch(batchSize);

      totalProcessed += result.processed;
      totalFailed += result.failed || 0;

      console.log(`✅ 성공: ${result.processed}개`);
      if (result.failed > 0) {
        console.log(`❌ 실패: ${result.failed}개`);
        console.log('실패 항목:', result.failedItems);
      }
      console.log(`📊 남은 개수: ${result.totalRemaining}개`);

      // 다음 배치 전 대기 (API rate limit 고려)
      if (result.totalRemaining > 0) {
        console.log('⏳ 3초 대기 중...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 상태 업데이트
      status.remaining = result.totalRemaining;

    } catch (error) {
      console.error('❌ 배치 처리 오류:', error.message);
      console.log('⏳ 10초 대기 후 재시도...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  // 4. 최종 결과
  console.log('\n🎉 마이그레이션 완료!');
  console.log(`✅ 총 처리: ${totalProcessed}개`);
  console.log(`❌ 총 실패: ${totalFailed}개`);

  // 최종 상태 확인
  const finalStatus = await getMigrationStatus();
  console.log('\n📊 최종 상태:');
  console.log(`   전체: ${finalStatus.total}개`);
  console.log(`   완료: ${finalStatus.processed}개`);
  console.log(`   진행률: ${finalStatus.percentage}%`);
}

// 실행
main().catch(error => {
  console.error('❌ 마이그레이션 실패:', error);
  process.exit(1);
});
