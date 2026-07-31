-- Preco da colheita passa a ser por qualidade, e a receita deixa de ser digitada.
--
-- O limao e vendido por caixa padrao de 27,2 kg, com preco diferente para a
-- fruta boa e para o refugo. Antes so existia "valorTotalVenda", um valor
-- fechado digitado a mao: nao dava para saber quanto do dinheiro veio de cada
-- qualidade, nem conferir a conta.
--
-- Agora entram os dois precos e a receita vira calculo:
--   preco do quilo   = preco da caixa / 27,2
--   receita boa      = (peso total - refugo) x preco do quilo bom
--   receita refugo   = refugo x preco do quilo do refugo
--
-- Somente adicao de colunas. Nenhum dado existente e alterado ou apagado:
-- "valorTotalVenda" continua onde esta e segue valendo para os lancamentos
-- antigos, que nao tem os precos por qualidade preenchidos.

ALTER TABLE "Colheita" ADD COLUMN "precoCaixaBom" DOUBLE PRECISION;
ALTER TABLE "Colheita" ADD COLUMN "precoCaixaRefugo" DOUBLE PRECISION;
