import MyPageClient from './MyPageClient';
import { PRIVATE_ROBOTS } from '@/lib/seo';
export const metadata = { title: '마이페이지', robots: PRIVATE_ROBOTS };
export default function MyPageLayout({ children }: { children: React.ReactNode }) { return <MyPageClient>{children}</MyPageClient>; }
