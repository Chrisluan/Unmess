import { calcularItem } from "../../../helpers/CalcularItem";
import { custoDaComposicao, precoPeloCusto } from "../../../helpers/Precificacao";

describe("Formação de preço", () => {
  it("markup e lucro chegam ao mesmo preço por caminhos diferentes", () => {
    expect(precoPeloCusto(50, { modo: "markup", percentual: 100 })).toBe(100);
    expect(precoPeloCusto(50, { modo: "lucro", percentual: 50 })).toBe(100);
    expect(precoPeloCusto(50, { modo: "lucro", percentual: 100 })).toBeNull();
  });

  it("custo da composição soma a perda de cada insumo", () => {
    const custo = custoDaComposicao([
      { quantity: 1, supply: { cost: 10, wastePercent: 10 } }, // lona: 11
      { quantity: 0.02, supply: { cost: 150, wastePercent: 0 } } // tinta: 3
    ]);
    expect(custo).toBe(14);
  });
});

describe("Item com acabamentos e custo", () => {
  // Banner 2 × 1 m, 3 peças, R$ 50/m², custo R$ 14/m².
  const banner = {
    quantity: 3,
    width: 2,
    height: 1,
    unitPrice: 50,
    pricingMode: "area",
    unitCost: 14
  };

  it("sem acabamentos, o total é o de sempre e a margem sai do custo", () => {
    const r = calcularItem(banner);
    expect(r.total).toBe(300);
    expect(r.custo).toBe(84);
    expect(r.margem).toBe(72);
  });

  it("acabamento por perímetro mede a peça real e aplica o mínimo na linha", () => {
    const r = calcularItem({
      ...banner,
      finishes: [
        // Bainha: 6 m de contorno × 3 peças = 18 m × R$ 2 = 36
        { name: "Bainha", base: "perimetro", price: 2, minPrice: 10, cost: 0.5, minCost: 0 },
        // Arte: valor fixo, não multiplica pelas peças
        { name: "Arte", base: "fixo", price: 80, cost: 0 },
        // Ilhós por peça com mínimo maior que o calculado
        { name: "Ilhós", base: "unidade", price: 1, minPrice: 15, cost: 0.2 }
      ]
    });
    expect(r.acabamentos.map(a => a.total)).toEqual([36, 80, 15]);
    expect(r.total).toBe(300 + 36 + 80 + 15);
    expect(r.custo).toBe(84 + 9 + 0 + 0.6);
  });

  it("o mínimo do material não vira consumo no custo", () => {
    const r = calcularItem({ ...banner, quantity: 1, width: 0.1, height: 0.1, minMeasure: 1 });
    expect(r.total).toBe(50);
    expect(r.custo).toBe(0.14);
  });

  it("custo desconhecido não inventa margem", () => {
    const r = calcularItem({ ...banner, unitCost: null });
    expect(r.custo).toBeNull();
    expect(r.margem).toBeNull();
  });

  it("desconto sai do total com acabamentos, nunca abaixo de zero", () => {
    const r = calcularItem({ ...banner, discount: 1000, finishes: [{ name: "Arte", base: "fixo", price: 80 }] });
    expect(r.total).toBe(0);
    expect(r.margem).toBeNull();
  });
});
