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

## 2. Aplicar as migrations (na ordem)

No **SQL Editor** do Supabase, abra uma nova query, cole o conteúdo de cada arquivo
abaixo e clique em **Run**, um de cada vez, nesta ordem:

| Ordem | Arquivo | Quando rodar |
| --- | --- | --- |
| 1 | `migrations/001_profiles_e_alteracoes.sql` | Só se a tabela `public.profiles` **ainda não existe** no projeto |
| 1 | `migrations/002_estoque_alteracoes.sql` | Se `public.profiles` **já existe** (cria só o histórico de alterações) |
| 2 | `migrations/003_estoque_importacoes_e_itens.sql` | **Fase 2** — importações, itens do ERP, funções de perfil e RLS |
| 3 | `migrations/004_inventarios.sql` | **Fase 2** — tabelas de inventário (a tela vem na Fase 4) |

Todas são idempotentes (podem ser rodadas de novo sem erro) e **não apagam nem alteram
dados existentes**: só criam tabelas, políticas e funções (as funções auxiliares de perfil `is_admin` e `is_gestor_or_admin` são recriadas com a mesma regra, agora comparando `role` como texto).

### O que a Fase 2 cria

- `estoque_importacoes` — sessão de importação (arquivo, usuário, data, status, totais)
- `estoque_itens` — linhas importadas do ERP, ligadas a uma importação
- `inventarios` e `inventario_itens` — estrutura do inventário por localização
- função `importar_estoque(...)` — grava a importação inteira numa única transação
  (se algo falhar, nada é gravado)
- funções `is_operador_or_above()`, `is_gestor_or_admin()` e `is_admin()`

### Permissões (RLS)

| Perfil | Estoque / importações | Importar planilha | Conferência (colunas físicas) | Histórico completo |
| --- | --- | --- | --- | --- |
| `operador` | consultar | não | sim | só o próprio |
| `gestor` | consultar | não | sim | sim |
| `admin` | consultar | **sim** | sim | sim |

- Só os valores `operador`, `gestor` e `admin` (minúsculos) em `profiles.role` dão acesso
  ao estoque. Qualquer outro valor, ou usuário sem `profile`, não enxerga nada.
- `anon` (sem login) não acessa nenhuma tabela nem função.
- As colunas vindas do ERP nunca são editáveis pelo app; só as colunas de conferência
  (`localizacao_fisica`, `quantidade_fisica`, `status_conferencia`, `conferido_*`).
- Uma nova importação marca a anterior como `substituida`, **sem apagar** os itens antigos.
  A exclusão de dados temporários fica para a Fase 4 (e só admin tem permissão de `delete`).

## 3. Criar um usuário de teste

**Authentication → Users → Add user**

Depois, para tornar o usuário administrador (necessário para importar planilhas):

```sql
update public.profiles
set role = 'admin'
where email = 'seu@email.com';
```

Se a sua tabela `profiles` usa `full_name` em vez de `nome`, o comando acima funciona igual
(ele só altera `role`).

## 4. Reiniciar o app

```bash
npm run dev -- --host
```
