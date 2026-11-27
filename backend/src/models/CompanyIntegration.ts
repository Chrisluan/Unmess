import {
  Table,
  Column,
  DataType,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import FinancialAccount from "./FinancialAccount";

export const PROVEDORES_DE_COBRANCA = ["asaas"] as const;
export const AMBIENTES_DE_COBRANCA = ["sandbox", "production"] as const;
/** indefinido = o cliente escolhe na fatura entre boleto e Pix. */
export const TIPOS_DE_COBRANCA = ["indefinido", "boleto", "pix"] as const;

/**
 * A conta de uma empresa num gateway de cobrança.
 *
 * É a credencial **da empresa**, e não a do SaaS: o boleto sai em nome dela, o
 * dinheiro cai na conta dela. A chave de API fica cifrada em
 * `apiKeyEncrypted` (helpers/Cifra.ts) e não sai do servidor -- nem para a
 * tela de configuração, que recebe só `apiKeyHint`.
 */
@Table({ tableName: "CompanyIntegrations" })
class CompanyIntegration extends Model<CompanyIntegration> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  provider: string;

  @Default("sandbox")
  @Column(DataType.STRING(12))
  environment: string;

  @Column(DataType.TEXT)
  apiKeyEncrypted: string;

  @Column(DataType.STRING(8))
  apiKeyHint: string;

  @AllowNull(false)
  @Column(DataType.STRING(40))
  webhookPath: string;

  @AllowNull(false)
  @Column(DataType.STRING(80))
  webhookToken: string;

  @Default("indefinido")
  @Column(DataType.STRING(12))
  billingType: string;

  @Default(false)
  @Column
  active: boolean;

  @Column
  lastCheckedAt: Date;

  @Column(DataType.STRING(500))
  lastError: string;

  @Column
  lastWebhookAt: Date;

  @ForeignKey(() => FinancialAccount)
  @Column
  accountId: number;

  @BelongsTo(() => FinancialAccount)
  account: FinancialAccount;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default CompanyIntegration;
