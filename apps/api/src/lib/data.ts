// "Hoje" pelo calendario de Brasilia, nao pelo fuso do container - o mesmo
// cuidado documentado no CLAUDE.md sobre o cron ter rodado em UTC por
// engano numa instancia nova.
export function hojeBrasilia(): Date {
  const dataStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${dataStr}T00:00:00.000Z`);
}
