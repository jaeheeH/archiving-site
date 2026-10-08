import Image from 'next/image';

export default function BrandLogo({ width = 116 }: { width?: number }) {
  return <span className="inline-flex shrink-0" style={{ width }}>
    <Image src="/logo.png" alt="ARCH-B" width={279} height={48} loading="eager" unoptimized className="block h-auto w-full dark:hidden" />
    <Image src="/logo_white.png" alt="ARCH-B" width={279} height={48} loading="eager" unoptimized className="hidden h-auto w-full dark:block" />
  </span>;
}
