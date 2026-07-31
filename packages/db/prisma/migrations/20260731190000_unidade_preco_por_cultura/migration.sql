-- A unidade do preco de venda passa a ser propriedade da cultura.
--
-- O limao taiti e vendido por caixa de 27,2 kg; o abacate, por quilo. Ate
-- agora os 27,2 kg eram uma constante no codigo da API, o que so funcionava
-- enquanto existisse uma cultura comercial.
--
-- Com este campo:
--   preenchido -> o preco lancado na colheita e POR CAIXA daquele peso
--   vazio      -> o preco lancado ja e POR QUILO
--
-- IMPORTANTE - por que TODAS as culturas recebem 27,2 e nao so o limao:
--
-- Ate esta migration, a API dividia o preco por 27,2 para qualquer colheita,
-- de qualquer cultura. Deixar o campo vazio faria o sistema reinterpretar os
-- lancamentos existentes como se o preco ja fosse por quilo, e a receita
-- gravada saltaria 27 vezes. Preencher todas com 27,2 preserva exatamente o
-- numero que hoje aparece na tela.
--
-- Ajuste em Cadastros -> Culturas: no abacate, apague o peso da caixa para que
-- o preco passe a ser lido por quilo. Nada e recalculado sozinho por nome de
-- cultura - adivinhar cultura por nome erraria em cadastro escrito diferente.

ALTER TABLE "Cultura" ADD COLUMN "pesoCaixaKg" DOUBLE PRECISION;

UPDATE "Cultura" SET "pesoCaixaKg" = 27.2;
