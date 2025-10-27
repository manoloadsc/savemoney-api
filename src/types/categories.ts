import { Decimal } from "@prisma/client/runtime/library";

/**
 * Catálogo de categorias com PT/EN/ES unificados para evitar divergências.
 * A ordem define o ID (1-based).
 */
export const categories = [
  { pt: "Doações",            en: "Donations",        es: "Donaciones" },
  { pt: "Cursos",             en: "Courses",          es: "Cursos" },
  { pt: "Viagens",            en: "Travel",           es: "Viajes" },
  { pt: "Diversão",           en: "Entertainment",    es: "Entretenimiento" },
  { pt: "Salário",            en: "Salary",           es: "Salario" },
  { pt: "Aluguel",            en: "Rent",             es: "Alquiler" },
  { pt: "Auxílio",            en: "Aid",              es: "Ayuda" },
  { pt: "Rendimentos",        en: "Revenue",          es: "Ingresos" },
  { pt: "Alimentação",        en: "Food",             es: "Alimentación" },
  { pt: "Transporte",         en: "Transport",        es: "Transporte" },
  { pt: "Moradia",            en: "Housing",          es: "Vivienda" },
  { pt: "Lazer",              en: "Leisure",          es: "Ocio" },
  { pt: "Educação",           en: "Education",        es: "Educación" },
  { pt: "Roupas",             en: "Clothing",         es: "Ropa" },
  { pt: "Acessórios",         en: "Accessories",      es: "Accesorios" },
  { pt: "Presentes",          en: "Gifts",            es: "Regalos" },
  { pt: "Animais",            en: "Pets",             es: "Mascotas" },
  { pt: "Beleza",             en: "Beauty",           es: "Belleza" },
  { pt: "Outros",             en: "Other",            es: "Otros" },
  // Novas categorias
  { pt: "Investimento",       en: "Investment",       es: "Inversión" },
  { pt: "Poupança",           en: "Savings",          es: "Ahorros" },
  { pt: "Cofrinho",           en: "Piggy Bank",       es: "Alcancía" },
  { pt: "Reserva para Viagem",en: "Travel Fund",      es: "Fondo de Viaje" },
  { pt: "Reserva para Sonhos",en: "Dream Fund",       es: "Fondo de Sueños" },
  { pt: "Mentoria",           en: "Mentoring",        es: "Mentoría" },
  { pt: "Assessoria",         en: "Consulting",       es: "Asesoría" },
  { pt: "Faculdade",          en: "College",          es: "Universidad" },
] as const;

/** Tipos derivados (PT, EN e ES) */
export type CategoryPT = typeof categories[number]["pt"];
export type CategoryEN = typeof categories[number]["en"];
export type CategoryES = typeof categories[number]["es"];

/** Listas prontas em PT/EN/ES (úteis para selects etc.) */
export const categoryNamesPT = categories.map(c => c.pt) as readonly CategoryPT[];
export const categoryNamesEN = categories.map(c => c.en) as readonly CategoryEN[];
export const categoryNamesES = categories.map(c => c.es) as readonly CategoryES[];

/** Mapeamentos PT <-> EN/ES e ID (1-based) */
export const ptToEn: Record<CategoryPT, CategoryEN> = categories.reduce((acc, c) => {
  acc[c.pt] = c.en;
  return acc;
}, {} as Record<CategoryPT, CategoryEN>);

export const enToPt: Record<CategoryEN, CategoryPT> = categories.reduce((acc, c) => {
  acc[c.en] = c.pt;
  return acc;
}, {} as Record<CategoryEN, CategoryPT>);

export const ptToEs: Record<CategoryPT, CategoryES> = categories.reduce((acc, c) => {
  acc[c.pt] = c.es;
  return acc;
}, {} as Record<CategoryPT, CategoryES>);

export const esToPt: Record<CategoryES, CategoryPT> = categories.reduce((acc, c) => {
  acc[c.es] = c.pt;
  return acc;
}, {} as Record<CategoryES, CategoryPT>);

export const enToEs: Record<CategoryEN, CategoryES> = categories.reduce((acc, c) => {
  acc[c.en] = c.es;
  return acc;
}, {} as Record<CategoryEN, CategoryES>);

export const esToEn: Record<CategoryES, CategoryEN> = categories.reduce((acc, c) => {
  acc[c.es] = c.en;
  return acc;
}, {} as Record<CategoryES, CategoryEN>);

export const categoryIdByPT: Record<CategoryPT, number> = categories.reduce((acc, c, i) => {
  acc[c.pt] = i + 1; // 1-based
  return acc;
}, {} as Record<CategoryPT, number>);

export const categoryIdByEN: Record<CategoryEN, number> = categories.reduce((acc, c, i) => {
  acc[c.en] = i + 1; // 1-based
  return acc;
}, {} as Record<CategoryEN, number>);

export const categoryIdByES: Record<CategoryES, number> = categories.reduce((acc, c, i) => {
  acc[c.es] = i + 1; // 1-based
  return acc;
}, {} as Record<CategoryES, number>);

/** Listagem formatada com ID (pode exibir PT/EN/ES juntos) */
export function listCategoriesWithId(includeEnglish = true, includeSpanish = false): string {
  return categories
    .map((c, i) =>
      includeEnglish && includeSpanish
        ? `${i + 1} = ${c.pt} (${c.en}) [${c.es}]`
        : includeEnglish
        ? `${i + 1} = ${c.pt} (${c.en})`
        : includeSpanish
        ? `${i + 1} = ${c.pt} [${c.es}]`
        : `${i + 1} = ${c.pt}`
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
export const toSpanish = (pt: CategoryPT) => ptToEs[pt];
export const toPortuguese = (en: CategoryEN) => enToPt[en];
export const toPortugueseFromES = (es: CategoryES) => esToPt[es];
export const getIdByPT = (pt: CategoryPT) => categoryIdByPT[pt];
export const getIdByEN = (en: CategoryEN) => categoryIdByEN[en];
export const getIdByES = (es: CategoryES) => categoryIdByES[es];