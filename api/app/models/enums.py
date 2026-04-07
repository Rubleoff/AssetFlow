from enum import Enum


class RoleEnum(str, Enum):
    USER = "user"
    ADMIN = "admin"


class AccountType(str, Enum):
    CASH = "cash"
    DEBIT_CARD = "debit_card"
    CREDIT_CARD = "credit_card"
    SAVINGS = "savings"
    BROKERAGE = "brokerage"
    CRYPTO_WALLET = "crypto_wallet"
    LOAN = "loan"
    RESERVE = "reserve"
    FX = "fx"


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    ADJUSTMENT = "adjustment"
    INTEREST = "interest"
    FEE = "fee"
    TAX = "tax"
    DIVIDEND = "dividend"
    DEBT_PAYMENT = "debt_payment"
    ASSET_BUY = "asset_buy"
    ASSET_SELL = "asset_sell"


class TransactionStatus(str, Enum):
    PENDING = "pending"
    POSTED = "posted"


class SourceType(str, Enum):
    MANUAL = "manual"
    IMPORTED = "imported"
    SYSTEM = "system"


class BudgetPeriodType(str, Enum):
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    CUSTOM = "custom"
    ROLLING = "rolling"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ARCHIVED = "archived"


class RecurringFrequency(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class AssetType(str, Enum):
    CASH = "cash"
    DEPOSIT = "deposit"
    STOCK = "stock"
    ETF = "etf"
    BOND = "bond"
    CRYPTO = "crypto"
    METAL = "metal"
    REAL_ESTATE = "real_estate"
    CUSTOM = "custom"


class NotificationType(str, Enum):
    BUDGET_THRESHOLD = "budget_threshold"
    RECURRING_UPCOMING = "recurring_upcoming"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    ANOMALY = "anomaly"
    GOAL_LAGGING = "goal_lagging"
    IMPORT_PENDING = "import_pending"
    ASSET_UPDATE = "asset_update"
    DIGEST = "digest"


class InsightSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ImportRowStatus(str, Enum):
    NEW = "new"
    MATCHED = "matched"
    DUPLICATE = "duplicate"
    ERROR = "error"
    ACCEPTED = "accepted"
