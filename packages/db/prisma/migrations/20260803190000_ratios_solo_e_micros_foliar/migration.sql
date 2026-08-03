-- Relacoes de equilibrio cationico no perfil de correcao de SOLO. Nao sao
-- colunas medidas: sao calculadas na hora do diagnostico a partir do Ca/Mg/K
-- da propria analise, e comparadas contra este "ideal".
ALTER TABLE "PerfilCorrecaoSolo" ADD COLUMN "relacaoCaMgIdeal" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoSolo" ADD COLUMN "relacaoMgKIdeal" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoSolo" ADD COLUMN "relacaoCaMgKIdeal" DOUBLE PRECISION;

-- Micronutrientes no perfil de correcao FOLIAR (painel padrao Malavolta: B,
-- Cu, Fe, Mn, Mo, Zn), cada um com faixa min/max como os demais nutrientes
-- foliares - nao existiam ainda no perfil, so os macronutrientes.
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "boroIdealMin" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "boroIdealMax" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "cobreIdealMin" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "cobreIdealMax" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "ferroIdealMin" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "ferroIdealMax" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "manganesIdealMin" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "manganesIdealMax" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "molibdenioIdealMin" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "molibdenioIdealMax" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "zincoIdealMin" DOUBLE PRECISION;
ALTER TABLE "PerfilCorrecaoFoliar" ADD COLUMN "zincoIdealMax" DOUBLE PRECISION;
