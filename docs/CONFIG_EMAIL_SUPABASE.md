# E-mail automático dos logins (RH)

O ERP manda sozinho o convite e o link de nova senha pelo **Supabase Auth**. Para isso, o Supabase precisa de um servidor de e-mail (SMTP) da empresa: o servidor padrão do Supabase só entrega para os e-mails da equipe do painel e no máximo 2 por hora.

Enquanto o SMTP não estiver configurado, o ERP continua funcionando: quando o e-mail não sai, a ficha mostra o link para mandar por outro meio.

Tudo abaixo é feito pelo Gabriel no painel do Supabase, projeto `iobfyuscyzyjxmcwcqwj`. **Nunca mande a senha do e-mail no chat**: ela fica só no painel.

## 1. SMTP (Authentication → Emails → SMTP Settings → Enable custom SMTP)

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

**Invite user**

- Assunto: `Seu acesso ao ERP Fabriaço`
- Corpo:

```html
<p>Olá!</p>
<p>Seu login no <b>ERP Fabriaço</b> foi criado ({{ .Email }}).</p>
<p><a href="{{ .ConfirmationURL }}">Clique aqui para escolher a sua senha</a>.</p>
<p>O link vale por pouco tempo e funciona uma vez. Se expirar, peça um novo ao RH.</p>
```

**Reset password**

- Assunto: `Defina sua senha do ERP Fabriaço`
- Corpo:

```html
<p>Olá!</p>
<p>Recebemos um pedido para definir a senha do seu login no <b>ERP Fabriaço</b> ({{ .Email }}).</p>
<p><a href="{{ .ConfirmationURL }}">Clique aqui para escolher a senha</a>.</p>
<p>O link vale por pouco tempo e funciona uma vez. Se você não pediu, ignore este e-mail.</p>
```

## 3. Endereço de volta (Authentication → URL Configuration)

- Site URL: `https://gabrielalveseng.github.io/ERP-Fabria-o/`
- Redirect URLs: adicionar `https://gabrielalveseng.github.io/ERP-Fabria-o/**` (e `http://localhost:5173/**` para testes).

Sem isso, o link do e-mail pode abrir uma página errada em vez da tela "Definir senha".

## 4. Teste

No ERP, abra a ficha do Caio → **Enviar link de senha**. Deve aparecer "Convite enviado para …" e o e-mail chega em até alguns minutos (confira o spam na primeira vez).
