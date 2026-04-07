import type { AccountType, AssetType, TransactionType } from "./types";

export const APP_SECTIONS = {
  "/": {
    short: "Сводка",
    title: "Финансовая сводка",
    description: "Баланс, движение денег, цели и сигналы поведения."
  },
  "/accounts": {
    short: "Счета",
    title: "Счета и остатки",
    description: "Карты, наличные, накопления, брокерские и валютные счета."
  },
  "/operations": {
    short: "Операции",
    title: "Операции и движения",
    description: "Доходы, расходы, мерчанты, категории и быстрый ввод."
  },
  "/budgets": {
    short: "Бюджет",
    title: "Бюджеты",
    description: "Лимиты по категориям и прогноз выхода за рамки."
  },
  "/assets": {
    short: "Активы",
    title: "Активы и рынок",
    description: "Крипта, акции, ETF, валюта, металлы и недвижимость."
  },
  "/deposits": {
    short: "Вклады",
    title: "Вклады",
    description: "Открытые вклады, ставка, срок и условия начисления процентов."
  },
  "/goals": {
    short: "Цели",
    title: "Финансовые цели",
    description: "Подушка, техника, отпуск, капитал и крупные покупки."
  },
  "/recurring": {
    short: "Регулярные",
    title: "Регулярные платежи",
    description: "Подписки, аренда, связь, кредиты и напоминания."
  },
  "/reports": {
    short: "Отчёты",
    title: "Отчёты и аналитика",
    description: "Категории, мерчанты, структура портфеля и экспорт."
  },
  "/scenarios": {
    short: "Сценарии",
    title: "Сценарии и прогноз",
    description: "Моделирование дохода, расходов и сроков целей."
  },
  "/notifications": {
    short: "Уведомления",
    title: "Уведомления",
    description: "Аномалии, дайджесты и операционные события."
  },
  "/settings": {
    short: "Настройки",
    title: "Настройки",
    description: "Локаль, базовая валюта, правила и персональные предпочтения."
  },
  "/admin": {
    short: "Админ",
    title: "Администрирование",
    description: "Очередь outbox, фоновые задачи и состояние сервиса."
  }
} as const;

export const CURRENCY_OPTIONS = [
  { code: "RUB", label: "Российский рубль", symbol: "₽" },
  { code: "USD", label: "Доллар США", symbol: "$" },
  { code: "EUR", label: "Евро", symbol: "€" },
  { code: "CNY", label: "Китайский юань", symbol: "¥" },
  { code: "AED", label: "Дирхам ОАЭ", symbol: "AED" },
  { code: "KZT", label: "Тенге", symbol: "₸" },
  { code: "TRY", label: "Турецкая лира", symbol: "₺" },
  { code: "USDT", label: "Tether", symbol: "USDT" },
  { code: "BTC", label: "Bitcoin", symbol: "BTC" },
  { code: "ETH", label: "Ethereum", symbol: "ETH" }
] as const;

export const TIMEZONE_OPTIONS = [
  "Europe/Moscow",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Almaty",
  "America/New_York"
] as const;

export const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string; hint: string }> = [
  { value: "cash", label: "Наличные", hint: "Физические деньги и касса" },
  { value: "debit_card", label: "Дебетовая карта", hint: "Основные повседневные траты" },
  { value: "credit_card", label: "Кредитная карта", hint: "Лимит и задолженность" },
  { value: "savings", label: "Накопительный", hint: "Подушка и резерв" },
  { value: "brokerage", label: "Брокерский", hint: "Инвестиционный счёт" },
  { value: "crypto_wallet", label: "Криптокошелёк", hint: "Криптовалютные остатки" },
  { value: "reserve", label: "Резерв", hint: "Фонд безопасности" },
  { value: "loan", label: "Долг / кредит", hint: "Обязательство и отрицательный баланс" },
  { value: "fx", label: "Валютный счёт", hint: "Хранение валюты" }
];

export const ACCOUNT_PRESETS = [
  { name: "Т-Банк Black", institution_name: "Т-Банк", type: "debit_card" as AccountType, currency: "RUB" },
  { name: "Наличные ₽", institution_name: "Личный", type: "cash" as AccountType, currency: "RUB" },
  { name: "Подушка безопасности", institution_name: "СберБанк", type: "savings" as AccountType, currency: "RUB" },
  { name: "Binance Wallet", institution_name: "Binance", type: "crypto_wallet" as AccountType, currency: "USDT" },
  { name: "Interactive Brokers", institution_name: "IBKR", type: "brokerage" as AccountType, currency: "USD" }
];

export const TRANSACTION_TYPE_OPTIONS: Array<{ value: TransactionType; label: string; hint: string }> = [
  { value: "expense", label: "Расход", hint: "Покупки, услуги, бытовые траты" },
  { value: "income", label: "Доход", hint: "Зарплата, фриланс, перевод от клиента" },
  { value: "adjustment", label: "Движение по цели", hint: "Пополнение или изъятие накоплений" },
  { value: "interest", label: "Проценты", hint: "Начисление по вкладу или счету" },
  { value: "fee", label: "Комиссия", hint: "Комиссии банка или сервиса" },
  { value: "tax", label: "Налог", hint: "Налоги и обязательные списания" },
  { value: "dividend", label: "Дивиденды", hint: "Доход по ценным бумагам" },
  { value: "asset_buy", label: "Покупка актива", hint: "Покупка валюты, крипты, бумаги" },
  { value: "asset_sell", label: "Продажа актива", hint: "Фиксация стоимости актива" }
];

