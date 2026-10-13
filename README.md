# Controle de Estoque

Sistema web/PWA para conferência e organização do estoque físico de uma metalúrgica.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Framer Motion + Lucide React

## PWA

- Instalável no Android, iPhone, iPad e desktop.
- No Android/Chrome, use o aviso de instalação exibido pelo app.
- No iPhone/iPad, abra o menu **Compartilhar** e toque em
  **Adicionar à Tela de Início**.
- A interface abre sem conexão; consultas e alterações de estoque exigem
  conexão para evitar dados desatualizados.

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

3. Abra o endereço local no navegador (ou no celular na mesma rede).

Para validar a versão instalável de produção:

```bash
npm run build
npm run preview -- --host
```

## Observações

- Sem as chaves do Supabase, a tela de login aparece, mas a autenticação não funciona.
- Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- A Vercel deve receber `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas
  variáveis de ambiente do projeto.
