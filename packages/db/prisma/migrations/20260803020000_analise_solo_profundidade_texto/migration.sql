-- profundidadeCm era numérico (Float), mas todo laudo real expressa a
-- profundidade da coleta como faixa ("0-20"), nunca um valor único — o
-- mesmo motivo pelo qual AnaliseFisicaSolo.profundidadeCm já era texto.
-- A conversão preserva o valor existente (ex. 20 -> "20").
ALTER TABLE "AnaliseSolo" ALTER COLUMN "profundidadeCm" TYPE TEXT USING "profundidadeCm"::text;
