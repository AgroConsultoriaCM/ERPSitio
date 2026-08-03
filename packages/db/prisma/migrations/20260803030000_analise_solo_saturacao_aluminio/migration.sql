-- m% (saturacao por aluminio) e pedido junto com CTC e V%, mas a coluna nunca
-- existiu em AnaliseSolo: o valor calculado/digitado na tela era descartado
-- silenciosamente ao confirmar.
ALTER TABLE "AnaliseSolo" ADD COLUMN "saturacaoAluminio" DOUBLE PRECISION;
