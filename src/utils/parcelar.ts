import { Decimal } from '@prisma/client/runtime/library'; // ou apenas 'decimal.js' se estiver usando direto

function parcelar(valor: Decimal, qtd: number): Decimal[] {
  const centavos = new Decimal(valor).mul(100).toDecimalPlaces(0); // transforma para centavos
  const base = centavos.div(qtd).floor();
  const sobra = centavos.mod(qtd);

  const parcelas: Decimal[] = [];

  for (let i = 0; i < qtd; i++) {
    const valorParcela = i < sobra.toNumber()
      ? base.plus(1)
      : base;

    parcelas.push(valorParcela.div(100));
  }

  return parcelas;
}

export default parcelar;