export const OPERATION_PRESETS = [
  { merchant_name: "ВкусВилл", description: "Продукты", type: "expense" as TransactionType, amount: 2450, currency: "RUB" },
  { merchant_name: "Яндекс Go", description: "Такси", type: "expense" as TransactionType, amount: 680, currency: "RUB" },
  { merchant_name: "Ozon", description: "Маркетплейс", type: "expense" as TransactionType, amount: 3190, currency: "RUB" },
  { merchant_name: "Работодатель", description: "Зарплата", type: "income" as TransactionType, amount: 180000, currency: "RUB" },
  { merchant_name: "P2P Binance", description: "Покупка USDT", type: "asset_buy" as TransactionType, amount: 500, currency: "USDT" }
];

export const POPULAR_MERCHANTS = [
  "ВкусВилл",
  "Перекрёсток",
  "Яндекс Go",
  "Яндекс Еда",
  "Ozon",
  "Wildberries",
  "Spotify",
  "Telegram Premium",
  "Netflix",
  "Steam",
  "Binance",
  "Bybit"
] as const;

export const ASSET_TYPE_OPTIONS: Array<{ value: AssetType; label: string; hint: string }> = [
  { value: "crypto", label: "Криптовалюта", hint: "BTC, ETH, SOL, USDT" },
  { value: "stock", label: "Акции", hint: "Одиночные компании" },
  { value: "etf", label: "ETF / индекс", hint: "Фонды и корзины" },
  { value: "cash", label: "Валюта", hint: "USD, EUR, CNY и другие валютные позиции" },
  { value: "metal", label: "Металл", hint: "Золото, серебро" },
  { value: "real_estate", label: "Недвижимость", hint: "Квартира, апартаменты, коммерция" },
  { value: "custom", label: "Другое", hint: "Пользовательский актив" }
];

export const ASSET_PRESETS = [
  { name: "Bitcoin", symbol: "BTC", type: "crypto" as AssetType, currency: "USD", tracking_provider: "coingecko", tracking_external_id: "bitcoin" },
  { name: "Ethereum", symbol: "ETH", type: "crypto" as AssetType, currency: "USD", tracking_provider: "coingecko", tracking_external_id: "ethereum" },
  { name: "S&P 500 ETF", symbol: "VOO", type: "etf" as AssetType, currency: "USD", tracking_provider: "twelvedata" },
  { name: "Apple", symbol: "AAPL", type: "stock" as AssetType, currency: "USD", tracking_provider: "twelvedata" },
  { name: "Физическое золото", symbol: "XAU/USD", type: "metal" as AssetType, currency: "USD", tracking_provider: "twelvedata" },
  { name: "Доллары США", symbol: "USD/RUB", type: "cash" as AssetType, currency: "USD", tracking_provider: "twelvedata" }
];

export const DEPOSIT_PAYOUT_OPTIONS = [
  { value: "monthly", label: "Каждый месяц", hint: "Проценты начисляются ежемесячно" },
  { value: "quarterly", label: "Раз в квартал", hint: "Выплата реже, но по графику" },
  { value: "at_maturity", label: "В конце срока", hint: "Вся доходность в дату закрытия" }
] as const;

export const ASSET_CHART_RANGES = [
  { value: 7, label: "7 дн." },
  { value: 30, label: "30 дн." },
  { value: 90, label: "3 мес." },
  { value: 180, label: "6 мес." },
  { value: 365, label: "1 год" }
] as const;

export const GOAL_PRESETS = [
  { title: "Подушка безопасности", target_amount: 600000, currency: "RUB", monthly_contribution_target: 30000 },
  { title: "Новый ноутбук", target_amount: 180000, currency: "RUB", monthly_contribution_target: 15000 },
  { title: "Отпуск", target_amount: 250000, currency: "RUB", monthly_contribution_target: 20000 },
  { title: "Первый взнос", target_amount: 3000000, currency: "RUB", monthly_contribution_target: 120000 }
];

export const RECURRING_PRESETS = [
  { name: "Аренда квартиры", amount: 75000, currency: "RUB", frequency: "monthly" as const },
  { name: "Интернет", amount: 900, currency: "RUB", frequency: "monthly" as const },
  { name: "Telegram Premium", amount: 299, currency: "RUB", frequency: "monthly" as const },
  { name: "Spotify", amount: 10.99, currency: "USD", frequency: "monthly" as const },
  { name: "Годовая страховка", amount: 24000, currency: "RUB", frequency: "yearly" as const }
];

export const INSTITUTION_OPTIONS = [
  "Т-Банк",
  "СберБанк",
  "Альфа-Банк",
  "ВТБ",
  "Райффайзен",
  "Binance",
  "Bybit",
  "Interactive Brokers",
  "Freedom",
  "Наличные"
] as const;

export const MOBILE_PRIMARY_ROUTES = ["/", "/operations", "/accounts", "/assets", "/goals"] as const;
