import { FastifyInstance } from "fastify";
import dashboardService from "services/dashboard.service.js";
import { getDateRangeByType } from "utils/dateRange.js";
import { formatCurrency } from "utils/format.js";
import { DashboardResumeDTO, dashboardResumeValidation, dashboardSchema } from "validatation/dashboard.validation.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export default async function dashboardRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    // receitas, gastos, balanÇo do periodo, balanço total. ideia porcentagem
    // deve acetiar datas futuras ee fazer analises futuras.
    app.get("", {
        schema: {
            tags: ['Dashboard'],
            query: zodToJsonSchema(dashboardResumeValidation),
            response: {
                200: zodToJsonSchema(dashboardSchema)
            },
            security: [{ bearerAuth: [] }]
        }
    }, async (req, res) => {
        let query = req.query as DashboardResumeDTO;
        console.log(query);
        let range = getDateRangeByType(query.searchType, query.startDate, query.endDate);

        let start = query.searchType !== "all" ? range!.gte : new Date(0);
        let end = query.searchType !== "all" ? range!.lte : new Date();

        let dashboard = await dashboardService.buildDashboard(req.user.id, query.perPage, query.page, query.searchType, start, end, query.search);
        res.status(200).send({
            receitas: dashboard.receitas,
            gastos: dashboard.gastos,
            balance: dashboard.balance,
            total: dashboard.total,
            byGroupSumExpenses: dashboard.byGroupSumExpenses.filter(gasto => !gasto.value.equals(0)),
            byGroupSumReceipts: dashboard.byGroupSumReceipts.filter(receitas => !receitas.value.equals(0)),
            parcelsToSend: dashboard.parcelsToSend,
            totalTransactionsCount: dashboard.totalTransactionsCount,
            byDay: dashboard.byDay
        });
    })

}