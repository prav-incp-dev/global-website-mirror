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
npm run seed
```

Создаёт компанию `Our House MLM` и администратора `admin@example.com`, привязанного к этой компании.

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

| Команда          | Описание                                           |
| ---------------- | -------------------------------------------------- |
| `npm run dev`    | Запуск в режиме разработки                         |
| `npm run build`  | Сборка Vite                                        |
| `npm start`      | Запуск в продакшен-режиме                          |
| `npm run seed`   | Сидирование базы данных (компания + администратор) |
| `npm run db:migrate` | Миграции БД + генерация Prisma Client          |
| `npm run db:test:setup` | Создание и сидирование тестовой БД          |
| `npm run lint`   | Проверка кода ESLint                               |
| `npm run format` | Форматирование кода Prettier                       |
| `npm test`       | Запуск Vitest (одиночный прогон)                   |
| `npm run test:e2e` | E2E тесты Playwright (login flow)                |
| `npm run test:e2e:headed` | E2E Playwright в headed-режиме          |

## Тестирование

### Первичная настройка

```bash
npm install
npx playwright install
```

### Подготовка тестовой БД

Тесты запускаются против отдельной тестовой базы данных, чтобы не затирать
девелоперские данные. Строка подключения и тестовый `SESSION_SECRET`
находятся в файле `.env.test`:

```env
DATABASE_URL="postgresql://alice@localhost:5432/ourhouse_mlm_test"
SESSION_SECRET="test-session-secret-not-for-production"
```

Разовая настройка тестовой БД (создаёт БД, применяет схему, сидирует):

```bash
npm run db:test:setup
```

Для E2E используется пользователь из seed:

- email: `admin@example.com`
- password: `password`

> E2E-тесты (Playwright) автоматически запускают `npm run db:test:setup`
> перед стартом сервера, поэтому отдельная подготовка не обязательна.

### Запуск тестов

```bash
# Все Vitest-тесты
npm test

# E2E login-тесты
npm run test:e2e
```

## Модели данных

### Company

| Поле              | Тип                 | Описание                 |
| ----------------- | ------------------- | ------------------------ |
| `id`              | UUID (авто)         | Уникальный идентификатор |
| `name`            | String (уникальный) | Название компании        |
| `primaryWallet`   | String?             | Основной кошелёк         |
| `secondaryWallet` | String?             | Дополнительный кошелёк   |
| `createdAt`       | DateTime            | Дата создания            |
| `updatedAt`       | DateTime            | Дата обновления          |

### User

| Поле              | Тип                                      | Описание                                     |
| ----------------- | ---------------------------------------- | -------------------------------------------- |
| `id`              | UUID (авто)                              | Уникальный идентификатор                     |
| `email`           | String (уникальный)                      | Email пользователя                           |
| `password`        | String                                   | Хэш пароля                                   |
| `role`            | Enum: `Admin`, `Candidate`, `Consultant` | Роль пользователя (по умолчанию `Candidate`) |
| `companyId`       | String (FK → `Company`)                  | Привязка к компании                          |
| `nick`            | String?                                  | Никнейм                                      |
| `fullName`        | String?                                  | Полное имя                                   |
| `memberId`        | String? (уникальный)                     | Идентификатор участника                      |
| `parentId`        | String? (FK → `User`)                    | Родительский пользователь (реферал)          |
| `primaryWallet`   | String?                                  | Основной кошелёк                             |
| `secondaryWallet` | String?                                  | Дополнительный кошелёк                       |
| `createdAt`       | DateTime                                 | Дата создания                                |
| `updatedAt`       | DateTime                                 | Дата обновления                              |

## Структура проекта

```
ourhouse-mlm/
├── pages/           # Страницы React (SSR)
├── prisma/          # Схема и миграции Prisma
├── src/
│   ├── generated/   # Сгенерированный Prisma Client
│   └── plugins/     # Плагины Fastify
├── server.js        # Точка входа сервера
├── vite.config.js   # Конфигурация Vite
└── package.json     # Зависимости и скрипты
```
