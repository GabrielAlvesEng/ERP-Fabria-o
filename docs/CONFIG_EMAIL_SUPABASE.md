# E-mail automático dos logins (RH)

O ERP manda sozinho o convite e o link de nova senha pelo **Supabase Auth**. Para isso, o Supabase precisa de um servidor de e-mail (SMTP) da empresa: o servidor padrão do Supabase só entrega para os e-mails da equipe do painel e no máximo 2 por hora.

Enquanto o SMTP não estiver configurado, o ERP continua funcionando: quando o e-mail não sai, a ficha mostra o link para mandar por outro meio.

Tudo abaixo é feito pelo Gabriel no painel do Supabase, projeto `iobfyuscyzyjxmcwcqwj`. **Nunca mande a senha do e-mail no chat**: ela fica só no painel.

## 1. SMTP (Authentication → Emails → SMTP Settings → Enable custom SMTP)

Se aparecer o erro **535 authentication failed**, o servidor recusou o usuário ou a senha: confira se o usuário é o e-mail completo, redigite a senha e, se a caixa tiver verificação em duas etapas, use uma senha de aplicativo.

**Opção A: Microsoft 365 (o e-mail da empresa).** Use uma caixa como `erp@fabriacobrasil.com.br` (ou a sua).

| Campo | Valor |
| --- | --- |
| Sender email | o e-mail da caixa (ex.: `erp@fabriacobrasil.com.br`) |
| Sender name | `ERP Fabriaço` |
| Host | `smtp.office365.com` |
| Port | `587` |
| Username | o mesmo e-mail |
| Password | a senha da caixa (ou senha de aplicativo, se ela tiver verificação em duas etapas) |

No Microsoft 365, o envio por SMTP precisa estar ligado para essa caixa: Centro de administração → Usuários → a caixa → Email → Gerenciar aplicativos de email → marcar **SMTP autenticado**.

**Opção B: serviço de envio (ex.: Resend ou Brevo).** Cria uma conta grátis, confirma o domínio `fabriacobrasil.com.br` (registros DNS que o serviço mostra) e copia host, porta, usuário e senha que o serviço informar.

## 2. Textos em português (Authentication → Emails → Templates)

Copie o link **exatamente** como abaixo (com `token_hash`), e não o `{{ .ConfirmationURL }}` padrão. O antivírus do e-mail da empresa abre os links antes da pessoa; com o link padrão ele "gasta" o link e a pessoa recebe "link inválido ou expirado". Com este formato, o link só é usado quando a pessoa salva a senha na tela do ERP.

**Invite user**

- Assunto: `Seu acesso ao ERP Fabriaço`
- Corpo:

```html
<p>Olá!</p>
<p>Seu login no <b>ERP Fabriaço</b> foi criado ({{ .Email }}).</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Clique aqui para escolher a sua senha</a>.</p>
<p>O link vale por pouco tempo e funciona uma vez. Se expirar, peça um novo ao RH.</p>
```

**Reset password**

- Assunto: `Defina sua senha do ERP Fabriaço`
- Corpo:

```html
<p>Olá!</p>
<p>Recebemos um pedido para definir a senha do seu login no <b>ERP Fabriaço</b> ({{ .Email }}).</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Clique aqui para escolher a senha</a>.</p>
<p>O link vale por pouco tempo e funciona uma vez. Se você não pediu, ignore este e-mail.</p>
```

## 3. Endereço de volta (Authentication → URL Configuration)

- Site URL: o endereço que a equipe usa (hoje `https://erp-fabriaco-brasil.netlify.app/`).
- Redirect URLs: adicionar `https://erp-fabriaco-brasil.netlify.app/**` e `https://gabrielalveseng.github.io/ERP-Fabria-o/**` (e `http://localhost:5173/**` para testes).

Sem isso, o link do e-mail pode abrir uma página errada em vez da tela "Definir senha".

## 4. Teste

No ERP, abra a ficha do Caio → **Enviar link de senha**. Deve aparecer "Convite enviado para …" e o e-mail chega em até alguns minutos (confira o spam na primeira vez).
