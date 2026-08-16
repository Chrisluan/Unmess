# Publicação provisória (enquanto o domínio não sai)

Publica a instalação na internet por dois túneis descartáveis da Cloudflare, sem
depender de domínio próprio. É uma ponte até `app.unmess.com.br` /
`api.unmess.com.br` entrarem no ar — não um destino.

## Subir

PowerShell **como Administrador** (o script reinicia o backend):

```powershell
cd C:\unmess
node scripts/tunel-publico.js
```

Ele imprime os dois endereços sorteados e fica segurando os túneis. **Deixe a
janela aberta**: fechar derruba a publicação. `Ctrl+C` encerra e devolve a
instalação ao acesso apenas pela rede local.

## O que o script faz sozinho

1. Sobe um túnel para a interface (3333) e outro para a API (8080).
2. Grava os endereços em `frontend/endereco-publico.json`, servido em `/env.js`
   e lido pelo navegador em tempo de execução — por isso trocar de endereço
   **não** exige recompilar o frontend.
3. Põe a origem nova em `PUBLIC_ORIGINS` e reinicia o backend, senão o CORS
   barra a interface.
4. Se um túnel cair, levanta de novo e refaz os passos 2 e 3.

## Teste obrigatório no primeiro login

Há um detalhe que quebra o login **em silêncio**, e só pela internet: o cookie
do refresh token (`jrt`) é `SameSite=Lax`. Com `app.unmess.com.br` e
`api.unmess.com.br` isso funciona, porque são o mesmo site. Com dois túneis, os
endereços podem ser considerados sites diferentes — e aí o navegador para de
mandar o cookie, a sessão deixa de renovar e o atendente cai para a tela de
login sem explicação, minutos depois de entrar.

Logo após o primeiro login pelo endereço público, abra o DevTools (F12) e:

1. Aba **Network**, filtre por `refresh_token`;
2. Force uma renovação (recarregue a página com F5);
3. Veja a requisição em **Headers → Request Headers**.

- **Aparece `Cookie: jrt=...`** → está tudo certo, nada a fazer.
- **Não aparece o cookie** (ou a resposta é 401) → aplique a correção abaixo.

### Correção, se o cookie não passar

Em `backend/src/helpers/SendRefreshToken.ts`, o cookie precisa de
`sameSite: "none"` quando a requisição chega por HTTPS, mantendo `"lax"` no
acesso local por HTTP:

```ts
res.cookie("jrt", token, {
  httpOnly: true,
  secure: !!viaHttps,
  sameSite: viaHttps ? "none" : "lax"
});
```

`SameSite=None` **exige** `Secure`, o que já acontece por HTTPS — e por isso o
acesso local (HTTP) tem que continuar em `lax`, senão o navegador descarta o
cookie e o escritório perde a sessão.

Em troca, `None` abre mão da proteção contra CSRF que o `Lax` dava. O que
segura o risco passa a ser só o CORS de `PUBLIC_ORIGINS` — então essa lista não
pode ganhar origem que não seja estritamente necessária.

Depois de editar, recompilar e reiniciar o backend:

```powershell
cd C:\unmess\backend; npm run build; Restart-Service unmess-backend
```

## Limites que valem saber

- **O endereço muda a cada subida.** Não dá para fixá-lo, nem imprimir em
  material, nem mandar para cliente esperando que valha amanhã.
- **Sem garantia de disponibilidade.** `trycloudflare.com` é infraestrutura
  gratuita e descartável; a Cloudflare não promete que estará no ar.
- **Enquanto isso vale, a API está exposta à internet aberta.** Antes era só a
  rede local. Vale acompanhar `logs/unmess-backend.log` nos primeiros dias.

## Quando o domínio sair

Troque os quick tunnels por um túnel nomeado da Cloudflare (mesmo
`cloudflared`, agora com conta e domínio), apontando `app.` para 3333 e `api.`
para 8080. Aí:

1. Apague `frontend/endereco-publico.json` — sem ele o `/env.js` vem vazio e
   valem de novo as variáveis do build;
2. Confirme `VITE_PUBLIC_APP_HOST` e `VITE_PUBLIC_API_URL` em
   `frontend/.env.network` e recompile o frontend uma vez;
3. Deixe em `PUBLIC_ORIGINS` só a origem definitiva.
