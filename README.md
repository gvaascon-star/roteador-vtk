# Roteador VTK

Aplicação web instalável para distribuição proporcional de primeiro contato entre vendedores.

## Estrutura
- `index.html`: telas de acesso, distribuição e administração.
- `styles.css`: identidade visual responsiva VTK.
- `app.js`: autenticação Supabase, leitura da fila, encaminhamento, pulo e edição administrativa.
- `manifest.webmanifest` e `sw.js`: suporte básico a instalação PWA.

## Configuração atual
O aplicativo utiliza a URL do projeto Supabase e a publishable key pública. A chave pública pode aparecer no navegador; nunca coloque aqui uma secret key ou service_role key.

## Publicar no GitHub Pages
1. Abra **Settings → Pages**.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Escolha a branch `main` e a pasta `/ (root)`.
4. Salve e aguarde o endereço publicado.

## Antes de uso real
Esta é a primeira versão de interface e integração, ainda não homologada para operação. Antes de liberar:
- revisar RLS em `user_profiles`, `sellers`, `routing_state` e `routing_events`;
- restringir escrita em vendedores ao papel `admin`;
- conferir que as RPCs são seguras contra cliques simultâneos e mantêm o mesmo vendedor pendente globalmente;
- habilitar Realtime para as tabelas necessárias;
- testar login de uma assistente e de um administrador;
- confirmar que a rotina de distribuição mantém o estado ao virar o dia.

**Não use para encaminhamentos reais até concluir essa homologação.**
