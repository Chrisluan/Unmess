import { ocultarValores } from "../../../helpers/permissions/valores";
import {
  comDependencias,
  semDependentes
} from "../../../helpers/permissions/catalog";

describe("Máscara de valores do funil (crm:viewValues)", () => {
  it("troca todo campo de dinheiro por null, em qualquer profundidade", () => {
    const deal = {
      id: 1,
      title: "Banner",
      value: 1500,
      discount: 100,
      items: [
        { id: 7, description: "Lona", quantity: 2, unitPrice: 50, total: 100, discount: 0 }
      ],
      pipelineValue: 9000
    };

    const mascarado = ocultarValores({ deal, advancedTo: { value: 10 } });

    expect(mascarado.deal.value).toBeNull();
    expect(mascarado.deal.discount).toBeNull();
    expect(mascarado.deal.pipelineValue).toBeNull();
    expect(mascarado.deal.items[0].unitPrice).toBeNull();
    expect(mascarado.deal.items[0].total).toBeNull();
    expect(mascarado.advancedTo.value).toBeNull();
  });

  it("preserva o que não é dinheiro, inclusive quantidade e medidas", () => {
    const mascarado = ocultarValores({
      title: "Banner",
      items: [{ description: "Lona", quantity: 2, width: 3, height: 1.5 }]
    });

    expect(mascarado.title).toBe("Banner");
    expect(mascarado.items[0]).toEqual({
      description: "Lona",
      quantity: 2,
      width: 3,
      height: 1.5
    });
  });

  it("não altera o objeto original", () => {
    const original = { value: 10 };
    ocultarValores(original);
    expect(original.value).toBe(10);
  });

  it("distingue sem permissão (null) de grátis (0)", () => {
    expect(ocultarValores({ value: 0 }).value).toBeNull();
  });
});

describe("Permissões novas do funil", () => {
  it.each([
    ["crm:viewValues", ["crm:view"]],
    ["crm:issueOrder", ["crm:view"]],
    ["crm:editItems", ["crm:edit", "crm:view", "crm:viewValues"]],
    ["crm:manageAttachments", ["crm:edit", "crm:view"]]
  ])("%s traz as dependências junto", (nova, deps) => {
    const resultado = comDependencias([nova]);
    deps.forEach(d => expect(resultado).toContain(d));
  });

  it("tirar crm:edit derruba editar itens e anexos, mas não valores nem O.S.", () => {
    const todas = comDependencias([
      "crm:viewValues",
      "crm:issueOrder",
      "crm:editItems",
      "crm:manageAttachments"
    ]);
    const restantes = semDependentes(todas, "crm:edit");

    expect(restantes).not.toContain("crm:editItems");
    expect(restantes).not.toContain("crm:manageAttachments");
    expect(restantes).toContain("crm:viewValues");
    expect(restantes).toContain("crm:issueOrder");
  });

  it("tirar crm:viewValues derruba editar itens e dar desconto", () => {
    const todas = comDependencias(["crm:editItems", "crm:discount", "crm:issueOrder"]);
    const restantes = semDependentes(todas, "crm:viewValues");

    expect(restantes).not.toContain("crm:editItems");
    expect(restantes).not.toContain("crm:discount");
    expect(restantes).toContain("crm:issueOrder");
  });

  it("tirar crm:view derruba todas", () => {
    const todas = comDependencias(["crm:viewValues", "crm:issueOrder", "crm:editItems"]);
    const restantes = semDependentes(todas, "crm:view");
    expect(restantes.filter(p => p.startsWith("crm:"))).toEqual([]);
  });
});
