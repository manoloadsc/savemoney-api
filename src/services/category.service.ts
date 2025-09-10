import { badRequestError } from "errors/defaultErrors.js";
import prismaClient from "lib/prisma.js";
import { categories } from "types/categories.js";
import { categoryListDto } from "validatation/category.validation.js";

class CategoryService {

    static categoryNames = categories.map(c => c.es);

    constructor() { }

    async createIfnotExists(name: string) {
        let category = await prismaClient.category.findUnique({ where: { name: name } });
        if (category == null) {
            category = await prismaClient.category.create({ data: { name: name } });
        }
        return category;
    }

    async createfromList(names: string[]) {
        let categories = [];
        for (const name of names) {
            let category = await prismaClient.category.findUnique({ where: { name } });
            if (!category) {
                category = await prismaClient.category.create({ data: { name } });
                categories.push(category);
            }
        }

        return categories
    }
    async createDefaultCategories() {
        let categories = this.createfromList(CategoryService.categoryNames);
        return categories;
    }

    async listCategories({ onlyToUser, userId } : categoryListDto) { 
        if(onlyToUser) { 
            if(!userId) throw badRequestError("Para listar categorias por user, precisa do id.")
            let categories = await prismaClient.category.findMany({
                where : { 
                    transactions : { 
                        some : { 
                            userId
                        }
                    }
                }
            })

            return categories
        }

        return prismaClient.category.findMany()
    }
}
const categoryService = new CategoryService();
export default categoryService;