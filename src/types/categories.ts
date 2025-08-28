import { Decimal } from "@prisma/client/runtime/library";

/**
 * Catálogo de categorias com PT/EN unificados para evitar divergências.
 * A ordem define o ID (1-based).
 */
export const categories = [
  { pt: "Doações",            en: "Donations" },
  { pt: "Cursos",             en: "Courses" },
  { pt: "Viagens",            en: "Travel" },
  { pt: "Diversão",           en: "Entertainment" },
  { pt: "Salário",            en: "Salary" },
  { pt: "Aluguel",            en: "Rent" },
  { pt: "Auxílio",            en: "Aid" },
  { pt: "Rendimentos",        en: "Revenue" },
  { pt: "Alimentação",        en: "Food" },
  { pt: "Transporte",         en: "Transport" },
  { pt: "Moradia",            en: "Housing" },
  { pt: "Lazer",              en: "Leisure" },
  { pt: "Educação",           en: "Education" },
  { pt: "Roupas",             en: "Clothing" },
  { pt: "Acessórios",         en: "Accessories" },
  { pt: "Presentes",          en: "Gifts" },
  { pt: "Animais",            en: "Pets" },
  { pt: "Beleza",             en: "Beauty" },
  { pt: "Outros",             en: "Other" },
  // Novas categorias
  { pt: "Investimento",       en: "Investment" },
  { pt: "Poupança",           en: "Savings" },
  { pt: "Cofrinho",           en: "Piggy Bank" },
  { pt: "Reserva para Viagem",en: "Travel Fund" },
  { pt: "Reserva para Sonhos",en: "Dream Fund" },
  { pt: "Mentoria",           en: "Mentoring" },
  { pt: "Assessoria",         en: "Consulting" },
  { pt: "Faculdade",          en: "College" },
] as const;

/** Tipos derivados (PT e EN) */
export type CategoryPT = typeof categories[number]["pt"];
export type CategoryEN = typeof categories[number]["en"];

/** Listas prontas em PT/EN (úteis para selects etc.) */
export const categoryNamesPT = categories.map(c => c.pt) as readonly CategoryPT[];
export const categoryNamesEN = categories.map(c => c.en) as readonly CategoryEN[];

/** Mapeamentos PT <-> EN e ID (1-based) */
export const ptToEn: Record<CategoryPT, CategoryEN> = categories.reduce((acc, c) => {
  acc[c.pt] = c.en;
  return acc;
}, {} as Record<CategoryPT, CategoryEN>);

export const enToPt: Record<CategoryEN, CategoryPT> = categories.reduce((acc, c) => {
  acc[c.en] = c.pt;
  return acc;
}, {} as Record<CategoryEN, CategoryPT>);

export const categoryIdByPT: Record<CategoryPT, number> = categories.reduce((acc, c, i) => {
  acc[c.pt] = i + 1; // 1-based
  return acc;
}, {} as Record<CategoryPT, number>);

export const categoryIdByEN: Record<CategoryEN, number> = categories.reduce((acc, c, i) => {
  acc[c.en] = i + 1; // 1-based
  return acc;
}, {} as Record<CategoryEN, number>);

/** Listagem formatada com ID (pode exibir PT/EN juntos) */
export function listCategoriesWithId(includeEnglish = true): string {
  return categories
    .map((c, i) =>
      includeEnglish ? `${i + 1} = ${c.pt} (${c.en})` : `${i + 1} = ${c.pt}`
    )
    .join("\n");
}

/** Agrupamentos canônicos (mantém a origem única das strings) */
export const categoryGroups = {
  essentials: [
    "Alimentação",
    "Aluguel",
    "Transporte",
    "Moradia",
    "Animais",
    "Outros",
    "Salário",
    "Auxílio"
  ],
  dreamAndReservation: [
    "Poupança",
    "Cofrinho",
    "Reserva para Viagem",
    "Reserva para Sonhos",
  ],
  leisure: [
    "Viagens",
    "Diversão",
    "Lazer",
    "Roupas",
    "Acessórios",
    "Presentes",
    "Beleza",
  ],
  investments: [
    "Investimento",
    "Rendimentos",
    "Doações",
  ],
  education: [
    "Cursos",
    "Educação",
    "Mentoria",
    "Assessoria",
    "Faculdade",
  ]
} as const satisfies {
  readonly essentials: readonly CategoryPT[];
  readonly dreamAndReservation: readonly CategoryPT[];
  readonly leisure: readonly CategoryPT[];
  readonly investments: readonly CategoryPT[];
  readonly education: readonly CategoryPT[];
};

/** Tipos por grupo (derivados dos arrays acima) */
export type EssentialCategory = typeof categoryGroups.essentials[number];
export type DreamAndReservationCategory = typeof categoryGroups.dreamAndReservation[number];
export type LeisureCategory = typeof categoryGroups.leisure[number];
export type InvestmentCategory = typeof categoryGroups.investments[number];

/** Type guard genérico para qualquer grupo */
function isCategoryInGroup<G extends keyof typeof categoryGroups>(
  cat: CategoryPT,
  group: G
): cat is (typeof categoryGroups)[G][number] {
  // TS sabe que os arrays são readonly CategoryPT[], então não precisamos de `any`
  return (categoryGroups[group] as readonly CategoryPT[]).includes(cat);
}

/** Type guards específicos, com narrowing real */
export function isEssential(cat: CategoryPT): cat is EssentialCategory {
  return isCategoryInGroup(cat, "essentials");
}

export function isDreamAndReservation(cat: CategoryPT): cat is DreamAndReservationCategory {
  return isCategoryInGroup(cat, "dreamAndReservation");
}

export function isLeisure(cat: CategoryPT): cat is LeisureCategory {
  return isCategoryInGroup(cat, "leisure");
}

export function isInvestment(cat: CategoryPT): cat is InvestmentCategory {
  return isCategoryInGroup(cat, "investments");
}

export function isEducation(cat: CategoryPT): cat is InvestmentCategory {
  return isCategoryInGroup(cat, "education");
}

export interface ByCategory {
  name: CategoryPT;              
  value: Decimal | number;       
  percentage: Decimal | number;  
}

export const toEnglish = (pt: CategoryPT) => ptToEn[pt];
export const toPortuguese = (en: CategoryEN) => enToPt[en];
export const getIdByPT = (pt: CategoryPT) => categoryIdByPT[pt];
export const getIdByEN = (en: CategoryEN) => categoryIdByEN[en];
