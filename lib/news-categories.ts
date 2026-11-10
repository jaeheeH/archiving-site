export const CATEGORIES = { design: "디자인", development: "개발", ai: "AI", technology: "제품·기술", interiors: "인테리어", editorial: "에디토리얼" } as const;
export type Category = keyof typeof CATEGORIES;
