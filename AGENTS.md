# Role and Technology Stack

You are an expert full-stack developer specializing in Fastify and React integration via `@fastify/react` (`@fastify/vite`). Your goal is to write optimized, type-safe code that natively supports Server-Side Rendering (SSR) and hydration.

# Core Documentation & Reference

- Study the official package documentation: https://fastify.dev
- Study the core architectural concepts here: https://fastify.devindex
- Study @fastify/react documentation here: https://vite.fastify.dev/react

# Coding Standards & Syntax

- **Use Arrow Functions**: Always prefer arrow functions (`const myFunc = () => {}`) over the traditional `function` keyword
- **Use `classnames` for compound/conditional classes**: Always use the `classnames` library to build `className` strings instead of template-literal concatenation. Use the object form for conditional classes:
  ```jsx
  import classNames from 'classnames'
  // static + conditional
  className={classNames(styles.tab, { [styles.tabActive]: activeTab === tab.key })}
  // mutually-exclusive static classes
  className={classNames(hasChildren ? styles.row : styles.rowLeaf, { [styles.stale]: isStaleBranch })}
  ```
  Avoid ``className={`${styles.foo} ${cond ? styles.bar : ''}`}``.

# Design

- Follows **Luxury mobile dark theme gold** mobile-first design rules
- Add svg icons as separate .svg files at assets/icons folder. Import them as react components

# Key Architecture Rules

## 1. Routing and File Structure

- Utilize the built-in routing system of `@fastify/react`.
- Page files must export the main component as a default export using an arrow function:
  ```jsx
  const MyPage = () => {
    // component logic
  }
  export default MyPage
  ```

## 2. Data Fetching and SSR

- **Never** use `useEffect` or direct `fetch`/`axios` calls for initial data loading on the client if SSR is required.
- Always use the `useRouteContext()` hook to access data passed from the Fastify server.
- For requests inside `getData` function, use the built-in `$api` object from the route context.
- Example of correct data retrieval in a component:
  ```jsx
  import { useRouteContext } from '@fastify/react/context'

  export const getData = async ({ server, req, reply, $api }) => {
    const user = await server.auth.getUser(req)
    const result = await $api.get('/api/hello')
    return { user, message: result.message }
  }

  const MyPage = () => {
    const { data } = useRouteContext()
    const { user = {} } = data
    return <div>{user.name}</div>
  }

  export default MyPage
  ```

## 3. Client/Server Separation

- Clearly separate code running on the Fastify server (route handlers, plugins) from code rendering in the browser (React components).
- Place React components at src/components directory.

## 4. State Management and Hydration

- Ensure that the state generated on the server seamlessly synchronizes (hydrates) on the client without mismatches.
- Write valid HTML layout to avoid DOM nesting errors that break hydration (e.g., no `div` inside `span` or `p` inside `p`).

## 5. Working with forms in React

- Use react-hook-form library for building forms
