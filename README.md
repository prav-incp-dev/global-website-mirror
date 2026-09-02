# OurHouse MLM

Многоуровневая маркетинговая платформа (MLM) на Fastify + React + Prisma.

## Стек технологий

- **Backend:** Fastify 5
- **Frontend:** React 19, @fastify/react, @fastify/vite
- **База данных:** PostgreSQL + Prisma 7
- **Сборка:** Vite
- **Линтинг/Форматирование:** ESLint, Prettier

## Требования

- Node.js 22+
- PostgreSQL (запущенный локально)

## Установка и запуск

### 1. Клонирование и установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

Убедитесь, что PostgreSQL запущен и доступен. Скопируйте файл
`.env.example` в `.env` и при необходимости измените значения:

```bash
cp .env.example .env
```

По умолчанию используется строка подключения:

```
postgresql://alice@localhost:5432/ourhouse_mlm
```

### 3. Применение миграций

```bash
npm run db:migrate
```

Это создаст таблицы в базе данных согласно моделям Prisma и сгенерирует Prisma Client.

### 4. Сидирование базы данных

```bash
npm run db:seed
```

Создаёт компанию `Our House MLM`, сервисный кошелёк, администратора
`admin@example.com`, консультанта, кандидата (пароль по умолчанию: `password`),
а также пример оплаты.

### 5. Запуск в режиме разработки

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`.

### 6. Сборка для продакшена

```bash
npm run build
```

### 7. Запуск в продакшен-режиме

```bash
npm start
```

## Доступные скрипты

| Команда                   | Описание                                           |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Запуск в режиме разработки                         |
| `npm run build`           | Сборка Vite                                        |
| `npm start`               | Запуск в продакшен-режиме                          |
| `npm run db:seed`         | Сидирование БД (компания, пользователи, оплата)    |
| `npm run db:migrate`      | Миграции БД + генерация Prisma Client              |
| `npm run db:test:setup`   | Создание и сидирование тестовой БД                 |
| `npm run lint`            | Проверка кода ESLint                               |
| `npm run lint:fix`        | Автоисправление ESLint                             |
| `npm run format`          | Форматирование кода Prettier                       |
| `npm test`                | Запуск Vitest (одиночный прогон)                   |
| `npm run test:coverage`   | Vitest с покрытием кода                            |
| `npm run test:e2e`        | E2E тесты Playwright                               |
| `npm run test:e2e:headed` | E2E Playwright в headed-режиме                     |
| `npm run job:reminders`   | Запуск фоновой задачи напоминаний                  |

## Тестирование

### Первичная настройка

```bash
npm install
npx playwright install
```

### Подготовка тестовой БД

Тесты запускаются против отдельной тестовой базы данных, чтобы не затирать
девелоперские данные. Строка подключения и тестовый `SESSION_SECRET` должны
находиться в файле `.env.test`. Для этого выполните команду:

```bash
cp .env.example .env.test
```

```env
DATABASE_URL="postgresql://alice@localhost:5432/ourhouse_mlm_test"
SESSION_SECRET="test-session-secret-not-for-production"
```

Разовая настройка тестовой БД (создаёт БД и применяет схему):

```bash
npm run db:test:setup
```

> E2E-тесты (Playwright) автоматически запускают `npm run db:test:setup`
> перед стартом сервера, поэтому отдельная подготовка не обязательна.

### Запуск тестов

```bash
# Все Vitest-тесты
npm test

