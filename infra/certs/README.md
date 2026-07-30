# infra/certs/

Pasta opcional para certificados de CA extras que o build Docker deve confiar,
usada quando a máquina que faz o build está atrás de um antivírus/proxy que
inspeciona tráfego HTTPS (ex: Kaspersky Endpoint Security, proxies
corporativos) — sem isso, o `npm install` dentro do container falha com
`SELF_SIGNED_CERT_IN_CHAIN`, porque o container Linux não confia no
certificado que o Windows já confia.

Como usar: exporte o certificado raiz do seu antivírus/proxy (no Windows,
`certmgr.msc` → "Autoridades de Certificação Raiz Confiáveis") como um
arquivo `.crt` em formato PEM e coloque nesta pasta. Os Dockerfiles do
projeto detectam automaticamente qualquer `.crt` aqui e confiam nele durante
o build.

**Nenhum arquivo `.crt` aqui é versionado no Git** (veja `.gitignore`) — são
específicos de cada máquina. Numa VPS limpa, sem inspeção de HTTPS na rede,
esta pasta fica vazia e o build funciona normalmente sem nenhuma mudança.
