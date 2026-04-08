/**
 * Configuração pública da app Web Firebase do Planize (projeto partilhado por todos os utilizadores).
 *
 * Os utilizadores finais nunca configuram isto: preencha apiKey e appId UMA vez aqui OU nas variáveis
 * VITE_FIREBASE_* na Vercel. Valores em Firebase Console → Definições do projeto → As tuas apps → Web.
 *
 * A chave web não é secreta; a segurança vem das regras Firestore, Auth e domínios autorizados.
 * Quem faz fork com projeto próprio altera aqui ou usa só .env.
 */
export const PLANIZE_PUBLIC_FIREBASE_DEFAULTS = {
  apiKey: 'AIzaSyC6nxVpkBWq1GQ3rQA1T6cIUqAkTcYf_Pk',
  authDomain: 'planize-520c3.firebaseapp.com',
  projectId: 'planize-520c3',
  appId: '1:611094729562:web:b59c3091f27c36ce619963',
} as const