# E2E Playwright-тесты
npm run test:e2e
```

Каждый E2E-тест начинается с пустой тестовой БД (`resetDatabase` очищает все
таблицы), а тестовые данные создаются самими тестами через хелперы
`createTestCompany` / `createTestUser` (пароль всех тестовых пользователей —
`password`).

## Модели данных

### Company

| Поле        | Тип                 | Описание                  |
| ----------- | ------------------- | ------------------------- |
| `id`        | Int (авто)          | Уникальный идентификатор  |
| `name`      | String (уникальный) | Название компании         |
| `wallet`    | String?             | Распределительный кошелёк |
| `createdAt` | DateTime            | Дата создания             |
| `updatedAt` | DateTime            | Дата обновления           |

### User

| Поле              | Тип                                      | Описание                                     |
| ----------------- | ---------------------------------------- | -------------------------------------------- |
| `id`              | Int (авто)                               | Уникальный идентификатор                     |
| `email`           | String (уникальный)                      | Email пользователя                           |
| `password`        | String                                   | Хэш пароля                                   |
| `role`            | Enum: `Admin`, `Candidate`, `Consultant` | Роль пользователя (по умолчанию `Candidate`) |
| `companyId`       | Int (FK → `Company`)                     | Привязка к компании                          |
| `nick`            | String? (уникальный)                     | Ник в Телеграм                               |
| `firstName`       | String?                                  | Имя                                          |
| `lastName`        | String?                                  | Фамилия                                      |
| `phone`           | String (уникальный)                      | Телефон                                      |
| `level`           | Int (default 0)                          | Уровень (для консультантов)                  |
| `levelConfirmed`  | Boolean (default true)                   | Подтверждён ли уровень                       |
| `memberId`        | String? (уникальный)                     | Номер пайщика                                |
| `parentId`        | Int? (FK → `User`)                       | Родительский пользователь (реферал)          |
| `orphant`         | Boolean (default false)                  | Признак «осиротевшего» пользователя          |
| `wallet`          | String?                                  | Кошелёк                                      |
| `confirmationCode`| String?                                  | Код подтверждения 2FA/смены пароля           |
| `createdAt`       | DateTime                                 | Дата создания                                |
| `updatedAt`       | DateTime                                 | Дата обновления                              |

### ServiceWallet

| Поле        | Тип                  | Описание                           |
| ----------- | -------------------- | ---------------------------------- |
| `id`        | Int (авто)           | Уникальный идентификатор           |
| `name`      | String (уникальный)  | Название сервисного кошелька       |
| `address`   | String? (уникальный) | Адрес кошелька                     |
| `percent`   | Decimal(4,1)         | Процент начислений (например 40.0) |
| `companyId` | Int (FK → `Company`) | Привязка к компании                |
| `createdAt` | DateTime             | Дата создания                      |
| `updatedAt` | DateTime             | Дата обновления                    |

### Wage

| Поле              | Тип                          | Описание                         |
| ----------------- | ---------------------------- | -------------------------------- |
| `id`              | Int (авто)                   | Уникальный идентификатор         |
| `companyId`       | Int (FK → `Company`)         | Привязка к компании              |
| `userId`          | Int? (FK → `User`)           | Пользователь, которому начислено |
| `serviceWalletId` | Int? (FK → `ServiceWallet`)  | Сервисный кошелек                |
| `paymentId`       | Int? (FK → `Payment`)        | Оплата, по которой начислено     |
| `fromWallet`      | String?                      | Кошелёк отправителя              |
| `toWallet`        | String?                      | Кошелёк получателя               |
| `score`           | Int (default 0)              | Личные продажи                   |
| `groupScore`      | Int (default 0)              | Групповые продажи                |
| `amount`          | Decimal(12,2) (default 0.00) | Сумма начисления                 |
| `createdAt`       | DateTime                     | Дата создания                    |
| `updatedAt`       | DateTime                     | Дата обновления                  |

### UsedInvite

| Поле        | Тип                  | Описание                       |
| ----------- | -------------------- | ------------------------------ |
| `id`        | Int (авто)           | Уникальный идентификатор       |
| `code`      | String (уникальный)  | Код приглашения (был использован) |
| `createdAt` | DateTime             | Дата создания                  |

### Order

| Поле          | Тип                          | Описание                  |
| ------------- | ---------------------------- | ------------------------- |
| `id`          | Int (авто)                   | Уникальный идентификатор  |
| `userId`      | Int (FK → `User`)            | Покупатель                |
| `quantity`    | Int                          | Количество               |
| `totalAmount` | Decimal(12,2)                | Сумма заказа              |
| `status`      | Enum: `Pending`, `Paid`, `Canceled` | Статус заказа      |
| `createdAt`   | DateTime                     | Дата создания             |
| `updatedAt`   | DateTime                     | Дата обновления           |

### Payment

| Поле                | Тип                                                      | Описание                             |
| ------------------- | -------------------------------------------------------- | ------------------------------------ |
| `id`                | Int (авто)                                               | Уникальный идентификатор             |
| `orderId`           | Int (FK → `Order`, уникальный)                           | Заказ                                |
| `userId`            | Int (FK → `User`)                                        | Плательщик                           |
| `companyId`         | Int (FK → `Company`)                                     | Компания                             |
| `amount`            | Decimal(12,2)                                            | Сумма платежа                        |
| `tokenSymbol`       | String (default `"USDT"`)                                | Символ токена                        |
| `tokenContract`     | String                                                   | Адрес контракта токена               |
| `tokenDecimals`     | Int                                                      | Десятичные знаки токена              |
| `chainId`           | Int                                                      | ID сети                              |
| `txHash`            | String? (уникальный)                                     | Хэш транзакции                       |
| `fromWallet`        | String?                                                  | Кошелёк отправителя                  |
| `toWallet`          | String                                                   | Кошелёк получателя                   |
| `status`            | Enum: `Pending`, `Completed`, `ToCancel`, `Canceled`, `Failed` | Статус платежа               |
| `cancelRequestedAt` | DateTime?                                                | Запрос на отмену                     |
| `canceledAt`        | DateTime?                                                | Дата отмены                           |
| `createdAt`         | DateTime                                                 | Дата создания                         |
| `updatedAt`         | DateTime                                                 | Дата обновления                       |

### Interaction

| Поле          | Тип                                              | Описание                             |
| ------------- | ------------------------------------------------ | ------------------------------------ |
| `id`          | Int (авто)                                       | Уникальный идентификатор             |
| `status`      | Enum: `Open`, `Closed` (default `Open`)          | Статус взаимодействия                |
| `plannedAt`   | DateTime                                         | Запланированная дата                 |
| `completedAt` | DateTime?                                        | Дата завершения                      |
| `description` | String                                           | Описание                             |
| `reminderSent`| Boolean (default false)                          | Отправлено ли напоминание            |
| `initiatorId` | Int? (FK → `User`)                               | Кто инициировал (null = регистрация) |
| `targetId`    | Int (FK → `User`)                                | Целевой пользователь                 |
| `createdAt`   | DateTime                                         | Дата создания                        |
| `updatedAt`   | DateTime                                         | Дата обновления                      |

## Структура проекта

```
ourhouse-mlm/
├── pages/               # Страницы React (SSR)
├── prisma/              # Схема и миграции Prisma
├── src/
│   ├── assets/          # Иконки и ассеты
│   ├── components/      # React-компоненты
│   ├── generated/       # Сгенерированный Prisma Client
│   ├── jobs/            # Фоновые задачи (кроны)
│   ├── lib/             # Утилиты
│   ├── plugins/         # Плагины Fastify
│   ├── routes/          # API-маршруты
│   └── services/        # Сервисы (email и др.)
├── tests/               # Unit (Vitest) + E2E (Playwright) тесты
├── scripts/             # Скрипты (в т.ч. setup-test-db)
├── bin/                 # Точки входа утилит (run-reminders)
├── server.js            # Точка входа сервера
├── backend.js           # Сборка Fastify-приложения
├── prisma.config.ts     # Конфигурация Prisma
├── vite.config.js       # Конфигурация Vite
└── package.json         # Зависимости и скрипты
```

## Отправка имейлов

### **MailCatcher локально**

MailCatcher перехватывает электронные письма, отправленные приложением, и отображает их в веб-интерфейсе, поэтому во время разработки вы никогда не отправляете настоящие письма.

Если MailCatcher уже установлен в системе. Запустите его:

```bash
mailcatcher
```

- SMTP-сервер: `http://localhost:1025` (nodemailer отправляет данные сюда)
- Веб-интерфейс: `http://localhost:1080` (просмотр перехваченных писем в браузере)

Убедитесь, что MailCatcher запущен перед запуском сервера бэкенда.

## Обработка криптоплатежей

### Anvil локально

Anvil - быстрый локальный сервер для разработки и тестирования криптоплатежей, часть [Foundry](https://www.getfoundry.sh/).

Установка:

```bash
brew bundle install
```

Сидирование блокчейна (для кошелька с Seed Phrase, который виден в логе запуска Anvil):

```bash
npm run anvil:seed
```

Запуск (в отдельном окне терминала)

```bash
npm run anvil:start
```

### Настройка [Rabby Wallet](https://rabby.io/)

Добавление тестового кошелька
* Import Seed Phrase: test test test test test test test test test test test junk

Настройка Custom Network в Rabby Wallet
* Chain ID: 97
* Network Name: Local Anvil
* RPC URL: http://127.0.0.1:8545
* Currency symbol: tBNB

Добавление токена в Custom Network
* Chain: Local Anvil
* Token Address: 0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35
