import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import QuickAnswer from "../models/QuickAnswer";
import WppKey from "../models/WppKey";
import Company from "../models/Company";
import TicketStatus from "../models/TicketStatus";
import BusinessHour from "../models/BusinessHour";
import Role from "../models/Role";
import Customer from "../models/Customer";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import Holiday from "../models/Holiday";
import Board from "../models/Board";
import PipelineStage from "../models/PipelineStage";
import Deal from "../models/Deal";
import DealActivity from "../models/DealActivity";
import DealTicket from "../models/DealTicket";
import DealItem from "../models/DealItem";
import DealAttachment from "../models/DealAttachment";
import DealTag from "../models/DealTag";
import Sticker from "../models/Sticker";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Supply from "../models/Supply";
import Finish from "../models/Finish";
import ProductSupply from "../models/ProductSupply";
import ProductFinish from "../models/ProductFinish";
import Product from "../models/Product";
import PaymentTerm from "../models/PaymentTerm";
import FinancialAccount from "../models/FinancialAccount";
import FinancialCategory from "../models/FinancialCategory";
import Receivable from "../models/Receivable";
import FinancialEntry from "../models/FinancialEntry";
import CashSession from "../models/CashSession";
import CashMovement from "../models/CashMovement";
import CashSale from "../models/CashSale";
import CashSaleItem from "../models/CashSaleItem";
import Supplier from "../models/Supplier";
import Payable from "../models/Payable";
import CompanyInvoice from "../models/CompanyInvoice";
import TeamChannel from "../models/TeamChannel";
import TeamChannelMember from "../models/TeamChannelMember";
import TeamMessage from "../models/TeamMessage";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  Company,
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  QuickAnswer,
  WppKey,
  TicketStatus,
  BusinessHour,
  Role,
  Customer,
  Tag,
  TicketTag,
  Holiday,
  Board,
  PipelineStage,
  Deal,
  DealActivity,
  DealTicket,
  DealItem,
  DealAttachment,
  DealTag,
  Order,
  OrderItem,
  Supply,
  Finish,
  ProductSupply,
  ProductFinish,
  Product,
  Sticker,
  PaymentTerm,
  FinancialAccount,
  FinancialCategory,
  Receivable,
  Supplier,
  Payable,
  CompanyInvoice,
  FinancialEntry,
  CashSession,
  CashMovement,
  CashSale,
  CashSaleItem,
  TeamChannel,
  TeamChannelMember,
  TeamMessage
];

sequelize.addModels(models);

export default sequelize;
