-- AnaliseSolo nunca teve a coluna de enxofre (S), embora o leitor de laudo
-- sempre tenha reconhecido essa coluna e o código sempre tenha tentado
-- gravá-la (CAMPOS_QUIMICA em importacaoLaudo.ts) — qualquer confirmação de
-- análise química com enxofre preenchido quebrava com erro 500, sem nunca
-- ter sido testada de ponta a ponta até agora. AnaliseFoliar já tinha essa
-- coluna; só faltava em AnaliseSolo.
ALTER TABLE "AnaliseSolo" ADD COLUMN "enxofre" DOUBLE PRECISION;
