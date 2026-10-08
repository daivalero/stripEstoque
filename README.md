# Controle de Estoque

Sistema web/PWA para conferência e organização do estoque físico de uma metalúrgica.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Framer Motion + Lucide React

## Fase atual

**Fase 1** — arquitetura, design system, login, layout e dashboard.

## Como rodar

1. Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

2. Instale e inicie:

```bash
npm install
npm run dev
```

3. Abra o endereço local no navegador (ou no iPhone na mesma rede).

## Observações

- Sem as chaves do Supabase, a tela de login aparece, mas a autenticação não funciona.
- Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Scanner, Excel, inventário e PWA entram nas fases seguintes.
