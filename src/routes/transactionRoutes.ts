import { notFoundError } from "errors/defaultErrors.js";
import { FastifyInstance } from "fastify";
import transactionsService from "services/transactions.service.js";
import userService from "services/user.service.js";
import { createTransactionValidation, recurringEntriesResponseSchema, entriesListDto, transactionListValidation, transactionWithParcelResponseSchema, updateParcelValidation, updateTransactionValidation, getTransactionById, TransactionByIdResponse } from "validatation/transaction.validation.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export default async function transactionRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.get("", {
        schema: {
            tags: ['Transaction'],
            query: zodToJsonSchema(transactionListValidation),
            response : { 
                200 : zodToJsonSchema(recurringEntriesResponseSchema)
            },
            security : [{ bearerAuth : [] }]
        }
    }, async (req, res) => {
        let userId = req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { success, data, error } = transactionListValidation.safeParse(req.query);

        if (!success) return res.status(400).send({ error: error! });

        const { perPage, page, searchType, endDate, search, startDate, categoryId, type  } = data!;

        let { entries, pageInfo } = await transactionsService.getTransactions(userId, perPage, page, searchType, startDate, endDate, search, categoryId, type); 

        const transactionsToSend = entries.map( entry => {

            let isFutureGoal = entry.notifications && entry.notifications.purpose === "CONFIRM"

            return { 
                ...entry,
                parcelInfo : `${entry.parcels.length}/${isFutureGoal ? entry.notifications?.recurrenceCount : entry.recurrenceCount}`,
                referenceDate : entry.nextReferenceDate,
                parcels : entry.parcels.map(entry => ({ ...entry, count : entry.count }))
            }
        })

        return { pageInfo, entries : transactionsToSend }
    });

    app.get("/:id", {
        schema: {
            tags: ['Transaction'],
            params: zodToJsonSchema(getTransactionById),
            response : { 
                200 : zodToJsonSchema(TransactionByIdResponse)
            },
            security : [{ bearerAuth : [] }]
        }
    }, async (req, res) => {
        let userId = req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { id } = req.params as getTransactionById
        let { notifications,  updatedAt ,...transaction } = await transactionsService.getTransaction(Number(id), userId)
          
        res.status(200).send(transaction)

    });

    // adiconar a busca apenas por ganhos ou gastos
    app.post("", {
        schema: {
            tags: ['Transaction'],
            body: zodToJsonSchema(createTransactionValidation),
            response : { 
                201 : zodToJsonSchema(transactionWithParcelResponseSchema)
            },
            security : [{ bearerAuth : [] }]
        }
    }, async (req, res) => {
        let userId = req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { success, data, error } = createTransactionValidation.safeParse(req.body);
        if (!success) return res.status(400).send({ error: error! });
        let transaction = await transactionsService.createTransaction(data!, userId);
        await userService.updateLastUsedAt(userId);
    
        return res.status(201).send(transaction);
    });

    // deletar uma transação , preciso pergunrtare sobrea sua aplicação pratica de reaslmente deletar algo que ja tem transações... se eu deleto tudo mesmo.
    app.delete("/:id", 
    {
        schema : { 
            tags : ['Transaction'],
            params : zodToJsonSchema(z.object({ id : z.string() })),
            response : { 
                200 : zodToJsonSchema(transactionWithParcelResponseSchema)
            },
            security : [{ bearerAuth : [] }]
        }
    },
    async (req, res) => { 
        let userId = req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { id } = req.params as { id : string };
        let transaction = await transactionsService.deleteTransaction(Number(id), userId);
        return res.status(200).send(transaction);
    })

    // atualizar a transação.
    app.put("/:id", 
        {
            schema : { 
                body : zodToJsonSchema(updateTransactionValidation),
                tags : ["Transaction"],
                security : [{ bearerAuth : [] }]
            },
        }
        ,async (req, res) => { 
        let userId =  req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { id } = req.params as { id : string };
        let { success, data, error } = updateTransactionValidation.safeParse(req.body);
        if (!success) return res.status(400).send({ error: error! });
        let transaction = await transactionsService.updateTransaction(data!, userId, Number(id));
        return res.status(200).send(transaction);
    })

    // atualizart uma parcela.
    app.put("/parcel/:id", {
        schema : { 
            tags : ['Transaction'],
            params : zodToJsonSchema(z.object({ id : z.string() })),
            body : zodToJsonSchema(updateParcelValidation),
            security : [{ bearerAuth : [] }]
        }
    },async (req, res) => {
        let userId =  req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { success, data, error } = updateParcelValidation.safeParse(req.body);
        if (!success) return res.status(400).send({ error: error! });
        let parcel = await transactionsService.updateParcel(data!, userId);
        return res.status(200).send(parcel);
    })

    // remover uma parecela.
    app.delete("/parcel/:id", { 
        schema : { 
            tags : ['Transaction'],
            params : zodToJsonSchema(z.object({ id : z.string() })),
            security : [{ bearerAuth : [] }]
        }
    },async (req, res) => {
        let userId =  req.user.id;
        if (!userId) throw notFoundError("USER_ID not found");
        let { id } = req.params as { id : string };
        let parcel = await transactionsService.deleteParcel(Number(id), userId);
        return res.status(200).send(parcel);
    })
}