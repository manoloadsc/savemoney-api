import { z } from "zod";

const CategoriesValidation = z.object({
    id : z.number(),
    name : z.string(),
})

export const categoryListQuery = z.object({ onlyToUser : z.boolean(), userId : z.string().optional() })
export type categoryListDto = z.infer<typeof categoryListQuery>
export const listCategoriesValidation = z.array(CategoriesValidation)
