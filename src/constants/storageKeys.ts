/** Chave atual do persist Zustand (localStorage). */
export const PERSIST_STORAGE_KEY = 'planize-storage'

/** Chave legada do projeto; ainda lida para migração automática dos dados. */
export const LEGACY_PERSIST_STORAGE_KEY = 'finance-app-storage'

/** Lembrar email e código do controle no ecrã de login (localStorage). */
export const PLANIZE_LAST_LOGIN_EMAIL_KEY = 'planize_last_login_email'
export const PLANIZE_LAST_CONTROL_CODE_KEY = 'planize_last_control_code'

/** Após login com sucesso, mostrar fluxo «como te chamar» + boas-vindas (sessionStorage). */
export const PLANIZE_POST_LOGIN_WELCOME_KEY = 'planize_post_login_welcome'

/** Nome de boas-vindas (localStorage) — não perder quando o Firestore ainda não tem o campo ou sobrescreve com vazio. */
export const PLANIZE_GREETING_NAME_KEY = 'planize_greeting_name'
