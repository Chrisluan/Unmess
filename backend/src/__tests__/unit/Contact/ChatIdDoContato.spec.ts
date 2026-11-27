import chatIdDoContato, {
  digitosDoLid,
  numeroEhLid
} from "../../../helpers/ChatIdDoContato";

describe("Destino de envio e LID", () => {
  it("usa o telefone quando ele é real", () => {
    expect(
      chatIdDoContato({ number: "5544999990000", lid: "272142566477990@lid" }, false)
    ).toBe("5544999990000@c.us");
  });

  it("usa o LID quando o número gravado é só o LID", () => {
    expect(
      chatIdDoContato({ number: "272142566477990", lid: "272142566477990@lid" }, false)
    ).toBe("272142566477990@lid");
  });

  it("descarta o dispositivo do LID", () => {
    expect(digitosDoLid("272142566477990:35@lid")).toBe("272142566477990");
  });

  it("grupo continua indo para o grupo", () => {
    expect(chatIdDoContato({ number: "120363144455900543" }, true)).toBe(
      "120363144455900543@g.us"
    );
  });

  it("reconhece o LID ocupando o lugar do telefone", () => {
    expect(numeroEhLid({ number: "272142566477990", lid: "272142566477990@lid" })).toBe(true);
    expect(numeroEhLid({ number: "5544999990000", lid: "272142566477990@lid" })).toBe(false);
    expect(numeroEhLid({ number: "5544999990000", lid: null })).toBe(false);
  });
});
