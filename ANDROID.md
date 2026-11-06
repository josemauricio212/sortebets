# SorteBets no Android

O SorteBets é uma simulação educativa sobre algoritmos de caça-níqueis. Não usa dinheiro real.

## Instalação pela tela inicial

1. Abra https://sortibet777.vercel.app/ no Chrome para Android.
2. Toque no menu de três pontos (⋮).
3. Selecione **Instalar app** ou **Adicionar à tela inicial**, conforme a versão do navegador.
4. Confirme. O SorteBets usa seu ícone de dado, sem tigre.

No Samsung Internet, abra o mesmo endereço e use a opção de adicionar à tela inicial/instalar oferecida pelo navegador.

## Implementação

- Manifesto `manifest.webmanifest`, com nome, tela inicial, modo standalone, tema e ícones 192px/512px em SVG, além de logo WebP.
- Service worker `sw.js` que pré-armazena apenas arquivos públicos da aplicação e usa rede primeiro, com fallback offline para o shell.
- A API de placar (`/api/*`) **nunca é guardada em cache**. O placar online exige conexão.
- Registro PWA sem alterar o motor do jogo.
- HTML e CSS existentes permanecem compatíveis com Safari no iOS.

## Verificações antes de considerar o suporte concluído

- Usar Chrome em Android real e verificar a opção Instalar app.
- Abrir o aplicativo pela tela inicial.
- Testar cadastro, rolos, áudio, troca de abas, algoritmo e placar.
- Testar sem conexão: a interface poderá abrir se já tiver sido armazenada, mas o placar online não funcionará.
- Conferir no DevTools > Application > Manifest e Service Workers, inclusive a validade dos ícones SVG na versão de Chrome desejada.

A atualização no GitHub e o deploy na Vercel não substituem o teste presencial em aparelhos Android.
