# AI Marketing Agency - TODO

## Fase 1: Estrutura Base
- [x] Schema do banco de dados (conversas, imagens, artigos, postagens)
- [x] Migrations e tabelas no banco
- [x] Helpers de banco de dados (db.ts)
- [x] Routers tRPC base para todos os módulos

## Fase 2: Sistema de Design
- [x] Configurar tipografia Inter/SF Pro via Google Fonts
- [x] Definir paleta de cores glassmorphism no index.css
- [x] Configurar animações e transições fluidas
- [x] Criar componentes base reutilizáveis (glass, gradient-primary, shimmer, etc.)

## Fase 3: Autenticação e Layout
- [x] Página de login/cadastro com design Apple-inspired
- [x] AppLayout com sidebar glassmorphism
- [x] Navegação entre módulos com sidebar
- [x] Header com perfil do usuário e logout
- [x] Responsividade mobile (sidebar colapsável)

## Fase 4: Módulo Chat com IA
- [x] Interface estilo ChatGPT com bolhas de mensagem
- [x] Histórico de conversas salvo por usuário no banco
- [x] Sidebar de conversas anteriores com rename/delete
- [x] Integração via webhook n8n configurável
- [x] Indicador de digitação (typing dots)
- [x] Suporte a markdown nas respostas (Streamdown)

## Fase 5: Módulo Geração de Imagens
- [x] Campo de prompt com sugestões
- [x] Geração via imageGeneration integrado + webhook n8n
- [x] Armazenamento no banco por usuário
- [x] Galeria de imagens por usuário com grid responsivo
- [x] Modal de visualização ampliada
- [x] Botão de download de imagens

## Fase 6: Módulo Artigos Automáticos
- [x] Input para tema ou URL de notícia
- [x] Geração de artigo completo com IA (JSON schema)
- [x] Editor de texto para revisão antes de publicar
- [x] Armazenamento de artigos por usuário
- [x] Exportação de artigos (copiar, download .md)
- [x] Status: rascunho, publicado, arquivado

## Fase 7: Automação de Postagens
- [x] Separação por canais (Instagram, LinkedIn, Newsletter)
- [x] Formulário de criação de post por canal
- [x] Agendamento de postagens com data/hora
- [x] Integração via webhook n8n para envio
- [x] Histórico de postagens com status
- [x] Preview do post antes de publicar
- [x] Geração de conteúdo com IA por canal e tom de voz

## Fase 8: Finalização
- [x] Responsividade completa mobile/tablet/desktop
- [x] Microinterações e animações fluidas (fade-in-up, hover scale)
- [x] Estados de loading e erro em todos os módulos
- [x] Testes vitest para routers principais (21 testes passando)
- [x] Configurações de webhooks n8n (página de settings)
- [x] Checkpoint final e entrega
