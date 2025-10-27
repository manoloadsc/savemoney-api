import { FastifyInstance } from "fastify";
import categoryService from "services/category.service.js";
import { categoryListQuery, listCategoriesValidation } from "validatation/category.validation.js";
import {zodToJsonSchema} from "zod-to-json-schema";

export default async function categoryRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.get("", {
        schema: {
            tags: ['Category'],
            query: zodToJsonSchema(categoryListQuery),
            response : { 
                200 : zodToJsonSchema(listCategoriesValidation)
            },
            security : [{ bearerAuth : [] }]
        }
    },async (req, res) => {
        let parse = categoryListQuery.parse(req.query)
        let categories =  categoryService.listCategories(parse)

        return categories
    })

}