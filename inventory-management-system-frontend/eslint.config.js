import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Every list page loads its data with `useEffect(() => { fetchData() }, [fetchData])`,
      // where fetchData is a useCallback over the page/size/filter state. That is the
      // intended pattern for fetching from a server we don't control, but the rule
      // counts the setLoading/setRows calls inside it as cascading renders. Left as an
      // error it fires ~30 times and drowns out real findings. Revisit if these pages
      // move to a data-fetching library (React Query/SWR) or a Suspense loader.
      'react-hooks/set-state-in-effect': 'off',
      // AuthContext exports both the provider component and the useAuth hook. This
      // only degrades dev-time fast refresh for that one file.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
