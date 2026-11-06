# SorteBets no iPhone e no iPad

O SorteBets é uma **simulação educativa**, sem apostas com dinheiro real. O site usa HTML, CSS e JavaScript e funciona no Safari do iOS e do iPadOS sem precisar criar um aplicativo nativo.

## Adicionar à tela inicial

1. Abra **https://sortibet777.vercel.app/** no Safari.
2. Toque no botão **Compartilhar**.
3. Selecione **Adicionar à Tela de Início** e confirme.
4. Abra o ícone do SorteBets na tela inicial.

O dado continua como símbolo principal, sem tigre ou estética de caça-níquel comercial.

## Ajustes feitos para iOS

- `viewport-fit=cover` e espaçamentos `safe-area-inset-*` para notch, Dynamic Island e barra Home.
- `100dvh` com fallback `100vh` para o comportamento da barra de endereços.
- Identificação de tela inicial, tema escuro e ícone Apple.
- Áreas de toque e tamanhos adaptados a iPhones menores.
- Correção para navegação horizontal e páginas em modo paisagem.
- Suspensão e sincronização da música quando o Safari sai e retorna à página.
- Animações existentes respeitam a preferência do usuário por movimento reduzido.

## Testes recomendados em iOS real

- Safari em um iPhone SE e em um iPhone com notch/Dynamic Island;
- cadastro, teclado, abas, botão Girar, áudio e placar;
- giro da máquina em retrato e paisagem;
- modo Adicionar à Tela de Início e retorno ao Safari;
- orientação, rolagem e áreas seguras;
- permissões e retomada de Web Audio após o primeiro toque.

**Importante:** as alterações são no código. É necessária validação em um iPhone/iPad real antes de afirmar compatibilidade perfeita com todas as versões do iOS.
