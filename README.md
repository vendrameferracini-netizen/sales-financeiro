# FINANCEIRO SALLES

Sistema financeiro e operacional para controle de pacotes de subbase/transportadora.

## O que vem neste projeto

- Aplicacao React com TypeScript
- Estilo com Tailwind
- Build com Vite
- Persistencia online em Supabase
- Exportacao PDF com jsPDF
- Exportacao Excel em XLSX
- Cadastro e edicao de transportadoras
- PWA instalavel com manifest e service worker
- Pasta dist pronta para publicar

## Como rodar no computador

1. Instale o Node.js LTS.
2. Crie um projeto no Supabase.
3. No SQL Editor do Supabase, execute o arquivo `supabase-schema.sql`.
4. Crie um arquivo `.env` baseado em `.env.example`:

```text
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
```

5. Abra o terminal dentro da pasta do projeto.
6. Rode:

```bash
npm install
npm run dev
```

4. Abra o endereco mostrado no terminal.

Normalmente sera:

```text
http://localhost:5173
```

## Como gerar uma versao de producao

Rode:

```bash
npm run build
```

Os arquivos prontos ficam na pasta:

```text
dist
```

## Como testar a versao de producao

Depois do build, rode:

```bash
npm run preview
```

## Como publicar

Use GitHub + Vercel ou a pasta `dist`.

Opcoes comuns:

1. Vercel
   - Build command: npm run build
   - Output directory: dist
   - Environment Variables:
     - VITE_SUPABASE_URL
     - VITE_SUPABASE_ANON_KEY

2. Netlify
   - Build command: npm run build
   - Publish directory: dist

3. Hospedagem propria
   - Envie todo o conteudo da pasta dist para o servidor.

Importante: para funcionar como PWA instalavel, publique em HTTPS.

## Supabase

O app usa Supabase para:

- Transportadoras
- Lancamentos diarios
- Custos fixos
- Empresas
- Pacotes diarios
- Login e senha na tabela `profiles`

As abas Semanal, Quinzenal, Mensal e Lucro Real calculam seus dados a partir dos registros salvos no Supabase.

O Supabase e obrigatorio. Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o app mostra erro visual e nao grava dados localmente.

Tabelas usadas pelo app:

```text
companies
carriers
daily_entries
package_entries
fixed_costs
costs
profiles
```

Credenciais iniciais:

```text
Login: salesfinanceiro
Senha: Sales123
```

A senha inicial e as trocas de senha sao armazenadas em `profiles.senha_hash` ou `profiles.password_hash` usando bcrypt, conforme a coluna existente no banco.

## Como transformar em APK Android

Caminho recomendado com Capacitor:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap init "FINANCEIRO SALLES" "com.salles.financeiro" --web-dir=dist
npx cap add android
npx cap sync android
npx cap open android
```

No Android Studio:

1. Confira nome e icone.
2. Use Build > Generate Signed Bundle / APK.
3. Gere APK assinado ou AAB para Play Store.

## Regras financeiras principais

Receita Total:

- Usa os valores individuais de cada transportadora.

Receita Parceria:

- ML: R$ 8,00 por pacote
- Shopee: R$ 5,00 por pacote
- Avulso: R$ 8,00 por pacote

Diferenca:

```text
Receita Total - Receita Parceria
```

Lucro Real:

```text
Diferenca - Custos Fixos - Custo LogManager
```

Custo LogManager:

```text
Total de Pacotes x R$ 0,25
```

## Transportadoras

Use a aba Transportadoras para:

- Cadastrar nova transportadora
- Editar nome e valores
- Ativar ou inativar transportadora

Transportadoras ativas aparecem no Lancamento Diario.
Transportadoras inativas continuam preservadas nos dados antigos.

## Exportacoes

Nas abas Semanal, Quinzenal e Mensal:

- Exportar PDF Geral
- Exportar PDF por Transportadora
- Exportar Excel

O Excel gera um arquivo .xlsx com:

- Aba Geral
- Aba separada por transportadora
- Periodo do fechamento
- Quantidade por plataforma
- Valores unitarios
- Total por transportadora
- Total geral
