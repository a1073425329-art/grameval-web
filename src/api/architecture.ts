import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'

/**
 * 系统架构举证 —— 管理端「系统架构」页面数据。
 *
 * 后端不写死任何表结构，全部从 information_schema 实时读取，
 * 因此本文件只描述形状，不维护任何"表清单"。
 */

/** 概览指标 */
export interface ArchOverview {
  tableCount: number
  columnCount: number
  /** 表关系数（真实外键或命名约定推断） */
  foreignKeyCount: number
  /** true 表示库中没有真实外键约束，关系由命名约定推断得出 */
  foreignKeyInferred: boolean
  indexCount: number
  indexColumnCount: number
  totalRows: number
  apiCount: number
  moduleCount: number
  tableCommentRate: number
  /** 数据库 COLUMN_COMMENT 非空比例 */
  columnCommentRate: number
  /** 字段语义说明覆盖率（DB 注释 + 系统推断含义，能说清用途的字段比例） */
  columnMeaningRate: number
  /** 论文 3.3.2 节详述的核心业务表数量（对应论文表 3.1–3.12） */
  paperCoreTableCount: number
  /** 核心业务表的字段数合计 */
  paperCoreColumnCount: number
  /** 支撑表数量（= 总表数 - 核心业务表数） */
  supportTableCount: number
  /** 核心业务表的行数合计 */
  paperCoreRows: number
}

/** 数据库信息 */
export interface ArchDatabase {
  productName: string
  productVersion: string
  schemaName: string
  driverName: string
  jdbcUrl: string
  charset: string
  collation: string
  engine: string
}

/** 业务模块统计 */
export interface ArchModule {
  name: string
  description: string
  tableCount: number
  columnCount: number
  rowCount: number
  tableNames: string[]
}

/** 字段明细 */
export interface ArchColumn {
  ordinal: number
  name: string
  comment: string
  dataType: string
  baseType: string
  nullable: string
  columnKey: string
  defaultValue: string
  autoIncrement: boolean
  primaryKey: boolean
  foreignKey: boolean
  uniqueKey: boolean
  /** true = 论文表 3.1–3.12 逐字段设计过的字段；false = 系统扩展字段 */
  paperCore?: boolean
  meaning: string
}

/** 外键 */
export interface ArchForeignKey {
  name: string
  column: string
  refTable: string
  refColumn: string
  /** true = 命名约定推断；false = 数据库真实外键约束 */
  inferred: boolean
}

/** 索引 */
export interface ArchIndex {
  name: string
  columns: string
  unique: boolean
  type: string
}

/** 表明细 */
export interface ArchTable {
  tableName: string
  tableComment: string
  module: string
  purpose: string
  /** 是否为论文 3.3.2 节详述的核心业务表 */
  paperCore: boolean
  /** 对应论文表号（如「表 3.3」），非核心表为 null */
  paperTableNo: string | null
  engine: string
  collation: string
  tableRows: number
  exactRows: number | null
  columnCount: number
  columns: ArchColumn[]
  foreignKeys: ArchForeignKey[]
  indexes: ArchIndex[]
  entityClass: string | null
  repositoryCount: number
}

/** 技术条目 */
export interface ArchTechItem {
  name: string
  version: string
  usage: string
  evidence: string
  core: boolean
  /** 论文证据链：论文中提及该技术的章节/表号（如 "§1.3.2、表 5.1"）；空 = 论文未提 */
  paperRef: string | null
  /** 论文是否提及该技术（版本差异忽略，只看技术是否被论文要求） */
  paperMentioned: boolean
}

/** 技术分层 */
export interface ArchTechLayer {
  layer: string
  description: string
  items: ArchTechItem[]
}

/** 表关系边 */
export interface ArchRelation {
  from: string
  to: string
  fromColumn: string
  toColumn: string
  constraintName: string
  /** true = 命名约定推断；false = 数据库真实外键约束 */
  inferred: boolean
}

/** 架构总览响应 */
export interface SystemArchitecture {
  overview: ArchOverview
  database: ArchDatabase
  modules: ArchModule[]
  tables: ArchTable[]
  techStack: ArchTechLayer[]
  relations: ArchRelation[]
  note: string
  tablePurposeMap: Record<string, string>
}

/**
 * 获取系统架构总览。
 * @param includeRows 是否精确统计行数（大表会慢，默认 false 用估算值）
 */
export const getSystemArchitecture = (includeRows = false) =>
  request.get<ApiResponse<SystemArchitecture>>('/admin/architecture', {
    params: { includeRows },
    timeout: 120_000,
  })
