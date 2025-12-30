"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import ImageUpload from "@/components/ImageUpload";

type SiteSettings = {
  site_name: string;
  site_description: string;
  site_keywords: string[];
  site_language: string;
  og_title: string;
  og_description: string;
  og_image: string;
  og_type: string;
  twitter_card_type: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  favicon_url: string;
  apple_touch_icon_url: string;
  android_icon_192_url: string;
  android_icon_512_url: string;
  robots_allow: boolean;
  google_verification: string;
  naver_verification: string;
  sitemap_revalidate: number;
  schema_type: string;
  organization_name: string;
  logo_url: string;
  ga4_id: string;
  gtm_id: string;
  custom_scripts: string;
  theme_color: string;
  canonical_enabled: boolean;
};

export default function SEOSettingsPage() {
  const supabase = createClient();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "Archiving",
    site_description: "",
    site_keywords: [],
    site_language: "ko",
    og_title: "",
    og_description: "",
    og_image: "",
    og_type: "website",
    twitter_card_type: "summary_large_image",
    twitter_title: "",
    twitter_description: "",
    twitter_image: "",
    favicon_url: "",
    apple_touch_icon_url: "",
    android_icon_192_url: "",
    android_icon_512_url: "",
    robots_allow: true,
    google_verification: "",
    naver_verification: "",
    sitemap_revalidate: 3600,
    schema_type: "Organization",
    organization_name: "",
    logo_url: "",
    ga4_id: "",
    gtm_id: "",
    custom_scripts: "",
    theme_color: "#1570EF",
    canonical_enabled: true,
  });

  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/site");
      const result = await res.json();

      if (result.success && result.data) {
        // null 값을 빈 문자열 또는 기본값으로 변환
        const sanitizedData = {
          ...result.data,
          site_description: result.data.site_description || "",
          og_title: result.data.og_title || "",
          og_description: result.data.og_description || "",
          og_image: result.data.og_image || "",
          twitter_title: result.data.twitter_title || "",
          twitter_description: result.data.twitter_description || "",
          twitter_image: result.data.twitter_image || "",
          favicon_url: result.data.favicon_url || "",
          apple_touch_icon_url: result.data.apple_touch_icon_url || "",
          android_icon_192_url: result.data.android_icon_192_url || "",
          android_icon_512_url: result.data.android_icon_512_url || "",
          google_verification: result.data.google_verification || "",
          naver_verification: result.data.naver_verification || "",
          organization_name: result.data.organization_name || "",
          logo_url: result.data.logo_url || "",
          ga4_id: result.data.ga4_id || "",
          gtm_id: result.data.gtm_id || "",
          custom_scripts: result.data.custom_scripts || "",
          site_keywords: result.data.site_keywords || [],
        };
        setSettings(sanitizedData);
      }
    } catch (error) {
      console.error("❌ 설정 조회 실패:", error);
      addToast("설정을 불러오는데 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const res = await fetch("/api/settings/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "저장 실패");
      }

      addToast("설정이 저장되었습니다.", "success");
    } catch (error: any) {
      console.error("❌ 설정 저장 실패:", error);
      addToast(error.message || "설정 저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof SiteSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.site_keywords.includes(keywordInput.trim())) {
      setSettings((prev) => ({
        ...prev,
        site_keywords: [...prev.site_keywords, keywordInput.trim()],
      }));
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setSettings((prev) => ({
      ...prev,
      site_keywords: prev.site_keywords.filter((k) => k !== keyword),
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>로딩 중...</p>
      </div>
    );
  }

  const tabs = [
    { id: "basic", label: "기본 정보" },
    { id: "social", label: "소셜 미디어" },
    { id: "icons", label: "아이콘" },
    { id: "search", label: "검색엔진" },
    { id: "analytics", label: "분석 도구" },
  ];

  return (
    <div>
      <header className="dashboard-Header">
        <DashboardTitle title="SEO 설정" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </header>

      <div className="dashboard-container">
        {/* 탭 네비게이션 */}
        <div className="border-b mb-6">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 기본 정보 탭 */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">
                사이트 이름 *
              </label>
              <input
                type="text"
                value={settings.site_name}
                onChange={(e) => handleInputChange("site_name", e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="예: Archiving"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                사이트 설명
              </label>
              <textarea
                value={settings.site_description}
                onChange={(e) =>
                  handleInputChange("site_description", e.target.value)
                }
                className="w-full px-3 py-2 border rounded"
                rows={3}
                placeholder="150-160자 권장"
              />
              <p className="text-sm text-gray-500 mt-1">
                {settings.site_description.length}자
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                사이트 키워드
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                  className="flex-1 px-3 py-2 border rounded"
                  placeholder="키워드 입력 후 Enter"
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.site_keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {keyword}
                    <button
                      onClick={() => removeKeyword(keyword)}
                      className="hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                사이트 언어
              </label>
              <select
                value={settings.site_language}
                onChange={(e) =>
                  handleInputChange("site_language", e.target.value)
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value="ko">한국어 (ko)</option>
                <option value="en">English (en)</option>
                <option value="ja">日本語 (ja)</option>
                <option value="zh">中文 (zh)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                테마 컬러
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={settings.theme_color}
                  onChange={(e) =>
                    handleInputChange("theme_color", e.target.value)
                  }
                  className="h-10 w-20 border rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.theme_color}
                  onChange={(e) =>
                    handleInputChange("theme_color", e.target.value)
                  }
                  className="flex-1 px-3 py-2 border rounded"
                  placeholder="#1570EF"
                />
              </div>
            </div>
          </div>
        )}

        {/* 소셜 미디어 탭 */}
        {activeTab === "social" && (
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-4">Open Graph (OG)</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    OG 제목
                  </label>
                  <input
                    type="text"
                    value={settings.og_title}
                    onChange={(e) => handleInputChange("og_title", e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="사이트 이름과 동일하게 사용"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    OG 설명
                  </label>
                  <textarea
                    value={settings.og_description}
                    onChange={(e) =>
                      handleInputChange("og_description", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded"
                    rows={2}
                  />
                </div>

                <ImageUpload
                  label="OG 이미지"
                  currentUrl={settings.og_image}
                  folder="og-image"
                  accept="image/jpeg,image/png,image/webp"
                  maxSize={5}
                  onUploadComplete={(url) => handleInputChange("og_image", url)}
                  helpText="권장 크기: 1200x630px"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Twitter Card</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    카드 타입
                  </label>
                  <select
                    value={settings.twitter_card_type}
                    onChange={(e) =>
                      handleInputChange("twitter_card_type", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="summary">Summary</option>
                    <option value="summary_large_image">Summary Large Image</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Twitter 제목
                  </label>
                  <input
                    type="text"
                    value={settings.twitter_title}
                    onChange={(e) =>
                      handleInputChange("twitter_title", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Twitter 설명
                  </label>
                  <textarea
                    value={settings.twitter_description}
                    onChange={(e) =>
                      handleInputChange("twitter_description", e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded"
                    rows={2}
                  />
                </div>

                <ImageUpload
                  label="Twitter 이미지"
                  currentUrl={settings.twitter_image}
                  folder="twitter-image"
                  accept="image/jpeg,image/png,image/webp"
                  maxSize={5}
                  onUploadComplete={(url) => handleInputChange("twitter_image", url)}
                  helpText="OG 이미지와 동일하게 사용 권장"
                />
              </div>
            </div>
          </div>
        )}

        {/* 아이콘 탭 */}
        {activeTab === "icons" && (
          <div className="space-y-6">
            <ImageUpload
              label="Favicon"
              currentUrl={settings.favicon_url}
              folder="favicon"
              accept="image/x-icon,image/vnd.microsoft.icon,image/png"
              maxSize={1}
              onUploadComplete={(url) => handleInputChange("favicon_url", url)}
              helpText="16x16 또는 32x32, .ico 또는 .png"
            />

            <ImageUpload
              label="Apple Touch Icon"
              currentUrl={settings.apple_touch_icon_url}
              folder="icons"
              accept="image/png"
              maxSize={1}
              onUploadComplete={(url) => handleInputChange("apple_touch_icon_url", url)}
              helpText="180x180 PNG"
            />

            <ImageUpload
              label="Android Chrome Icon 192x192"
              currentUrl={settings.android_icon_192_url}
              folder="icons"
              accept="image/png"
              maxSize={1}
              onUploadComplete={(url) => handleInputChange("android_icon_192_url", url)}
              helpText="192x192 PNG"
            />

            <ImageUpload
              label="Android Chrome Icon 512x512"
              currentUrl={settings.android_icon_512_url}
              folder="icons"
              accept="image/png"
              maxSize={2}
              onUploadComplete={(url) => handleInputChange("android_icon_512_url", url)}
              helpText="512x512 PNG"
            />

            <ImageUpload
              label="로고 (Schema.org용)"
              currentUrl={settings.logo_url}
              folder="logo"
              accept="image/jpeg,image/png,image/webp"
              maxSize={2}
              onUploadComplete={(url) => handleInputChange("logo_url", url)}
              helpText="구조화 데이터에 사용됩니다"
            />
          </div>
        )}

        {/* 검색엔진 탭 */}
        {activeTab === "search" && (
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.robots_allow}
                  onChange={(e) =>
                    handleInputChange("robots_allow", e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold">
                  검색엔진 색인 허용
                </span>
              </label>
              <p className="text-sm text-gray-500 mt-1">
                체크 해제 시 검색엔진이 사이트를 색인하지 않습니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Google Search Console 인증 코드
              </label>
              <input
                type="text"
                value={settings.google_verification}
                onChange={(e) =>
                  handleInputChange("google_verification", e.target.value)
                }
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                placeholder="meta 태그의 content 값만 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Naver Search Advisor 인증 코드
              </label>
              <input
                type="text"
                value={settings.naver_verification}
                onChange={(e) =>
                  handleInputChange("naver_verification", e.target.value)
                }
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                placeholder="meta 태그의 content 값만 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Sitemap 재생성 주기
              </label>
              <select
                value={settings.sitemap_revalidate}
                onChange={(e) =>
                  handleInputChange("sitemap_revalidate", parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value={3600}>1시간 (3600초)</option>
                <option value={21600}>6시간 (21600초)</option>
                <option value={43200}>12시간 (43200초)</option>
                <option value={86400}>24시간 (86400초)</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                ISR을 통해 sitemap이 자동으로 재생성됩니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                구조화 데이터 타입
              </label>
              <select
                value={settings.schema_type}
                onChange={(e) =>
                  handleInputChange("schema_type", e.target.value)
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value="Organization">Organization (조직/회사)</option>
                <option value="Person">Person (개인)</option>
                <option value="WebSite">WebSite (웹사이트)</option>
              </select>
            </div>

            {settings.schema_type === "Organization" && (
              <div>
                <label className="block text-sm font-semibold mb-2">
                  조직명
                </label>
                <input
                  type="text"
                  value={settings.organization_name}
                  onChange={(e) =>
                    handleInputChange("organization_name", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="예: Archiving"
                />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.canonical_enabled}
                  onChange={(e) =>
                    handleInputChange("canonical_enabled", e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold">
                  Canonical URL 자동 생성
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 분석 도구 탭 */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Google Analytics 4 측정 ID
              </label>
              <input
                type="text"
                value={settings.ga4_id}
                onChange={(e) => handleInputChange("ga4_id", e.target.value)}
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                placeholder="G-XXXXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Google Tag Manager ID
              </label>
              <input
                type="text"
                value={settings.gtm_id}
                onChange={(e) => handleInputChange("gtm_id", e.target.value)}
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                placeholder="GTM-XXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                커스텀 스크립트
              </label>
              <textarea
                value={settings.custom_scripts}
                onChange={(e) =>
                  handleInputChange("custom_scripts", e.target.value)
                }
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows={6}
                placeholder="<script>...</script> 형태로 입력"
              />
              <p className="text-sm text-gray-500 mt-1">
                주의: 신뢰할 수 있는 스크립트만 입력하세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}