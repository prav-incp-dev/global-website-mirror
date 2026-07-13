# OurHouse MLM

Многоуровневая маркетинговая платформа (MLM) на Fastify + React + Prisma.

## Стек технологий

- **Backend:** Fastify 5
- **Frontend:** React 19, @fastify/react, @fastify/vite
- **База данных:** PostgreSQL + Prisma 7
- **Сборка:** Vite
- **Линтинг/Форматирование:** ESLint, Prettier

## Требования

- Node.js 20+
- PostgreSQL (запущенный локально)

## Установка и запуск

### 1. Клонирование и установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

Убедитесь, что PostgreSQL запущен и доступен. По умолчанию используется строка подключения:

```
postgresql://alice@localhost:5432/ourhouse_mlm
```

Вы можете изменить её в файле `.env`:

```env
DATABASE_URL="postgresql://alice@localhost:5432/ourhouse_mlm"
```

### 3. Применение миграций

```bash
npx prisma migrate dev
```

Это создаст таблицы в базе данных согласно моделям Prisma.

### 4. Запуск в режиме разработки

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`.

### 5. Сборка для продакшена

```bash
npm run build
```

### 6. Запуск в продакшен-режиме

```bash
npm start
```

## Доступные скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск в режиме разработки |
| `npm run build` | Сборка Vite |
| `npm start` | Запуск в продакшен-режиме |
| `npm run lint` | Проверка кода ESLint |
| `npm run format` | Форматирование кода Prettier |

## Модели данных

### User

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (авто) | Уникальный идентификатор |
| `email` | String (уникальный) | Email пользователя |
| `password` | String | Хэш пароля |
| `role` | Enum: `Admin`, `Candidate`, `Consultant` | Роль пользователя (по умолчанию `Candidate`) |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

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
