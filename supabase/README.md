# Supabase — Controle de Estoque

## 1. Pegar as chaves (frontend)

No painel do Supabase:

**Project Settings → API**

Copie:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** → `VITE_SUPABASE_ANON_KEY`

Cole no arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Nunca use a **service_role** no frontend.

## 2. Criar as tabelas

1. Abra **SQL Editor**
2. Cole o conteúdo de `migrations/001_profiles_e_alteracoes.sql`
3. Clique em **Run**

Isso cria:

- `profiles` — nome, email, role (`operador` | `gestor` | `admin`)
- `estoque_alteracoes` — histórico de correções do estoque
- RLS (só usuário autenticado)
- trigger que cria `profile` ao cadastrar usuário no Auth

## 3. Criar um usuário de teste

**Authentication → Users → Add user**

Depois, se quiser tornar admin:

```sql
update public.profiles
set role = 'admin', nome = 'Davi'
where email = 'seu@email.com';
```

## 4. Reiniciar o app

```bash
npm run dev -- --host
```
